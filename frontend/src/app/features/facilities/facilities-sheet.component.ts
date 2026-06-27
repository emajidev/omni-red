import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
import { BottomSheetComponent } from '../../shared/bottom-sheet/bottom-sheet.component';
import { PaginatorComponent } from '../../shared/paginator/paginator.component';
import { CrisisDataService } from '../../core/services/crisis-data.service';
import { UiService } from '../../core/services/ui.service';
import { CenterType, PersonReport, ReliefCenter } from '../../core/models/models';
import { STATUS_LABEL, statusColor } from '../../core/util/labels';

/**
 * Hoja reutilizable para Refugios u Hospitales (según `tipo`).
 * Vista 1: lista de sitios. Vista 2 (al tocar uno): personas en ese sitio,
 * con búsqueda por nombre/cédula y filtro por rango de edad.
 */
@Component({
  selector: 'app-facilities-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BottomSheetComponent, PaginatorComponent],
  template: `
    <app-bottom-sheet [title]="title()" [subtitle]="subtitle()"
                      [icon]="tipo === 'hospital' ? 'hospital' : '🏠'"
                      [accentBg]="tipo === 'hospital' ? 'bg-alertbg text-alert' : 'bg-safebg text-safe'"
                      (close)="ui.close()">

      @if (!selected()) {
        <!-- Lista de sitios -->
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          @for (f of pagedFacilities(); track f.id) {
            <button (click)="open(f)"
                    class="rounded-2xl p-4 text-left ring-1 active:scale-[.99] transition fade-in"
                    style="background: var(--sheet-inset); border-color: var(--glass-border); --tw-ring-color: var(--glass-border)">
              <div class="flex items-start justify-between gap-2">
                <span class="text-sm font-extrabold" style="color: var(--txt)">{{ f.nombre }}</span>
                <span class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style="background: var(--chip-bg); color: var(--txt)">{{ countFor(f.id) }} pers.</span>
              </div>
              <div class="mt-1 text-[13px] font-medium" style="color: var(--txt-muted)">📍 {{ f.ubicacion }}</div>
              @if (f.contacto) {
                <div class="mt-0.5 text-[12px] font-semibold" style="color: var(--c-info)">📞 {{ f.contacto }}</div>
              }
            </button>
          } @empty {
            <div class="col-span-full py-8 text-center text-sm" style="color: var(--txt-muted)">No hay {{ tipo === 'hospital' ? 'hospitales' : 'refugios' }} registrados.</div>
          }
        </div>

        <app-paginator [total]="facilities().length" [page]="fpage()" [pageSize]="fsize()"
                       (pageChange)="fpage.set($event)" (pageSizeChange)="onFSize($event)" />
      } @else {
        <!-- Personas dentro del sitio seleccionado -->
        <button (click)="selected.set(null)" class="mb-3 flex items-center gap-1 text-xs font-bold" style="color: var(--txt-muted)">
          ‹ Volver a la lista
        </button>
        <div class="mb-1 text-sm font-extrabold" style="color: var(--txt)">{{ selected()!.nombre }}</div>
        <div class="mb-3 text-[12px] font-medium" style="color: var(--txt-muted)">📍 {{ selected()!.ubicacion }}</div>

        <!-- Búsqueda -->
        <input type="text" [value]="query()" (input)="setQuery($any($event.target).value)"
               placeholder="Buscar por nombre o cédula…" autocomplete="off"
               class="w-full rounded-xl px-4 py-2.5 text-sm font-medium outline-none ring-1 transition"
               style="background: var(--sheet-inset); color: var(--txt); --tw-ring-color: var(--glass-border)" />

        <!-- Filtro por rango de edad -->
        <div class="mt-2 flex items-center gap-2">
          <span class="text-xs font-semibold" style="color: var(--txt-muted)">Edad</span>
          <input type="number" min="0" max="120" [value]="ageMin() ?? ''" (input)="setAgeMin($event)" placeholder="mín"
                 class="w-20 rounded-lg px-3 py-2 text-sm font-medium outline-none ring-1"
                 style="background: var(--sheet-inset); color: var(--txt); --tw-ring-color: var(--glass-border)" />
          <span class="text-xs" style="color: var(--txt-muted)">–</span>
          <input type="number" min="0" max="120" [value]="ageMax() ?? ''" (input)="setAgeMax($event)" placeholder="máx"
                 class="w-20 rounded-lg px-3 py-2 text-sm font-medium outline-none ring-1"
                 style="background: var(--sheet-inset); color: var(--txt); --tw-ring-color: var(--glass-border)" />
          <span class="ml-auto text-[11px] font-semibold" style="color: var(--txt-muted)">{{ filteredPeople().length }} pers.</span>
        </div>

        <!-- Lista de personas -->
        <ul class="mt-3 space-y-2">
          @for (p of pagedPeople(); track p.id) {
            <li>
              <button (click)="focus(p)" class="flex w-full items-center gap-3 rounded-xl p-3 text-left ring-1 transition active:scale-[.99]"
                      style="background: var(--sheet-inset); border-color: var(--glass-border); --tw-ring-color: var(--glass-border)">
                <span class="h-2.5 w-2.5 shrink-0 rounded-full" [style.background]="dot(p)"></span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-bold" style="color: var(--txt)">{{ p.nombre }}</span>
                  <span class="block truncate text-[12px]" style="color: var(--txt-muted)">
                    {{ p.cedula ?? 'Sin cédula' }}{{ p.edad != null ? ' · ' + p.edad + ' años' : '' }} · {{ label(p.estado) }}
                  </span>
                  @if (p.telefono_contacto) {
                    <span class="block text-[12px] font-semibold" style="color: var(--c-info)">📞 {{ p.telefono_contacto }}</span>
                  }
                </span>
              </button>
            </li>
          } @empty {
            <li class="py-6 text-center text-sm" style="color: var(--txt-muted)">Sin personas que coincidan.</li>
          }
        </ul>

        <app-paginator [total]="filteredPeople().length" [page]="ppage()" [pageSize]="psize()"
                       (pageChange)="ppage.set($event)" (pageSizeChange)="onPSize($event)" />
      }
    </app-bottom-sheet>
  `
})
export class FacilitiesSheetComponent {
  @Input({ required: true }) tipo!: CenterType;

  data = inject(CrisisDataService);
  ui = inject(UiService);

  readonly selected = signal<ReliefCenter | null>(null);
  readonly query = signal('');
  readonly ageMin = signal<number | null>(null);
  readonly ageMax = signal<number | null>(null);

  // Paginación (cliente): grilla de sitios + lista de personas del sitio
  readonly fpage = signal(1);
  readonly fsize = signal(20);
  readonly ppage = signal(1);
  readonly psize = signal(20);

  facilities = computed(() =>
    this.tipo === 'hospital' ? this.data.hospitales() : this.data.refugios()
  );

  readonly pagedFacilities = computed(() => {
    const s = (this.fpage() - 1) * this.fsize();
    return this.facilities().slice(s, s + this.fsize());
  });
  onFSize(n: number): void { this.fsize.set(n); this.fpage.set(1); }

  filteredPeople = computed(() => {
    const f = this.selected();
    if (!f) return [];
    const q = this.query().toLowerCase().trim();
    const min = this.ageMin();
    const max = this.ageMax();
    return this.data.people()
      .filter((p) => p.centro_id === f.id)
      .filter((p) => !q || p.nombre.toLowerCase().includes(q) || (p.cedula ?? '').toLowerCase().includes(q))
      .filter((p) => {
        const e = p.edad ?? null;
        if (min != null && (e == null || e < min)) return false;
        if (max != null && (e == null || e > max)) return false;
        return true;
      });
  });

  readonly pagedPeople = computed(() => {
    const s = (this.ppage() - 1) * this.psize();
    return this.filteredPeople().slice(s, s + this.psize());
  });
  onPSize(n: number): void { this.psize.set(n); this.ppage.set(1); }

  /** Cambios de filtro de personas → vuelven a la página 1. */
  setQuery(v: string): void { this.query.set(v); this.ppage.set(1); }
  setAgeMin(e: Event): void { this.ageMin.set(this.num(e)); this.ppage.set(1); }
  setAgeMax(e: Event): void { this.ageMax.set(this.num(e)); this.ppage.set(1); }

  title = () => (this.tipo === 'hospital' ? 'Hospitales' : 'Refugios');
  subtitle = () =>
    this.tipo === 'hospital'
      ? 'Personas atendidas por hospital'
      : 'Personas resguardadas por refugio';

  countFor(id: string): number {
    return this.data.people().filter((p) => p.centro_id === id).length;
  }

  open(f: ReliefCenter): void {
    this.selected.set(f);
    this.query.set('');
    this.ageMin.set(null);
    this.ageMax.set(null);
    this.ppage.set(1);
  }

  num(e: Event): number | null {
    const v = (e.target as HTMLInputElement).value;
    return v === '' ? null : Number(v);
  }

  dot(p: PersonReport): string {
    return statusColor(p.estado);
  }
  label(s: PersonReport['estado']): string {
    return STATUS_LABEL[s];
  }

  focus(p: PersonReport): void {
    this.ui.focusOn({ lat: p.lat, lng: p.lng, id: p.id, zoom: 15 });
  }
}
