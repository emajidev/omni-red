import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { BottomSheetComponent } from '../../shared/bottom-sheet/bottom-sheet.component';
import { CrisisDataService } from '../../core/services/crisis-data.service';
import { UiService } from '../../core/services/ui.service';
import {
  BuildingStatus, CenterType, DamageLevel,
  NewBuildingRow, NewCenterRow, OcrRecord, PersonStatus,
} from '../../core/models/models';
import { STATUS_CHIP, STATUS_LABEL } from '../../core/util/labels';

type Stage = 'idle' | 'uploading' | 'scanning' | 'deduping' | 'review';
type Tab = 'imagen' | 'csv';

/** Qué tipo de lista se está cargando por CSV. */
type CsvKind = 'personas' | 'acopio' | 'hospital' | 'edificio';

const VALID_ESTADOS: PersonStatus[] = ['desaparecido', 'a_salvo', 'fallecido'];
const VALID_DANO: DamageLevel[] = ['parcial', 'severo', 'colapsado'];
const VALID_EST_EDIF: BuildingStatus[] = ['reportado', 'en_rescate', 'despejado'];

/** Sample text the simulated OCR "reads" from a handwritten list. */
const OCR_SAMPLE = `REFUGIO MONTALBÁN — PERSONAS A SALVO
1) María A. Rodríguez   C.I. V-12.345.678
2) Jesús M. Aponte      C.I. V-21.456.789
3) Norelys C. Páez      C.I. V-17.654.321
— Coordinador: J. Marcano  (lista verificada)`;

/** Spec de formato por tipo de lista CSV (columnas + ejemplo mostrado al usuario). */
interface CsvSpec {
  kind: CsvKind;
  icon: string;
  label: string;
  columns: string[];          // orden canónico (también acepta cabecera)
  sample: string;             // fila de ejemplo
  notes: string;              // valores válidos / aclaraciones
}

const CSV_SPECS: Record<CsvKind, CsvSpec> = {
  personas: {
    kind: 'personas', icon: '👤', label: 'Personas',
    columns: ['nombre', 'cedula', 'estado', 'ubicacion'],
    sample: 'María Pérez,V-12.345.678,a_salvo,Refugio Plaza Altamira',
    notes: 'estado: desaparecido · a_salvo · fallecido',
  },
  acopio: {
    kind: 'acopio', icon: '📦', label: 'Centros de acopio',
    columns: ['nombre', 'ubicacion', 'lat', 'lng', 'contacto', 'responsable'],
    sample: 'Acopio Plaza Bolívar,Chacao,10.4978,-66.8539,0412-1234567,Junta de Vecinos',
    notes: 'lat/lng en grados decimales · contacto y responsable son opcionales',
  },
  hospital: {
    kind: 'hospital', icon: '🏥', label: 'Hospitales',
    columns: ['nombre', 'ubicacion', 'lat', 'lng', 'contacto'],
    sample: 'Hospital Vargas,San José Libertador,10.5089,-66.9061,0212-5550000',
    notes: 'lat/lng en grados decimales · contacto es opcional',
  },
  edificio: {
    kind: 'edificio', icon: '🏚️', label: 'Edificios caídos',
    columns: ['nombre', 'ubicacion', 'lat', 'lng', 'nivel_dano', 'personas_atrapadas', 'estado'],
    sample: 'Residencias Tacagua,Catia Oeste,10.5050,-66.9400,colapsado,8,en_rescate',
    notes: 'nivel_dano: parcial · severo · colapsado | estado: reportado · en_rescate · despejado',
  },
};

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
            el OCR y la desduplicación corren en el servidor. (Solo personas.)
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
              <ng-container *ngTemplateOutlet="personasReview"></ng-container>
            }
          </div>
        }
      }

      @if (tab() === 'csv') {
        <!-- Selector de tipo de lista -->
        <div class="mb-3 grid grid-cols-4 gap-1.5">
          @for (s of specs; track s.kind) {
            <button (click)="setKind(s.kind)"
                    class="flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-bold transition ring-1"
                    [style.background]="csvKind()===s.kind ? 'var(--sheet)' : 'var(--chip-bg)'"
                    [style.color]="csvKind()===s.kind ? 'var(--txt)' : 'var(--txt-muted)'"
                    [style.--tw-ring-color]="csvKind()===s.kind ? 'var(--c-info)' : 'transparent'">
              <span class="text-lg leading-none">{{ s.icon }}</span>
              <span class="leading-tight text-center">{{ s.label }}</span>
            </button>
          }
        </div>

        @if (!hasRows()) {
          <!-- Ejemplo del formato esperado -->
          <div class="mb-3 rounded-xl p-3 ring-1 ring-white/10" style="background: var(--sheet-inset)">
            <div class="mb-1.5 flex items-center justify-between">
              <span class="text-[12px] font-bold" style="color: var(--txt)">Formato esperado · {{ spec().label }}</span>
              <button (click)="downloadTemplate()" class="text-[11px] font-bold" style="color: var(--c-info)">⬇ Plantilla</button>
            </div>
            <div class="text-[11px] font-semibold" style="color: var(--txt-muted)">Columnas (en orden):</div>
            <div class="mt-0.5 overflow-x-auto">
              <code class="block whitespace-nowrap text-[11px] font-bold" style="color: var(--c-info)">{{ spec().columns.join(', ') }}</code>
            </div>
            <div class="mt-2 text-[11px] font-semibold" style="color: var(--txt-muted)">Ejemplo de una fila:</div>
            <div class="mt-0.5 overflow-x-auto rounded-lg p-2" style="background: var(--bg)">
              <code class="block whitespace-nowrap text-[11px]" style="color: var(--txt)">{{ spec().sample }}</code>
            </div>
            <div class="mt-2 text-[10.5px] leading-relaxed font-medium" style="color: var(--txt-muted)">
              {{ spec().notes }}<br>
              La primera fila puede ser una cabecera con los nombres de columna (opcional).
              Si un campo contiene comas, enciérralo en comillas <code>"…"</code>.
            </div>
          </div>

          <!-- Dropzone CSV -->
          <label class="dropzone flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl
                        border-2 border-dashed border-white/20 bg-white/10 px-6 py-8 text-center transition shadow-sm hover:bg-white/15">
            <span class="text-4xl">📄</span>
            <span class="text-sm font-bold text-white">Selecciona un archivo CSV</span>
            <span class="text-xs font-medium text-white/60">{{ spec().icon }} {{ spec().label }}</span>
            <input type="file" accept=".csv,text/csv" class="hidden" (change)="onCsvPick($event)" />
          </label>
          @if (csvError()) {
            <div class="mt-3 rounded-xl bg-orange-950/40 p-3 text-[12px] font-semibold text-warn ring-1 ring-warn/30">{{ csvError() }}</div>
          }
        } @else {
          <div class="flex items-center gap-2 text-sm font-bold text-white bg-white/10 shadow-sm p-3 rounded-xl ring-1 ring-white/10 mb-2">
            <span>{{ spec().icon }}</span><span class="truncate">{{ fileName() }}</span>
            <span class="ml-auto text-[11px] text-white/60">{{ rowCount() }} filas</span>
          </div>
          @if (csvError()) {
            <div class="mb-2 rounded-xl bg-orange-950/40 p-2.5 text-[11px] font-semibold text-warn ring-1 ring-warn/30">{{ csvError() }}</div>
          }
          @if (csvKind() === 'personas') {
            <ng-container *ngTemplateOutlet="personasReview"></ng-container>
          } @else {
            <ng-container *ngTemplateOutlet="genericReview"></ng-container>
          }
        }
      }
      }

      <!-- Revisión de PERSONAS (OCR + CSV personas): tabla con dedup IA -->
      <ng-template #personasReview>
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
        <ng-container *ngTemplateOutlet="footer"></ng-container>
      </ng-template>

      <!-- Revisión GENÉRICA (acopio / hospital / edificio): tabla por columnas -->
      <ng-template #genericReview>
        <div class="overflow-x-auto rounded-xl ring-1 ring-white/10 shadow-sm mt-1">
          <table class="w-full text-left text-[11px]">
            <thead class="bg-white/10 text-white/60 font-semibold">
              <tr>@for (c of genCols(); track c.key) { <th class="px-3 py-2.5 whitespace-nowrap">{{ c.label }}</th> }</tr>
            </thead>
            <tbody class="divide-y divide-white/5 bg-white/5 text-white">
              @for (r of genRows(); track $index) {
                <tr class="hover:bg-white/5 transition">
                  @for (c of genCols(); track c.key) {
                    <td class="px-3 py-3 align-top" [class.font-semibold]="c.key==='nombre'">{{ cell(r, c.key) }}</td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
        <ng-container *ngTemplateOutlet="footer"></ng-container>
      </ng-template>

      <!-- Botonera compartida -->
      <ng-template #footer>
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

  readonly specs = Object.values(CSV_SPECS);

  // Gate de acceso (se pide cada vez que se abre la hoja).
  readonly unlocked = signal(false);
  readonly loginUser = signal('');
  readonly loginPass = signal('');
  readonly loginError = signal('');
  readonly loggingIn = signal(false);

  readonly tab = signal<Tab>('imagen');
  readonly csvKind = signal<CsvKind>('personas');
  readonly stage = signal<Stage>('idle');
  readonly over = signal(false);
  readonly fileName = signal('');
  readonly progress = signal(0);
  readonly scanText = signal('');
  readonly records = signal<OcrRecord[]>([]);              // personas (OCR + CSV)
  readonly genRows = signal<Array<NewCenterRow | NewBuildingRow>>([]); // otros tipos
  readonly saving = signal(false);
  readonly csvError = signal('');

  readonly spec = computed(() => CSV_SPECS[this.csvKind()]);
  readonly dupCount = computed(() => this.records().filter((r) => r.isDuplicate).length);
  readonly rowCount = computed(() =>
    this.csvKind() === 'personas' ? this.records().length : this.genRows().length,
  );
  readonly hasRows = computed(() => this.rowCount() > 0);

  /** Columnas de la tabla de revisión genérica según el tipo. */
  readonly genCols = computed<{ key: string; label: string }[]>(() => {
    switch (this.csvKind()) {
      case 'acopio':
      case 'hospital':
        return [
          { key: 'nombre', label: 'Nombre' },
          { key: 'ubicacion', label: 'Ubicación' },
          { key: 'coord', label: 'Coord.' },
          { key: 'contacto', label: 'Contacto' },
        ];
      case 'edificio':
        return [
          { key: 'nombre', label: 'Nombre' },
          { key: 'ubicacion', label: 'Ubicación' },
          { key: 'nivel_dano', label: 'Daño' },
          { key: 'personas_atrapadas', label: 'Atrap.' },
          { key: 'estado', label: 'Estado' },
        ];
      default:
        return [];
    }
  });

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

  setKind(k: CsvKind): void {
    this.csvKind.set(k);
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
      const objs = this.parseCsv(text, this.spec().columns);
      if (!objs.length) {
        this.csvError.set(`No se encontraron filas válidas. Revisa las columnas: ${this.spec().columns.join(', ')}.`);
        return;
      }
      if (this.csvKind() === 'personas') {
        const rows = objs.map((o) => this.toPersona(o)).filter((r): r is NonNullable<typeof r> => !!r);
        if (!rows.length) { this.csvError.set('Ninguna fila tiene nombre.'); return; }
        this.records.set(await this.data.analyzeOcrDuplicates(rows));
      } else if (this.csvKind() === 'edificio') {
        const { rows, skipped } = this.toBuildings(objs);
        if (!rows.length) { this.csvError.set('Ninguna fila válida (revisa nombre, lat y lng).'); return; }
        this.genRows.set(rows);
        if (skipped) this.csvError.set(`${skipped} fila(s) omitidas por datos inválidos (nombre/lat/lng).`);
      } else {
        const tipo: CenterType = this.csvKind() as CenterType; // 'acopio' | 'hospital'
        const { rows, skipped } = this.toCenters(objs, tipo);
        if (!rows.length) { this.csvError.set('Ninguna fila válida (revisa nombre, lat y lng).'); return; }
        this.genRows.set(rows);
        if (skipped) this.csvError.set(`${skipped} fila(s) omitidas por datos inválidos (nombre/lat/lng).`);
      }
    } catch {
      this.csvError.set('No se pudo leer el archivo CSV.');
    }
  }

  /** Quita acentos y pasa a minúsculas (para detectar cabeceras). */
  private norm(s: string): string {
    return s.toLowerCase().trim();
  }

  /** Divide una línea CSV respetando comillas dobles. */
  private splitCsvLine(line: string): string[] {
    const out: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else inQ = false;
        } else cur += ch;
      } else if (ch === '"') {
        inQ = true;
      } else if (ch === ',') {
        out.push(cur); cur = '';
      } else cur += ch;
    }
    out.push(cur);
    return out.map((c) => c.trim());
  }

  /**
   * Parser CSV genérico → filas como objetos keyados por columna. Detecta una
   * cabecera opcional (si la primera fila contiene algún nombre de columna
   * conocido); si no, mapea por posición según `cols`.
   */
  private parseCsv(text: string, cols: string[]): Record<string, string>[] {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return [];

    let order = cols.slice();
    let start = 0;
    const first = this.splitCsvLine(lines[0]).map((c) => this.norm(c));
    if (cols.some((c) => first.includes(c))) {
      order = first.map((c) => (c === 'cedula' || c === 'cédula' ? 'cedula' : c));
      start = 1;
    }

    const out: Record<string, string>[] = [];
    for (let i = start; i < lines.length; i++) {
      const cells = this.splitCsvLine(lines[i]);
      if (!cells.some((c) => c)) continue;
      const obj: Record<string, string> = {};
      order.forEach((key, idx) => { obj[key] = (cells[idx] ?? '').trim(); });
      out.push(obj);
    }
    return out;
  }

  private toPersona(
    o: Record<string, string>
  ): { nombre: string; cedula: string | null; estado: PersonStatus; ubicacion: string } | null {
    const nombre = (o['nombre'] ?? '').trim();
    if (!nombre) return null;
    const cedula = (o['cedula'] ?? '').trim();
    const estadoRaw = (o['estado'] ?? '').trim().toLowerCase();
    const estado = (VALID_ESTADOS as string[]).includes(estadoRaw)
      ? (estadoRaw as PersonStatus)
      : 'a_salvo';
    const ubicacion = (o['ubicacion'] ?? '').trim() || 'Carga CSV';
    return { nombre, cedula: cedula || null, estado, ubicacion };
  }

  private toCenters(
    objs: Record<string, string>[], tipo: CenterType
  ): { rows: NewCenterRow[]; skipped: number } {
    const rows: NewCenterRow[] = [];
    let skipped = 0;
    for (const o of objs) {
      const nombre = (o['nombre'] ?? '').trim();
      const lat = Number(o['lat']);
      const lng = Number(o['lng']);
      if (!nombre || !Number.isFinite(lat) || !Number.isFinite(lng)) { skipped++; continue; }
      rows.push({
        nombre,
        ubicacion: (o['ubicacion'] ?? '').trim() || 'Sin dirección',
        lat, lng, tipo,
        contacto: (o['contacto'] ?? '').trim() || null,
        responsable: (o['responsable'] ?? '').trim() || null,
      });
    }
    return { rows, skipped };
  }

  private toBuildings(
    objs: Record<string, string>[]
  ): { rows: NewBuildingRow[]; skipped: number } {
    const rows: NewBuildingRow[] = [];
    let skipped = 0;
    for (const o of objs) {
      const nombre = (o['nombre'] ?? '').trim();
      const lat = Number(o['lat']);
      const lng = Number(o['lng']);
      if (!nombre || !Number.isFinite(lat) || !Number.isFinite(lng)) { skipped++; continue; }
      const danoRaw = (o['nivel_dano'] ?? '').trim().toLowerCase();
      const estadoRaw = (o['estado'] ?? '').trim().toLowerCase();
      const atrap = Number(o['personas_atrapadas']);
      rows.push({
        nombre,
        ubicacion: (o['ubicacion'] ?? '').trim() || 'Sin dirección',
        lat, lng,
        nivel_dano: (VALID_DANO as string[]).includes(danoRaw) ? (danoRaw as DamageLevel) : undefined,
        estado: (VALID_EST_EDIF as string[]).includes(estadoRaw) ? (estadoRaw as BuildingStatus) : undefined,
        personas_atrapadas: Number.isFinite(atrap) && atrap >= 0 ? Math.floor(atrap) : undefined,
        contacto: (o['contacto'] ?? '').trim() || null,
      });
    }
    return { rows, skipped };
  }

  /** Valor a mostrar en la tabla genérica (incluye la columna sintética "coord"). */
  cell(row: NewCenterRow | NewBuildingRow, key: string): string {
    if (key === 'coord') {
      return `${row.lat.toFixed(4)}, ${row.lng.toFixed(4)}`;
    }
    const v = (row as unknown as Record<string, unknown>)[key];
    if (key === 'nivel_dano' && !v) return 'severo';
    if (key === 'estado' && !v) return 'reportado';
    if (key === 'personas_atrapadas' && (v == null)) return '0';
    return v == null || v === '' ? '—' : String(v);
  }

  /** Descarga una plantilla CSV (cabecera + fila de ejemplo) para el tipo actual. */
  downloadTemplate(): void {
    const s = this.spec();
    const content = `${s.columns.join(',')}\n${s.sample}\n`;
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plantilla_${s.kind}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // --- Guardar / reset ------------------------------------------------------
  async save(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      if (this.csvKind() === 'personas' || this.tab() === 'imagen') {
        const summary = await this.data.saveOcrRecords(this.records());
        this.ui.toast(`Lista procesada: ${summary.added} nuevos, ${summary.merged} unificados por IA.`, 'success', 6000);
      } else if (this.csvKind() === 'edificio') {
        const res = await this.data.saveBuildingsBatch(this.genRows() as NewBuildingRow[]);
        this.ui.toast(`Edificios caídos: ${res.added} añadidos, ${res.skipped} ya existían.`, 'success', 6000);
      } else {
        const res = await this.data.saveCentersBatch(this.genRows() as NewCenterRow[]);
        const tipoLbl = this.csvKind() === 'hospital' ? 'Hospitales' : 'Centros de acopio';
        this.ui.toast(`${tipoLbl}: ${res.added} añadidos, ${res.skipped} ya existían.`, 'success', 6000);
      }
      this.reset();
      this.ui.close();
    } catch {
      this.ui.toast('No se pudo guardar la lista. Intenta de nuevo.', 'alert', 5000);
    } finally {
      this.saving.set(false);
    }
  }

  reset(): void {
    this.stage.set('idle');
    this.progress.set(0);
    this.scanText.set('');
    this.records.set([]);
    this.genRows.set([]);
  }

  chip = (s: any) => STATUS_CHIP[s as keyof typeof STATUS_CHIP];
  label = (s: any) => STATUS_LABEL[s as keyof typeof STATUS_LABEL];
}
