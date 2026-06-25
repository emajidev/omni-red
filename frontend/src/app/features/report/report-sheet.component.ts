import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators
} from '@angular/forms';
import { BottomSheetComponent } from '../../shared/bottom-sheet/bottom-sheet.component';
import { CrisisDataService } from '../../core/services/crisis-data.service';
import { UiService } from '../../core/services/ui.service';
import { PersonStatus } from '../../core/models/models';

/** Known localities → coordinates (avoids asking the user for lat/lng). */
const PLACES = [
  { name: 'Caracas — Centro', lat: 10.5061, lng: -66.9146 },
  { name: 'Caracas — Catia', lat: 10.5080, lng: -66.9480 },
  { name: 'Caracas — Petare', lat: 10.4760, lng: -66.8080 },
  { name: 'Caracas — Chacao', lat: 10.4970, lng: -66.8530 },
  { name: 'La Guaira — Maiquetía', lat: 10.5940, lng: -66.9870 },
  { name: 'Los Teques (Miranda)', lat: 10.3440, lng: -67.0410 },
  { name: 'Guarenas (Miranda)', lat: 10.4710, lng: -66.6110 },
  { name: 'Valencia (Carabobo)', lat: 10.1620, lng: -68.0080 },
  { name: 'Maracay (Aragua)', lat: 10.2470, lng: -67.5960 }
];

/** Optional cédula validator: empty is OK; otherwise must look like V-12.345.678. */
function cedulaValidator(c: AbstractControl): ValidationErrors | null {
  const v = (c.value ?? '').trim();
  if (!v) return null;
  return /^[VEJGvejg]-?\d{1,2}\.?\d{3}\.?\d{3}$/.test(v) ? null : { cedula: true };
}

@Component({
  selector: 'app-report-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, BottomSheetComponent],
  template: `
    <app-bottom-sheet [title]="isSafe() ? 'Reportar persona a salvo' : 'Reportar desaparecido'"
                      subtitle="Los datos se validan también en el servidor"
                      [icon]="isSafe() ? '🟢' : '🚨'"
                      [accentBg]="isSafe() ? 'bg-safe/20 text-safe' : 'bg-alert/20 text-alert'"
                      (close)="ui.close()">

      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-3">

        <!-- Status toggle -->
        <div class="grid grid-cols-2 gap-2">
          <button type="button" (click)="setStatus('desaparecido')"
                  class="rounded-xl py-2.5 text-sm font-bold ring-1 transition"
                  [class]="!isSafe() ? 'bg-alert text-white ring-alert' : 'bg-ink-700 text-slate-300 ring-ink-600'">
            🚨 Desaparecido
          </button>
          <button type="button" (click)="setStatus('a_salvo')"
                  class="rounded-xl py-2.5 text-sm font-bold ring-1 transition"
                  [class]="isSafe() ? 'bg-safe text-white ring-safe' : 'bg-ink-700 text-slate-300 ring-ink-600'">
            🟢 A salvo
          </button>
        </div>

        <!-- Name -->
        <label class="block">
          <span class="text-xs font-medium text-slate-400">Nombre completo *</span>
          <input formControlName="nombre" type="text" autocomplete="off"
                 class="mt-1 w-full rounded-xl bg-ink-700 px-3 py-2.5 text-sm text-slate-100 ring-1 ring-ink-600 outline-none focus:ring-info" />
          @if (invalid('nombre')) { <span class="text-[11px] text-alert">Indica un nombre (mínimo 3 caracteres).</span> }
        </label>

        <!-- Cédula + edad -->
        <div class="grid grid-cols-2 gap-2">
          <label class="block">
            <span class="text-xs font-medium text-slate-400">Cédula</span>
            <input formControlName="cedula" type="text" placeholder="V-12.345.678"
                   class="mt-1 w-full rounded-xl bg-ink-700 px-3 py-2.5 text-sm text-slate-100 ring-1 ring-ink-600 outline-none focus:ring-info" />
            @if (invalid('cedula')) { <span class="text-[11px] text-alert">Formato no válido.</span> }
          </label>
          <label class="block">
            <span class="text-xs font-medium text-slate-400">Edad</span>
            <input formControlName="edad" type="number" min="0" max="120"
                   class="mt-1 w-full rounded-xl bg-ink-700 px-3 py-2.5 text-sm text-slate-100 ring-1 ring-ink-600 outline-none focus:ring-info" />
          </label>
        </div>

        <!-- Location -->
        <label class="block">
          <span class="text-xs font-medium text-slate-400">Última ubicación conocida *</span>
          <select formControlName="place"
                  class="mt-1 w-full rounded-xl bg-ink-700 px-3 py-2.5 text-sm text-slate-100 ring-1 ring-ink-600 outline-none focus:ring-info">
            @for (pl of places; track pl.name) { <option [value]="pl.name">{{ pl.name }}</option> }
          </select>
        </label>

        <!-- Detail -->
        <label class="block">
          <span class="text-xs font-medium text-slate-400">Detalle / señas</span>
          <textarea formControlName="detalle" rows="2" maxlength="500"
                    placeholder="Ropa, condición médica, contexto…"
                    class="mt-1 w-full resize-none rounded-xl bg-ink-700 px-3 py-2.5 text-sm text-slate-100 ring-1 ring-ink-600 outline-none focus:ring-info"></textarea>
        </label>

        <button type="submit" [disabled]="form.invalid || saving()"
                class="w-full rounded-xl py-3 text-sm font-bold text-white transition active:scale-[.99] disabled:opacity-50"
                [class]="isSafe() ? 'bg-safe hover:brightness-110' : 'bg-alert hover:brightness-110'">
          {{ saving() ? 'Enviando…' : (isSafe() ? 'Registrar como a salvo' : 'Publicar desaparecido') }}
        </button>

        <p class="text-center text-[11px] text-slate-500">
          🔐 Enviado vía RPC <code>reportar_persona</code> (validación server-side + desduplicación).
        </p>
      </form>
    </app-bottom-sheet>
  `
})
export class ReportSheetComponent implements OnInit {
  private fb = inject(FormBuilder);
  private data = inject(CrisisDataService);
  ui = inject(UiService);

  readonly places = PLACES;
  readonly saving = signal(false);
  readonly status = signal<PersonStatus>('desaparecido');
  isSafe = () => this.status() === 'a_salvo';

  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    cedula: ['', [cedulaValidator]],
    edad: [null as number | null],
    place: [PLACES[0].name, [Validators.required]],
    detalle: ['']
  });

  ngOnInit(): void {
    this.status.set(this.ui.initialReportStatus());
  }

  setStatus(s: PersonStatus): void {
    this.status.set(s);
  }

  invalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  async submit(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    try {
      const v = this.form.getRawValue();
      const place = PLACES.find((p) => p.name === v.place) ?? PLACES[0];
      const res = await this.data.reportPerson({
        nombre: v.nombre,
        cedula: v.cedula?.trim() ? v.cedula.trim() : null,
        estado: this.status(),
        ubicacion: place.name,
        lat: place.lat + (Math.random() - 0.5) * 0.02,
        lng: place.lng + (Math.random() - 0.5) * 0.02,
        fuente: 'web',
        edad: v.edad ?? null,
        detalle: v.detalle?.trim() || null,
        reportado_por: 'autorreporte'
      });

      if (res.unificado) {
        this.ui.toast(`Reporte unificado con uno existente (desduplicación por IA). Confirmaciones: ${res.reporte.veces_reportado}.`, 'warn', 6000);
      } else {
        this.ui.toast(this.isSafe() ? 'Persona registrada como A SALVO 🟢' : 'Desaparecido publicado en el mapa 🚨',
          this.isSafe() ? 'success' : 'alert');
      }
      this.ui.focusOn({ lat: res.reporte.lat, lng: res.reporte.lng, id: res.reporte.id, zoom: 14 });
    } catch (e: any) {
      this.ui.toast('No se pudo enviar el reporte: ' + (e?.message ?? 'error'), 'alert');
    } finally {
      this.saving.set(false);
    }
  }
}
