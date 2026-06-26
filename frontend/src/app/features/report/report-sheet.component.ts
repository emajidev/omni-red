import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators
} from '@angular/forms';
import { BottomSheetComponent } from '../../shared/bottom-sheet/bottom-sheet.component';
import { CrisisDataService } from '../../core/services/crisis-data.service';
import { UiService } from '../../core/services/ui.service';
import { PersonStatus } from '../../core/models/models';
import { PLACES } from '../../core/data/places';

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
                       [icon]="isSafe() ? 'safe' : 'alert'"
                       [accentBg]="isSafe() ? 'bg-safebg text-safe' : 'bg-alertbg text-alert'"
                       (close)="ui.close()">

      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-3">

        <!-- Status toggle -->
        <div class="grid grid-cols-2 gap-2">
          <button type="button" (click)="setStatus('desaparecido')"
                  class="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold ring-1 shadow-sm transition-all"
                  [class]="!isSafe() ? 'bg-gradient-to-tr from-red-600 to-red-400 text-white ring-transparent shadow-[0_4px_16px_rgba(220,38,38,0.3)]' : 'bg-white text-slate-500 ring-black/5 hover:bg-slate-50'">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            Desaparecido
          </button>
          <button type="button" (click)="setStatus('a_salvo')"
                  class="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold ring-1 shadow-sm transition-all"
                  [class]="isSafe() ? 'bg-gradient-to-tr from-green-600 to-green-400 text-white ring-transparent shadow-[0_4px_16px_rgba(22,163,74,0.3)]' : 'bg-white text-slate-500 ring-black/5 hover:bg-slate-50'">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            A salvo
          </button>
        </div>

        <!-- Name -->
        <label class="block">
          <span class="text-xs font-semibold text-textmuted ml-1">Nombre completo *</span>
          <input formControlName="nombre" type="text" autocomplete="off"
                 class="mt-1.5 w-full rounded-xl bg-white px-4 py-3 text-sm font-medium text-textmain ring-1 ring-borderlight shadow-sm outline-none focus:ring-info transition" />
          @if (invalid('nombre')) { <span class="text-[11px] font-semibold text-alert ml-1 mt-1 block">Indica un nombre (mínimo 3 caracteres).</span> }
        </label>

        <!-- Cédula + edad -->
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="text-xs font-semibold text-textmuted ml-1">Cédula</span>
            <input formControlName="cedula" type="text" placeholder="V-12.345.678"
                   class="mt-1.5 w-full rounded-xl bg-white px-4 py-3 text-sm font-medium text-textmain ring-1 ring-borderlight shadow-sm outline-none focus:ring-info placeholder:text-textmuted transition" />
            @if (invalid('cedula')) { <span class="text-[11px] font-semibold text-alert ml-1 mt-1 block">Formato no válido.</span> }
          </label>
          <label class="block">
            <span class="text-xs font-semibold text-textmuted ml-1">Edad</span>
            <input formControlName="edad" type="number" min="0" max="120"
                   class="mt-1.5 w-full rounded-xl bg-white px-4 py-3 text-sm font-medium text-textmain ring-1 ring-borderlight shadow-sm outline-none focus:ring-info transition" />
          </label>
        </div>

        <!-- Teléfono de contacto -->
        <label class="block">
          <span class="text-xs font-semibold text-textmuted ml-1">Teléfono de contacto</span>
          <input formControlName="telefono" type="tel" inputmode="tel" autocomplete="off" placeholder="Ej: 0414-555-1234"
                 class="mt-1.5 w-full rounded-xl bg-white px-4 py-3 text-sm font-medium text-textmain ring-1 ring-borderlight shadow-sm outline-none focus:ring-info placeholder:text-textmuted transition" />
        </label>

        <!-- Location Custom Autocomplete -->
        <div class="relative">
          <span class="text-xs font-semibold text-textmuted ml-1 block mb-1.5">Última ubicación conocida *</span>
          <div class="flex gap-2 relative">
            <input formControlName="place" type="text" placeholder="Escribe para buscar (Ej: Caracas)..." autocomplete="off"
                   (focus)="showSuggestions.set(true)"
                   (blur)="hideSuggestionsWithDelay()"
                   class="w-full rounded-xl bg-white px-4 py-3 text-sm font-medium text-textmain ring-1 ring-borderlight shadow-sm outline-none focus:ring-info transition" />
            <button type="button" (click)="useCurrentLocation()" class="rounded-xl bg-appbg px-3 py-3 text-sm font-medium ring-1 ring-borderlight shadow-inner hover:bg-borderlight transition" title="Usar ubicación actual">📍</button>
          </div>
          
          @if (showSuggestions() && filteredPlaces().length > 0) {
            <ul class="absolute z-10 w-[calc(100%-3.5rem)] mt-1 max-h-48 overflow-auto rounded-xl bg-white ring-1 ring-black/5 shadow-xl animate-fade-in divide-y divide-black/5">
              @for (pl of filteredPlaces(); track pl.name) {
                <li (mousedown)="selectPlace(pl.name); $event.preventDefault()" 
                    class="px-4 py-3 text-sm cursor-pointer hover:bg-slate-50 transition font-medium text-slate-700 active:bg-slate-100">
                  {{ pl.name }}
                </li>
              }
            </ul>
          }
        </div>

        <!-- Hospital / Refugio (si la persona está en uno) -->
        <label class="block">
          <span class="text-xs font-semibold text-textmuted ml-1">Hospital / Refugio (si aplica)</span>
          <select formControlName="centro"
                  class="mt-1.5 w-full rounded-xl bg-white px-4 py-3 text-sm font-medium text-textmain ring-1 ring-borderlight shadow-sm outline-none focus:ring-info transition">
            <option value="">— Ninguno —</option>
            <optgroup label="Hospitales">
              @for (h of data.hospitales(); track h.id) { <option [value]="h.id">{{ h.nombre }}</option> }
            </optgroup>
            <optgroup label="Refugios">
              @for (r of data.refugios(); track r.id) { <option [value]="r.id">{{ r.nombre }}</option> }
            </optgroup>
          </select>
        </label>

        <!-- Detail -->
        <label class="block">
          <span class="text-xs font-semibold text-textmuted ml-1">Detalle / señas</span>
          <textarea formControlName="detalle" rows="2" maxlength="500"
                    placeholder="Ropa, condición médica, contexto…"
                    class="mt-1.5 w-full resize-none rounded-xl bg-white px-4 py-3 text-sm font-medium text-textmain ring-1 ring-borderlight shadow-sm outline-none focus:ring-info placeholder:text-textmuted transition"></textarea>
        </label>

        <!-- Photo Upload -->
        <label class="block">
          <span class="text-xs font-semibold text-textmuted ml-1 block mb-1.5">Foto de la persona (Opcional)</span>
          <div class="flex items-center gap-3">
            @if (fotoPreview()) {
              <div class="relative h-16 w-16 shrink-0 rounded-xl overflow-hidden ring-1 ring-borderlight shadow-sm">
                <img [src]="fotoPreview()" class="h-full w-full object-cover" />
                <button type="button" (click)="removePhoto()" class="absolute top-1 right-1 h-5 w-5 bg-black/50 text-white rounded-full text-xs font-bold flex items-center justify-center hover:bg-black/70">✕</button>
              </div>
            }
            <label class="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-borderlight bg-white px-4 py-3 text-sm font-medium text-textmuted hover:bg-slate-50 transition shadow-sm">
              <span class="text-lg">📷</span> 
              <span>{{ fotoPreview() ? 'Cambiar foto' : 'Seleccionar imagen' }}</span>
              <input type="file" accept="image/*" class="hidden" (change)="onPhotoPick($event)" />
            </label>
          </div>
        </label>

        <button type="submit" [disabled]="form.invalid || saving()"
                class="w-full rounded-2xl py-3.5 mt-2 text-sm font-bold text-white shadow-md transition active:scale-[.98] disabled:opacity-50"
                [class]="isSafe() ? 'bg-gradient-to-tr from-green-600 to-green-400 shadow-[0_4px_16px_rgba(22,163,74,0.3)]' : 'bg-gradient-to-tr from-red-600 to-red-400 shadow-[0_4px_16px_rgba(220,38,38,0.3)]'">
          {{ saving() ? 'Enviando…' : (isSafe() ? 'Registrar como a salvo' : 'Publicar desaparecido') }}
        </button>

        <p class="text-center text-[11px] font-medium text-textmuted">
          🔐 Validado en servidor vía Supabase RPC y geolocalizado automáticamente.
        </p>
      </form>
    </app-bottom-sheet>
  `
})
export class ReportSheetComponent implements OnInit {
  private fb = inject(FormBuilder);
  data = inject(CrisisDataService);
  ui = inject(UiService);

  readonly places = PLACES;
  readonly saving = signal(false);
  readonly status = signal<PersonStatus>('desaparecido');
  isSafe = () => this.status() === 'a_salvo';
  
  readonly showSuggestions = signal(false);
  readonly fotoPreview = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    cedula: ['', [cedulaValidator]],
    edad: [null as number | null],
    telefono: [''],
    place: ['', [Validators.required]],
    centro: [''],
    detalle: ['']
  });

  ngOnInit(): void {
    this.status.set(this.ui.initialReportStatus());
  }

  setStatus(s: PersonStatus): void {
    this.status.set(s);
  }

  onPhotoPick(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => this.fotoPreview.set(reader.result as string);
      reader.readAsDataURL(file);
    }
  }

  removePhoto(): void {
    this.fotoPreview.set(null);
  }

  filteredPlaces() {
    const term = this.form.controls.place.value.toLowerCase().trim();
    if (!term) return this.places;
    return this.places.filter(p => p.name.toLowerCase().includes(term));
  }

  hideSuggestionsWithDelay() {
    setTimeout(() => this.showSuggestions.set(false), 200);
  }

  selectPlace(name: string) {
    this.form.controls.place.setValue(name);
    this.showSuggestions.set(false);
  }

  invalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  useCurrentLocation(): void {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(pos => {
        const lat = pos.coords.latitude.toFixed(5);
        const lng = pos.coords.longitude.toFixed(5);
        this.form.patchValue({ place: `${lat}, ${lng}` });
      }, () => {
        this.ui.toast('No se pudo obtener la ubicación. Permite el acceso.', 'alert');
      });
    } else {
      this.ui.toast('Geolocalización no soportada', 'alert');
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    try {
      const v = this.form.getRawValue();
      
      let lat = PLACES[0].lat + (Math.random() - 0.5) * 0.02;
      let lng = PLACES[0].lng + (Math.random() - 0.5) * 0.02;
      let ubicacionFinal = v.place;

      const matchedPlace = PLACES.find((p) => p.name === v.place);
      if (matchedPlace) {
        lat = matchedPlace.lat + (Math.random() - 0.5) * 0.02;
        lng = matchedPlace.lng + (Math.random() - 0.5) * 0.02;
      } else {
        const match = /^([-\d.]+),\s*([-\d.]+)$/.exec(v.place);
        if (match) {
          lat = parseFloat(match[1]);
          lng = parseFloat(match[2]);
          ubicacionFinal = 'Ubicación seleccionada (GPS)';
        }
      }

      const res = await this.data.reportPerson({
        nombre: v.nombre,
        cedula: v.cedula?.trim() ? v.cedula.trim() : null,
        estado: this.status(),
        ubicacion: ubicacionFinal,
        lat: lat,
        lng: lng,
        fuente: 'web',
        edad: v.edad ?? null,
        telefono_contacto: v.telefono?.trim() || null,
        detalle: v.detalle?.trim() || null,
        reportado_por: 'autorreporte',
        foto_url: this.fotoPreview()
      });

      // Si se indicó hospital/refugio, vincular la persona a ese sitio.
      if (v.centro) {
        try { await this.data.assignPersonCenter(res.reporte.id, v.centro); } catch { /* no bloquea el reporte */ }
      }

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
