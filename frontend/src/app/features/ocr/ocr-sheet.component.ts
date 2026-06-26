import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { BottomSheetComponent } from '../../shared/bottom-sheet/bottom-sheet.component';
import { CrisisDataService } from '../../core/services/crisis-data.service';
import { UiService } from '../../core/services/ui.service';
import { OcrRecord, PersonStatus } from '../../core/models/models';
import { STATUS_CHIP, STATUS_LABEL } from '../../core/util/labels';

type Stage = 'idle' | 'uploading' | 'scanning' | 'deduping' | 'review';
type Tab = 'imagen' | 'csv';

/** Sample text the simulated OCR "reads" from a handwritten list. */
const OCR_SAMPLE = `REFUGIO MONTALBÁN — PERSONAS A SALVO
1) María A. Rodríguez   C.I. V-12.345.678
2) Jesús M. Aponte      C.I. V-21.456.789
3) Norelys C. Páez      C.I. V-17.654.321
— Coordinador: J. Marcano  (lista verificada)`;

const VALID_ESTADOS: PersonStatus[] = ['desaparecido', 'a_salvo', 'fallecido'];

@Component({
  selector: 'app-ocr-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BottomSheetComponent, NgTemplateOutlet],
  template: `
    <app-bottom-sheet title="Cargar lista" subtitle="Imagen (OCR) o archivo CSV"
                      icon="📥" accentBg="bg-warnbg text-warn" (close)="ui.close()">

      @if (!unlocked()) {
        <!-- Gate de acceso -->
        <div class="mx-auto max-w-sm space-y-3 py-2">
          <div class="flex flex-col items-center gap-1 py-2 text-center">
            <span class="text-3xl">🔒</span>
            <span class="text-sm font-bold" style="color: var(--txt)">Acceso restringido</span>
            <span class="text-[12px]" style="color: var(--txt-muted)">Inicia sesión para cargar listas (OCR / CSV)</span>
          </div>
          <input [value]="loginUser()" (input)="loginUser.set($any($event.target).value)"
                 type="text" autocomplete="username" placeholder="Usuario"
                 class="w-full rounded-xl px-4 py-3 text-sm font-medium outline-none ring-1"
                 style="background: var(--sheet-inset); color: var(--txt); --tw-ring-color: var(--glass-border)" />
          <input [value]="loginPass()" (input)="loginPass.set($any($event.target).value)" (keyup.enter)="onLogin()"
                 type="password" autocomplete="current-password" placeholder="Contraseña"
                 class="w-full rounded-xl px-4 py-3 text-sm font-medium outline-none ring-1"
                 style="background: var(--sheet-inset); color: var(--txt); --tw-ring-color: var(--glass-border)" />
          @if (loginError()) {
            <div class="text-[12px] font-semibold" style="color: var(--c-alert)">{{ loginError() }}</div>
          }
          <button (click)="onLogin()" [disabled]="loggingIn()"
                  class="w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-md transition active:scale-[.98] disabled:opacity-50 bg-gradient-to-tr from-blue-600 to-blue-400">
            {{ loggingIn() ? 'Verificando…' : 'Ingresar' }}
          </button>
        </div>
      } @else {

      <!-- Tabs -->
      <div class="mb-4 grid grid-cols-2 gap-2 rounded-2xl p-1.5" style="background: var(--chip-bg)">
        <button (click)="setTab('imagen')"
                class="rounded-xl py-2.5 text-sm font-bold transition"
                [style.background]="tab()==='imagen' ? 'var(--sheet)' : 'transparent'"
                [style.color]="tab()==='imagen' ? 'var(--txt)' : 'var(--txt-muted)'">
          🖼️ Imagen (OCR)
        </button>
        <button (click)="setTab('csv')"
                class="rounded-xl py-2.5 text-sm font-bold transition"
                [style.background]="tab()==='csv' ? 'var(--sheet)' : 'transparent'"
                [style.color]="tab()==='csv' ? 'var(--txt)' : 'var(--txt-muted)'">
          📄 CSV
        </button>
      </div>

      @if (tab() === 'imagen') {
        @if (stage() === 'idle') {
          <!-- Dropzone imagen -->
          <label (dragover)="onDragOver($event)" (dragleave)="over.set(false)" (drop)="onDrop($event)"
                 class="dropzone flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl
                        border-2 border-dashed border-white/20 bg-white/10 px-6 py-10 text-center transition shadow-sm hover:bg-white/15"
                 [class.dropzone--over]="over()">
            <span class="text-4xl">🗂️</span>
            <span class="text-sm font-bold text-white">Arrastra una imagen aquí</span>
            <span class="text-xs font-medium text-white/60">o toca para seleccionar (JPG, PNG, PDF)</span>
            <input type="file" accept="image/*,application/pdf" class="hidden" (change)="onPick($event)" />
          </label>
          <div class="mt-4 rounded-xl bg-white/10 p-3 text-[11px] font-medium text-white/60 ring-1 ring-white/10 shadow-sm">
            🔐 La imagen se sube al bucket privado <code>listas_sismo</code> con URL firmada;
            el OCR y la desduplicación corren en el servidor.
          </div>
        }

        @if (stage() !== 'idle') {
          <!-- Pipeline OCR -->
          <div class="space-y-4">
            <div class="flex items-center gap-2 text-sm font-bold text-white bg-white/10 shadow-sm p-3 rounded-xl ring-1 ring-white/10">
              <span>🖼️</span><span class="truncate">{{ fileName() }}</span>
            </div>

            <div class="bg-white/10 p-4 rounded-xl ring-1 ring-white/10 shadow-sm">
              <div class="mb-2 flex justify-between text-[11px] font-bold {{ stage()==='uploading' ? 'text-info' : 'text-white/60' }}">
                <span>1 · Subiendo a Supabase Storage</span><span>{{ progress() }}%</span>
              </div>
              <div class="h-2.5 overflow-hidden rounded-full bg-white/10 shadow-inner">
                <div class="h-full rounded-full bg-info transition-[width] duration-150" [style.width.%]="progress()"></div>
              </div>
            </div>

            @if (step() >= 2) {
              <div class="bg-white/10 p-4 rounded-xl ring-1 ring-white/10 shadow-sm mt-3">
                <div class="mb-2 text-[11px] font-bold {{ stage()==='scanning' ? 'text-info' : 'text-white/60' }}">2 · Escaneo OCR</div>
                <div class="relative overflow-hidden rounded-xl bg-primary p-4 shadow-inner">
                  @if (stage() === 'scanning') { <div class="scanline"></div> }
                  <pre class="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-emerald-400 font-medium">{{ scanText() }}@if (stage()==='scanning') {<span class="animate-pulse">▌</span>}</pre>
                </div>
              </div>
            }

            @if (step() >= 3) {
              <div class="rounded-xl p-4 ring-1 shadow-sm mt-3"
                   [class]="dupCount() ? 'bg-orange-950/40 ring-warn/30 text-warn' : 'bg-green-950/40 ring-safe/30 text-safe'">
                <div class="flex items-center gap-2 text-sm font-bold">
                  <span>{{ dupCount() ? '🧠' : '✅' }}</span>
                  <span>Desduplicación por IA</span>
                  @if (stage()==='deduping') { <span class="ml-auto text-[11px] font-medium text-white/40 animate-pulse">analizando…</span> }
                </div>
                @if (step() >= 4) {
                  <p class="mt-2 text-xs font-semibold text-white/80">
                    {{ dupCount() }} de {{ records().length }} ya existían en la base
                    → se unificarán (no se duplica el pin en el mapa).
                  </p>
                }
              </div>
            }

            @if (stage() === 'review') {
              <ng-container *ngTemplateOutlet="reviewBlock"></ng-container>
            }
          </div>
        }
      }

      @if (tab() === 'csv') {
        @if (!records().length) {
          <!-- Dropzone CSV -->
          <label class="dropzone flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl
                        border-2 border-dashed border-white/20 bg-white/10 px-6 py-10 text-center transition shadow-sm hover:bg-white/15">
            <span class="text-4xl">📄</span>
            <span class="text-sm font-bold text-white">Selecciona un archivo CSV</span>
            <span class="text-xs font-medium text-white/60">Columnas: nombre, cedula, estado, ubicacion</span>
            <input type="file" accept=".csv,text/csv" class="hidden" (change)="onCsvPick($event)" />
          </label>
          @if (csvError()) {
            <div class="mt-3 rounded-xl bg-orange-950/40 p-3 text-[12px] font-semibold text-warn ring-1 ring-warn/30">{{ csvError() }}</div>
          }
          <div class="mt-4 rounded-xl bg-white/10 p-3 text-[11px] font-medium text-white/60 ring-1 ring-white/10 shadow-sm">
            Ejemplo: <code>María Pérez,V-12.345.678,a_salvo,Refugio Plaza Altamira</code>.
            Estados válidos: <code>desaparecido</code>, <code>a_salvo</code>, <code>fallecido</code>.
            Las filas se desduplican por IA antes de guardar.
          </div>
        } @else {
          <div class="flex items-center gap-2 text-sm font-bold text-white bg-white/10 shadow-sm p-3 rounded-xl ring-1 ring-white/10 mb-2">
            <span>📄</span><span class="truncate">{{ fileName() }}</span><span class="ml-auto text-[11px] text-white/60">{{ records().length }} filas</span>
          </div>
          <ng-container *ngTemplateOutlet="reviewBlock"></ng-container>
        }
      }
      }

      <!-- Bloque de revisión + guardar (compartido por ambas pestañas) -->
      <ng-template #reviewBlock>
        <div class="overflow-hidden rounded-xl ring-1 ring-white/10 shadow-sm mt-4">
          <table class="w-full text-left text-[11px]">
            <thead class="bg-white/10 text-white/60 font-semibold">
              <tr><th class="px-3 py-2.5">Nombre</th><th class="px-3 py-2.5">Cédula</th><th class="px-3 py-2.5">Estado</th><th class="px-3 py-2.5">IA</th></tr>
            </thead>
            <tbody class="divide-y divide-white/5 bg-white/5 text-white">
              @for (r of records(); track $index) {
                <tr class="hover:bg-white/5 transition">
                  <td class="px-3 py-3 font-semibold text-white">{{ r.nombre }}</td>
                  <td class="px-3 py-3 font-medium text-white/60">{{ r.cedula ?? '—' }}</td>
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
          <button (click)="reset()" class="flex-1 rounded-2xl bg-white/10 py-3 text-sm font-bold text-white/80 ring-1 ring-white/10 hover:bg-white/20 transition">Descartar</button>
          <button (click)="save()" [disabled]="saving()"
                  class="flex-1 rounded-2xl bg-info py-3 text-sm font-bold text-white shadow-md hover:bg-info/90 disabled:opacity-50 transition">
            {{ saving() ? 'Guardando…' : 'Guardar en base' }}
          </button>
        </div>
      </ng-template>
    </app-bottom-sheet>
  `
})
export class OcrSheetComponent {
  private data = inject(CrisisDataService);
  ui = inject(UiService);

  // Gate de acceso (se pide cada vez que se abre la hoja).
  readonly unlocked = signal(false);
  readonly loginUser = signal('');
  readonly loginPass = signal('');
  readonly loginError = signal('');
  readonly loggingIn = signal(false);

  readonly tab = signal<Tab>('imagen');
  readonly stage = signal<Stage>('idle');
  readonly over = signal(false);
  readonly fileName = signal('');
  readonly progress = signal(0);
  readonly scanText = signal('');
  readonly records = signal<OcrRecord[]>([]);
  readonly saving = signal(false);
  readonly csvError = signal('');

  readonly dupCount = computed(() => this.records().filter((r) => r.isDuplicate).length);
  readonly step = computed(() => {
    switch (this.stage()) {
      case 'uploading': return 1;
      case 'scanning': return 2;
      case 'deduping': return 3;
      case 'review': return 4;
      default: return 0;
    }
  });

  async onLogin(): Promise<void> {
    if (this.loggingIn()) return;
    this.loginError.set('');
    this.loggingIn.set(true);
    try {
      const ok = await this.data.login(this.loginUser().trim(), this.loginPass());
      if (ok) {
        this.unlocked.set(true);
        this.loginPass.set('');
      } else {
        this.loginError.set('Usuario o contraseña inválidos.');
      }
    } catch {
      this.loginError.set('No se pudo verificar. Intenta de nuevo.');
    } finally {
      this.loggingIn.set(false);
    }
  }

  setTab(t: Tab): void {
    this.tab.set(t);
    this.reset();
    this.csvError.set('');
  }

  // --- Imagen / OCR ---------------------------------------------------------
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

  private process(name: string): void {
    this.fileName.set(name);
    this.scanText.set('');
    this.records.set([]);
    this.stage.set('uploading');
    this.progress.set(0);

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
    setTimeout(async () => {
      const rows = this.extractRows(OCR_SAMPLE);
      this.records.set(await this.data.analyzeOcrDuplicates(rows));
      setTimeout(() => this.stage.set('review'), 700);
    }, 600);
  }

  private extractRows(
    text: string
  ): { nombre: string; cedula: string | null; estado: PersonStatus; ubicacion: string }[] {
    const ubicacion = 'Refugio Montalbán, Caracas';
    return text
      .split('\n')
      .map((l) => l.match(/^\s*\d+\)\s*(.+?)\s+C\.I\.\s*([VE]-[\d.]+)/i))
      .filter((m): m is RegExpMatchArray => !!m)
      .map((m) => ({
        nombre: m[1].trim(),
        cedula: m[2].trim(),
        estado: 'a_salvo' as PersonStatus,
        ubicacion,
      }));
  }

  // --- CSV ------------------------------------------------------------------
  onCsvPick(e: Event): void {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) void this.processCsv(f);
  }

  private async processCsv(file: File): Promise<void> {
    this.csvError.set('');
    this.fileName.set(file.name);
    try {
      const text = await file.text();
      const rows = this.parseCsv(text);
      if (!rows.length) {
        this.csvError.set('No se encontraron filas válidas. Revisa las columnas (nombre, cedula, estado, ubicacion).');
        return;
      }
      this.records.set(await this.data.analyzeOcrDuplicates(rows));
    } catch {
      this.csvError.set('No se pudo leer el archivo CSV.');
    }
  }

  /** Parser CSV simple (separado por comas; cabecera opcional). */
  private parseCsv(
    text: string
  ): { nombre: string; cedula: string | null; estado: PersonStatus; ubicacion: string }[] {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return [];

    let cols = ['nombre', 'cedula', 'estado', 'ubicacion'];
    let start = 0;
    const first = lines[0].toLowerCase().split(',').map((c) => c.trim());
    if (first.includes('nombre') || first.includes('cedula') || first.includes('cédula')) {
      cols = first.map((c) => (c === 'cédula' ? 'cedula' : c));
      start = 1;
    }
    const at = (cells: string[], name: string, fallbackIdx: number): string => {
      const idx = cols.indexOf(name);
      return (idx >= 0 ? cells[idx] : cells[fallbackIdx]) ?? '';
    };

    const out: { nombre: string; cedula: string | null; estado: PersonStatus; ubicacion: string }[] = [];
    for (let i = start; i < lines.length; i++) {
      const cells = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      const nombre = at(cells, 'nombre', 0).trim();
      if (!nombre) continue;
      const cedula = at(cells, 'cedula', 1).trim();
      const estadoRaw = at(cells, 'estado', 2).trim().toLowerCase();
      const estado = (VALID_ESTADOS as string[]).includes(estadoRaw)
        ? (estadoRaw as PersonStatus)
        : 'a_salvo';
      const ubicacion = at(cells, 'ubicacion', 3).trim() || 'Carga CSV';
      out.push({ nombre, cedula: cedula || null, estado, ubicacion });
    }
    return out;
  }

  // --- Guardar / reset ------------------------------------------------------
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
