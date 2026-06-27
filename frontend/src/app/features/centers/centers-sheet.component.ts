import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BottomSheetComponent } from '../../shared/bottom-sheet/bottom-sheet.component';
import { PaginatorComponent } from '../../shared/paginator/paginator.component';
import { CrisisDataService } from '../../core/services/crisis-data.service';
import { UiService } from '../../core/services/ui.service';
import { CAPACITY_CHIP, CAPACITY_LABEL } from '../../core/util/labels';
import { PLACES } from '../../core/data/places';

/** Acopio: lista de centros + formulario para registrar uno nuevo. */
@Component({
  selector: 'app-centers-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BottomSheetComponent, ReactiveFormsModule, PaginatorComponent],
  template: `
    <app-bottom-sheet title="Centros de acopio" subtitle="Puntos activos y registro de nuevos"
                      icon="hospital" accentBg="bg-infobg text-info" (close)="ui.close()">

      <!-- Tabs -->
      <div class="mb-4 grid grid-cols-2 gap-2 rounded-2xl p-1.5" style="background: var(--chip-bg)">
        <button (click)="tab.set('list')"
                class="rounded-xl py-2.5 text-sm font-bold transition"
                [style.background]="tab()==='list' ? 'var(--sheet)' : 'transparent'"
                [style.color]="tab()==='list' ? 'var(--txt)' : 'var(--txt-muted)'">
          📦 Centros ({{ data.acopios().length }})
        </button>
        <button (click)="tab.set('add')"
                class="rounded-xl py-2.5 text-sm font-bold transition"
                [style.background]="tab()==='add' ? 'var(--sheet)' : 'transparent'"
                [style.color]="tab()==='add' ? 'var(--txt)' : 'var(--txt-muted)'">
          ➕ Agregar
        </button>
      </div>

      @if (tab() === 'list') {
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          @for (c of pagedAcopios(); track c.id) {
            <button (click)="focus(c)"
                    class="rounded-2xl p-4 text-left ring-1 active:scale-[.99] transition fade-in"
                    style="background: var(--sheet-inset); border-color: var(--glass-border); --tw-ring-color: var(--glass-border)">
              <div class="flex items-start justify-between gap-3">
                <span class="text-sm font-extrabold" style="color: var(--txt)">{{ c.nombre }}</span>
                <span class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" [class]="cap(c.capacidad)">{{ capLabel(c.capacidad) }}</span>
              </div>
              <div class="mt-1 text-[13px] font-medium" style="color: var(--txt-muted)">📍 {{ c.ubicacion }}</div>
              @if (c.responsable) {
                <div class="mt-1 text-[12px] font-medium" style="color: var(--txt-muted)">👤 {{ c.responsable }}</div>
              }
              @if (c.contacto) {
                <div class="mt-0.5 text-[12px] font-semibold" style="color: var(--c-info)">📞 {{ c.contacto }}</div>
              }
              <div class="mt-3 flex flex-wrap gap-1.5">
                @for (s of c.insumos_solicitados; track s) {
                  <span class="rounded-lg px-2 py-1 text-[10px] font-bold" style="background: var(--chip-bg); color: var(--txt)">{{ s }}</span>
                } @empty {
                  <span class="text-[11px] font-medium" style="color: var(--txt-muted)">Sin solicitudes activas</span>
                }
              </div>
            </button>
          } @empty {
            <div class="col-span-full py-8 text-center text-sm" style="color: var(--txt-muted)">No hay centros registrados aún.</div>
          }
        </div>

        <app-paginator [total]="data.acopios().length" [page]="page()" [pageSize]="size()"
                       (pageChange)="page.set($event)" (pageSizeChange)="onSize($event)" />
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-3">
          <!-- Nombre del centro -->
          <label class="block">
            <span class="text-xs font-semibold ml-1" style="color: var(--txt-muted)">Nombre del centro *</span>
            <input formControlName="nombre" type="text" autocomplete="off" placeholder="Ej: Refugio Catia"
                   class="mt-1.5 w-full rounded-xl px-4 py-3 text-sm font-medium outline-none ring-1 transition"
                   style="background: var(--sheet-inset); color: var(--txt); --tw-ring-color: var(--glass-border)" />
            @if (invalid('nombre')) { <span class="text-[11px] font-semibold ml-1 mt-1 block" style="color: var(--c-alert)">Indica un nombre (mínimo 2 caracteres).</span> }
          </label>

          <!-- Responsable -->
          <label class="block">
            <span class="text-xs font-semibold ml-1" style="color: var(--txt-muted)">Nombre del responsable</span>
            <input formControlName="responsable" type="text" autocomplete="off" placeholder="Ej: María González"
                   class="mt-1.5 w-full rounded-xl px-4 py-3 text-sm font-medium outline-none ring-1 transition"
                   style="background: var(--sheet-inset); color: var(--txt); --tw-ring-color: var(--glass-border)" />
          </label>

          <!-- Ubicación -->
          <label class="block">
            <span class="text-xs font-semibold ml-1" style="color: var(--txt-muted)">Ubicación *</span>
            <select formControlName="place"
                    class="mt-1.5 w-full rounded-xl px-4 py-3 text-sm font-medium outline-none ring-1 transition"
                    style="background: var(--sheet-inset); color: var(--txt); --tw-ring-color: var(--glass-border)">
              <option value="" disabled>Selecciona una zona…</option>
              @for (pl of places; track pl.name) {
                <option [value]="pl.name">{{ pl.name }}</option>
              }
            </select>
            @if (invalid('place')) { <span class="text-[11px] font-semibold ml-1 mt-1 block" style="color: var(--c-alert)">Selecciona la ubicación.</span> }
          </label>

          <!-- Número de contacto -->
          <label class="block">
            <span class="text-xs font-semibold ml-1" style="color: var(--txt-muted)">Número de contacto</span>
            <input formControlName="contacto" type="tel" inputmode="tel" autocomplete="off" placeholder="Ej: 0212-555-1234"
                   class="mt-1.5 w-full rounded-xl px-4 py-3 text-sm font-medium outline-none ring-1 transition"
                   style="background: var(--sheet-inset); color: var(--txt); --tw-ring-color: var(--glass-border)" />
          </label>

          <button type="submit" [disabled]="form.invalid || saving()"
                  class="w-full rounded-2xl py-3.5 mt-2 text-sm font-bold text-white shadow-md transition active:scale-[.98] disabled:opacity-50 bg-gradient-to-tr from-blue-600 to-blue-400 shadow-[0_4px_16px_rgba(37,99,235,0.3)]">
            {{ saving() ? 'Guardando…' : 'Agregar centro de acopio' }}
          </button>
        </form>
      }
    </app-bottom-sheet>
  `
})
export class CentersSheetComponent {
  private fb = inject(FormBuilder);
  data = inject(CrisisDataService);
  ui = inject(UiService);

  readonly places = PLACES;
  readonly tab = signal<'list' | 'add'>('list');
  readonly saving = signal(false);

  // Paginación (cliente) de la lista de centros
  readonly page = signal(1);
  readonly size = signal(20);
  readonly pagedAcopios = computed(() => {
    const start = (this.page() - 1) * this.size();
    return this.data.acopios().slice(start, start + this.size());
  });
  onSize(n: number): void { this.size.set(n); this.page.set(1); }

  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    responsable: [''],
    place: ['', [Validators.required]],
    contacto: ['']
  });

  focus(c: { id: string; lat: number; lng: number }): void {
    this.ui.focusOn({ lat: c.lat, lng: c.lng, id: c.id, zoom: 14 });
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
      const center = await this.data.addCenter({
        nombre: v.nombre.trim(),
        ubicacion: v.place,
        lat: place.lat + (Math.random() - 0.5) * 0.01,
        lng: place.lng + (Math.random() - 0.5) * 0.01,
        contacto: v.contacto?.trim() || null,
        responsable: v.responsable?.trim() || null
      });
      this.ui.toast('Centro de acopio agregado 📦', 'success');
      this.form.reset({ nombre: '', responsable: '', place: '', contacto: '' });
      this.tab.set('list');
      this.ui.focusOn({ lat: center.lat, lng: center.lng, id: center.id, zoom: 14 });
    } catch (e: any) {
      this.ui.toast('No se pudo agregar el centro: ' + (e?.message ?? 'error'), 'alert');
    } finally {
      this.saving.set(false);
    }
  }

  cap = (c: any) => CAPACITY_CHIP[c as keyof typeof CAPACITY_CHIP];
  capLabel = (c: any) => CAPACITY_LABEL[c as keyof typeof CAPACITY_LABEL];
}
