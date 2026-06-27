import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BottomSheetComponent } from '../../shared/bottom-sheet/bottom-sheet.component';
import { CrisisDataService } from '../../core/services/crisis-data.service';
import { UiService } from '../../core/services/ui.service';
import { BuildingStatus, DamageLevel } from '../../core/models/models';
import { BUILDING_STATUS_LABEL, DAMAGE_LABEL, buildingStatusColor, damageColor } from '../../core/util/labels';
import { PLACES } from '../../core/data/places';

/**
 * Formulario para reportar un edificio afectado (estructura dañada/colapsada):
 * referencia, ubicación (con autocompletado + GPS), nivel de daño, estado del
 * rescate, personas atrapadas y contacto. La ubicación se resuelve a lat/lng
 * igual que en el reporte de personas.
 */
@Component({
  selector: 'app-report-building-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, BottomSheetComponent],
  template: `
    <app-bottom-sheet title="Reportar edificio afectado"
                      subtitle="Estructura dañada o colapsada"
                      icon="🏚️"
                      accentBg="bg-alertbg text-alert"
                      (close)="ui.close()">

      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-3">

        <!-- Referencia / nombre del edificio -->
        <label class="block">
          <span class="text-xs font-semibold text-textmuted ml-1">Referencia del edificio *</span>
          <input formControlName="nombre" type="text" autocomplete="off" placeholder="Ej: Residencias Tacagua, Torre B"
                 class="mt-1.5 w-full rounded-xl bg-white px-4 py-3 text-sm font-medium text-textmain ring-1 ring-borderlight shadow-sm outline-none focus:ring-info placeholder:text-textmuted transition" />
          @if (invalid('nombre')) { <span class="text-[11px] font-semibold text-alert ml-1 mt-1 block">Indica una referencia (mínimo 2 caracteres).</span> }
        </label>

        <!-- Ubicación: autocompletado + GPS -->
        <div class="relative">
          <span class="text-xs font-semibold text-textmuted ml-1 block mb-1.5">Ubicación *</span>
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

        <!-- Nivel de daño -->
        <div class="block">
          <span class="text-xs font-semibold text-textmuted ml-1 block mb-1.5">Nivel de daño *</span>
          <div class="grid grid-cols-3 gap-2">
            @for (lvl of levels; track lvl) {
              <button type="button" (click)="nivelDano.set(lvl)"
                      class="rounded-xl py-2.5 text-[13px] font-bold ring-1 transition active:scale-95"
                      [style.background]="nivelDano() === lvl ? damageColor(lvl) : '#fff'"
                      [style.color]="nivelDano() === lvl ? '#fff' : 'var(--txt-muted)'"
                      [style.--tw-ring-color]="nivelDano() === lvl ? damageColor(lvl) : 'var(--borderlight, rgba(0,0,0,.08))'">
                {{ damageLabel(lvl) }}
              </button>
            }
          </div>
        </div>

        <!-- Estado del rescate -->
        <div class="block">
          <span class="text-xs font-semibold text-textmuted ml-1 block mb-1.5">Estado del rescate *</span>
          <div class="grid grid-cols-3 gap-2">
            @for (st of states; track st) {
              <button type="button" (click)="estado.set(st)"
                      class="rounded-xl py-2.5 text-[13px] font-bold ring-1 transition active:scale-95"
                      [style.background]="estado() === st ? buildingStatusColor(st) : '#fff'"
                      [style.color]="estado() === st ? '#fff' : 'var(--txt-muted)'"
                      [style.--tw-ring-color]="estado() === st ? buildingStatusColor(st) : 'var(--borderlight, rgba(0,0,0,.08))'">
                {{ statusLabel(st) }}
              </button>
            }
          </div>
        </div>

        <!-- Personas atrapadas + contacto -->
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="text-xs font-semibold text-textmuted ml-1">Personas atrapadas</span>
            <input formControlName="personas_atrapadas" type="number" min="0" max="100000"
                   class="mt-1.5 w-full rounded-xl bg-white px-4 py-3 text-sm font-medium text-textmain ring-1 ring-borderlight shadow-sm outline-none focus:ring-info transition" />
          </label>
          <label class="block">
            <span class="text-xs font-semibold text-textmuted ml-1">Contacto</span>
            <input formControlName="contacto" type="text" autocomplete="off" placeholder="Coordinador / reportante"
                   class="mt-1.5 w-full rounded-xl bg-white px-4 py-3 text-sm font-medium text-textmain ring-1 ring-borderlight shadow-sm outline-none focus:ring-info placeholder:text-textmuted transition" />
          </label>
        </div>

        <button type="submit" [disabled]="form.invalid || saving()"
                class="w-full rounded-2xl py-3.5 mt-2 text-sm font-bold text-white shadow-md transition active:scale-[.98] disabled:opacity-50"
                style="background: linear-gradient(135deg, #f59e0b, #f97316); box-shadow: 0 4px 16px rgba(245,158,11,0.3)">
          {{ saving() ? 'Enviando…' : 'Publicar edificio afectado' }}
        </button>

        <p class="text-center text-[11px] font-medium text-textmuted">
          🔐 Validado en servidor y georreferenciado automáticamente.
        </p>
      </form>
    </app-bottom-sheet>
  `
})
export class ReportBuildingSheetComponent {
  private fb = inject(FormBuilder);
  data = inject(CrisisDataService);
  ui = inject(UiService);

  readonly places = PLACES;
  readonly levels: DamageLevel[] = ['parcial', 'severo', 'colapsado'];
  readonly states: BuildingStatus[] = ['reportado', 'en_rescate', 'despejado'];

  readonly saving = signal(false);
  readonly showSuggestions = signal(false);
  readonly nivelDano = signal<DamageLevel>('severo');
  readonly estado = signal<BuildingStatus>('reportado');

  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    place: ['', [Validators.required]],
    personas_atrapadas: [0 as number],
    contacto: ['']
  });

  damageLabel(d: DamageLevel): string { return DAMAGE_LABEL[d]; }
  statusLabel(s: BuildingStatus): string { return BUILDING_STATUS_LABEL[s]; }
  damageColor(d: DamageLevel): string { return damageColor(d); }
  buildingStatusColor(s: BuildingStatus): string { return buildingStatusColor(s); }

  filteredPlaces() {
    const term = this.form.controls.place.value.toLowerCase().trim();
    if (!term) return this.places;
    return this.places.filter((p) => p.name.toLowerCase().includes(term));
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
      navigator.geolocation.getCurrentPosition((pos) => {
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

      // Resolución de coordenadas (igual que el reporte de personas): si el
      // texto coincide con un lugar conocido, usa su coordenada con leve jitter;
      // si es "lat, lng", se parsea; si no, cae al primer lugar de la lista.
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

      const building = await this.data.reportBuilding({
        nombre: v.nombre.trim(),
        ubicacion: ubicacionFinal,
        lat,
        lng,
        nivel_dano: this.nivelDano(),
        estado: this.estado(),
        personas_atrapadas: Number(v.personas_atrapadas) || 0,
        contacto: v.contacto?.trim() || undefined
      });

      this.ui.toast('Edificio afectado publicado en el mapa 🏚️', 'warn');
      this.ui.focusOn({ lat: building.lat, lng: building.lng, id: building.id, zoom: 16 });
    } catch (e: any) {
      this.ui.toast('No se pudo enviar el reporte: ' + (e?.message ?? 'error'), 'alert');
    } finally {
      this.saving.set(false);
    }
  }
}
