import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BottomSheetComponent } from '../../shared/bottom-sheet/bottom-sheet.component';
import { CrisisDataService } from '../../core/services/crisis-data.service';
import { UiService } from '../../core/services/ui.service';
import { MOCK_OCR_ROWS } from '../../core/data/mock-data';
import { OcrRecord } from '../../core/models/models';
import { STATUS_CHIP, STATUS_LABEL } from '../../core/util/labels';

type Stage = 'idle' | 'uploading' | 'scanning' | 'deduping' | 'review';

/** Sample text the simulated OCR "reads" from a handwritten list. */
const OCR_SAMPLE = `REFUGIO MONTALBÁN — PERSONAS A SALVO
1) María A. Rodríguez   C.I. V-12.345.678
2) Jesús M. Aponte      C.I. V-21.456.789
3) Norelys C. Páez      C.I. V-17.654.321
— Coordinador: J. Marcano  (lista verificada)`;

@Component({
  selector: 'app-ocr-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BottomSheetComponent],
  template: `
    <app-bottom-sheet title="Cargar lista (OCR)" subtitle="Foto de lista escrita a mano o captura de chat"
                      icon="📷" accentBg="bg-warnbg text-warn" (close)="ui.close()">

      @if (stage() === 'idle') {
        <!-- Dropzone -->
        <label (dragover)="onDragOver($event)" (dragleave)="over.set(false)" (drop)="onDrop($event)"
               class="dropzone flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl
                      border-2 border-dashed border-borderlight bg-appbg/50 px-6 py-10 text-center transition"
               [class.dropzone--over]="over()">
          <span class="text-4xl">🗂️</span>
          <span class="text-sm font-bold text-textmain">Arrastra una imagen aquí</span>
          <span class="text-xs font-medium text-textmuted">o toca para seleccionar (JPG, PNG, PDF)</span>
          <input type="file" accept="image/*,application/pdf" class="hidden" (change)="onPick($event)" />
        </label>
        <div class="mt-4 rounded-xl bg-appbg/70 p-3 text-[11px] font-medium text-textmuted ring-1 ring-borderlight shadow-sm">
          🔐 La imagen se sube al bucket privado <code>listas_sismo</code> con URL firmada;
          el OCR y la desduplicación corren en el servidor.
        </div>
      }

      @if (stage() !== 'idle') {
        <!-- Pipeline -->
        <div class="space-y-4">
          <div class="flex items-center gap-2 text-sm font-bold text-textmain bg-appbg p-3 rounded-xl ring-1 ring-borderlight">
            <span>🖼️</span><span class="truncate">{{ fileName() }}</span>
          </div>

          <!-- 1. Upload -->
          <div class="bg-surface p-4 rounded-xl ring-1 ring-borderlight shadow-sm">
            <div class="mb-2 flex justify-between text-[11px] font-bold {{ stage()==='uploading' ? 'text-info' : 'text-textmuted' }}">
              <span>1 · Subiendo a Supabase Storage</span><span>{{ progress() }}%</span>
            </div>
            <div class="h-2.5 overflow-hidden rounded-full bg-borderlight shadow-inner">
              <div class="h-full rounded-full bg-info transition-[width] duration-150" [style.width.%]="progress()"></div>
            </div>
          </div>

          <!-- 2. OCR scan -->
          @if (step() >= 2) {
            <div class="bg-surface p-4 rounded-xl ring-1 ring-borderlight shadow-sm mt-3">
              <div class="mb-2 text-[11px] font-bold {{ stage()==='scanning' ? 'text-info' : 'text-textmuted' }}">2 · Escaneo OCR</div>
              <div class="relative overflow-hidden rounded-xl bg-primary p-4 shadow-inner">
                @if (stage() === 'scanning') { <div class="scanline"></div> }
                <pre class="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-emerald-400 font-medium">{{ scanText() }}@if (stage()==='scanning') {<span class="animate-pulse">▌</span>}</pre>
              </div>
            </div>
          }

          <!-- 3. Dedup -->
          @if (step() >= 3) {
            <div class="rounded-xl p-4 ring-1 shadow-sm mt-3"
                 [class]="dupCount() ? 'bg-warnbg ring-warn/30' : 'bg-safebg ring-safe/30'">
              <div class="flex items-center gap-2 text-sm font-bold"
                   [class]="dupCount() ? 'text-warn' : 'text-safe'">
                <span>{{ dupCount() ? '🧠' : '✅' }}</span>
                <span>Desduplicación por IA</span>
                @if (stage()==='deduping') { <span class="ml-auto text-[11px] font-medium text-textmuted animate-pulse">analizando…</span> }
              </div>
              @if (step() >= 4) {
                <p class="mt-2 text-xs font-semibold" [class]="dupCount() ? 'text-warn/90' : 'text-safe/90'">
                  {{ dupCount() }} de {{ records().length }} ya existían en la base
                  → se unificarán (no se duplica el pin en el mapa).
                </p>
              }
            </div>
          }

          <!-- 4. Extracted table -->
          @if (stage() === 'review') {
            <div class="overflow-hidden rounded-xl ring-1 ring-borderlight shadow-sm mt-4">
              <table class="w-full text-left text-[11px]">
                <thead class="bg-appbg text-textmuted font-semibold">
                  <tr><th class="px-3 py-2.5">Nombre</th><th class="px-3 py-2.5">Cédula</th><th class="px-3 py-2.5">Estado</th><th class="px-3 py-2.5">IA</th></tr>
                </thead>
                <tbody class="divide-y divide-borderlight bg-surface">
                  @for (r of records(); track r.cedula) {
                    <tr class="hover:bg-appbg/50 transition">
                      <td class="px-3 py-3 font-semibold text-textmain">{{ r.nombre }}</td>
                      <td class="px-3 py-3 font-medium text-textmuted">{{ r.cedula }}</td>
                      <td class="px-3 py-3"><span class="rounded-full px-2 py-0.5 text-[10px] font-bold" [class]="chip(r.estado)">{{ label(r.estado) }}</span></td>
                      <td class="px-3 py-3 font-bold">
                        @if (r.isDuplicate) { <span class="text-warn" title="Duplicado: se unificará">⟳ dup</span> }
                        @else { <span class="text-safe" title="Nuevo registro">＋ nuevo</span> }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <div class="flex gap-3 mt-4">
              <button (click)="reset()" class="flex-1 rounded-2xl bg-appbg py-3 text-sm font-bold text-textmuted ring-1 ring-borderlight hover:bg-borderlight transition">Descartar</button>
              <button (click)="save()" [disabled]="saving()"
                      class="flex-1 rounded-2xl bg-info py-3 text-sm font-bold text-white shadow-md hover:bg-info/90 disabled:opacity-50 transition">
                {{ saving() ? 'Guardando…' : 'Guardar en base' }}
              </button>
            </div>
          }
        </div>
      }
    </app-bottom-sheet>
  `
})
export class OcrSheetComponent {
  private data = inject(CrisisDataService);
  ui = inject(UiService);

  readonly stage = signal<Stage>('idle');
  readonly over = signal(false);
  readonly fileName = signal('');
  readonly progress = signal(0);
  readonly scanText = signal('');
  readonly records = signal<OcrRecord[]>([]);
  readonly saving = signal(false);

  readonly dupCount = computed(() => this.records().filter((r) => r.isDuplicate).length);
  /** Coarse step index for the progressive reveal of pipeline stages. */
  readonly step = computed(() => {
    switch (this.stage()) {
      case 'uploading': return 1;
      case 'scanning': return 2;
      case 'deduping': return 3;
      case 'review': return 4;
      default: return 0;
    }
  });

  // --- Drag & drop / picker -------------------------------------------------
  onDragOver(e: DragEvent): void { e.preventDefault(); this.over.set(true); }
  onDrop(e: DragEvent): void {
    e.preventDefault(); this.over.set(false);
    const f = e.dataTransfer?.files?.[0];
    this.process(f?.name ?? 'lista_rescate.jpg');
  }
  onPick(e: Event): void {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) this.process(f.name);
  }

  // --- Simulated pipeline ---------------------------------------------------
  private process(name: string): void {
    this.fileName.set(name);
    this.scanText.set('');
    this.records.set([]);
    this.stage.set('uploading');
    this.progress.set(0);

    // 1) Upload progress
    const up = setInterval(() => {
      this.progress.update((p) => Math.min(100, p + 8 + Math.random() * 12));
      if (this.progress() >= 100) {
        clearInterval(up);
        this.startScan();
      }
    }, 120);
  }

  private startScan(): void {
    this.stage.set('scanning');
    let i = 0;
    const type = setInterval(() => {
      i += 2;
      this.scanText.set(OCR_SAMPLE.slice(0, i));
      if (i >= OCR_SAMPLE.length) {
        clearInterval(type);
        this.startDedup();
      }
    }, 18);
  }

  private startDedup(): void {
    this.stage.set('deduping');
    // The cross-check runs on the server; mirrored here for the demo.
    setTimeout(() => {
      this.records.set(this.data.analyzeOcrDuplicates(MOCK_OCR_ROWS));
      setTimeout(() => this.stage.set('review'), 700);
    }, 600);
  }

  async save(): Promise<void> {
    this.saving.set(true);
    try {
      const summary = await this.data.saveOcrRecords(this.records());
      this.ui.toast(`Lista procesada: ${summary.added} nuevos, ${summary.merged} unificados por IA.`, 'success', 6000);
      this.reset();
      this.ui.close();
    } finally {
      this.saving.set(false);
    }
  }

  reset(): void {
    this.stage.set('idle');
    this.progress.set(0);
    this.scanText.set('');
    this.records.set([]);
  }

  chip = (s: any) => STATUS_CHIP[s as keyof typeof STATUS_CHIP];
  label = (s: any) => STATUS_LABEL[s as keyof typeof STATUS_LABEL];
}
