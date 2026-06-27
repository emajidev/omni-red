import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BottomSheetComponent } from '../../shared/bottom-sheet/bottom-sheet.component';
import { PaginatorComponent } from '../../shared/paginator/paginator.component';
import { CrisisDataService } from '../../core/services/crisis-data.service';
import { UiService } from '../../core/services/ui.service';
import { CollapsedBuilding, DamageLevel } from '../../core/models/models';
import {
  BUILDING_STATUS_LABEL, DAMAGE_LABEL, DAMAGE_RANK,
  buildingStatusColor, damageColor
} from '../../core/util/labels';

/**
 * Hoja "Edificios afectados": lista de estructuras dañadas/colapsadas. Permite
 * filtrar por nivel de daño y al tocar una vuela el mapa hasta ella (abriendo su
 * popup). Los marcadores ya se dibujan siempre en el mapa (capa de edificios).
 */
@Component({
  selector: 'app-buildings-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BottomSheetComponent, PaginatorComponent],
  template: `
    <app-bottom-sheet title="Edificios afectados"
                      [subtitle]="subtitle()"
                      icon="🏚️"
                      accentBg="bg-alertbg text-alert"
                      (close)="ui.close()">

      <!-- CTA: reportar un edificio afectado -->
      <button (click)="ui.open('report-building')"
              class="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white transition active:scale-[.98]"
              style="background: linear-gradient(135deg, #f59e0b, #f97316); box-shadow: 0 4px 16px rgba(245,158,11,0.3)">
        <svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
        Reportar edificio afectado
      </button>

      <!-- Filtro por nivel de daño -->
      <div class="mb-3 flex flex-wrap gap-2">
        <button (click)="setFilter(null)"
                class="rounded-full px-3 py-1 text-[12px] font-bold ring-1 transition active:scale-95"
                [style.background]="filter() === null ? 'var(--active-bg)' : 'var(--chip-bg)'"
                [style.color]="filter() === null ? 'var(--active-fg)' : 'var(--txt-muted)'"
                style="--tw-ring-color: var(--glass-border)">
          Todos ({{ buildings().length }})
        </button>
        @for (lvl of levels; track lvl) {
          <button (click)="setFilter(lvl)"
                  class="rounded-full px-3 py-1 text-[12px] font-bold ring-1 transition active:scale-95"
                  [style.background]="filter() === lvl ? damageColor(lvl) + '22' : 'var(--chip-bg)'"
                  [style.color]="filter() === lvl ? damageColor(lvl) : 'var(--txt-muted)'"
                  style="--tw-ring-color: var(--glass-border)">
            {{ label(lvl) }} ({{ countFor(lvl) }})
          </button>
        }
      </div>

      <!-- Lista de edificios -->
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        @for (b of pagedBuildings(); track b.id) {
          <button (click)="focus(b)"
                  class="rounded-2xl p-4 text-left ring-1 active:scale-[.99] transition fade-in"
                  style="background: var(--sheet-inset); border-color: var(--glass-border); --tw-ring-color: var(--glass-border)">
            <div class="flex items-start justify-between gap-2">
              <span class="text-sm font-extrabold" style="color: var(--txt)">{{ b.nombre }}</span>
              <span class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                    [style.background]="damageColor(b.nivel_dano) + '22'"
                    [style.color]="damageColor(b.nivel_dano)">{{ label(b.nivel_dano) }}</span>
            </div>
            <div class="mt-1 text-[13px] font-medium" style="color: var(--txt-muted)">📍 {{ b.ubicacion }}</div>
            <div class="mt-1.5 flex items-center gap-3 text-[12px] font-semibold">
              <span [style.color]="statusColor(b)">● {{ statusLabel(b) }}</span>
              @if (b.personas_atrapadas > 0) {
                <span style="color: var(--c-alert)">⚑ {{ b.personas_atrapadas }} atrapada(s)</span>
              }
            </div>
            @if (b.contacto) {
              <div class="mt-0.5 text-[12px] font-semibold" style="color: var(--c-info)">📞 {{ b.contacto }}</div>
            }
          </button>
        } @empty {
          <div class="col-span-full py-8 text-center text-sm" style="color: var(--txt-muted)">No hay edificios afectados registrados.</div>
        }
      </div>

      <app-paginator [total]="filtered().length" [page]="page()" [pageSize]="size()"
                     (pageChange)="page.set($event)" (pageSizeChange)="onSize($event)" />
    </app-bottom-sheet>
  `
})
export class BuildingsSheetComponent {
  data = inject(CrisisDataService);
  ui = inject(UiService);

  readonly levels: DamageLevel[] = ['colapsado', 'severo', 'parcial'];
  readonly filter = signal<DamageLevel | null>(null);
  readonly page = signal(1);
  readonly size = signal(20);

  // Más graves primero; a igual gravedad, más personas atrapadas primero.
  readonly buildings = computed(() =>
    [...this.data.edificios()].sort((a, b) =>
      DAMAGE_RANK[a.nivel_dano] - DAMAGE_RANK[b.nivel_dano] ||
      b.personas_atrapadas - a.personas_atrapadas
    )
  );

  readonly filtered = computed(() => {
    const f = this.filter();
    return f ? this.buildings().filter((b) => b.nivel_dano === f) : this.buildings();
  });

  readonly pagedBuildings = computed(() => {
    const s = (this.page() - 1) * this.size();
    return this.filtered().slice(s, s + this.size());
  });

  readonly trappedTotal = computed(() =>
    this.buildings().reduce((n, b) => n + (b.estado !== 'despejado' ? b.personas_atrapadas : 0), 0)
  );

  subtitle = () => `${this.buildings().length} estructuras · ${this.trappedTotal()} personas atrapadas`;

  setFilter(f: DamageLevel | null): void { this.filter.set(f); this.page.set(1); }
  onSize(n: number): void { this.size.set(n); this.page.set(1); }

  countFor(lvl: DamageLevel): number {
    return this.buildings().filter((b) => b.nivel_dano === lvl).length;
  }

  label(d: DamageLevel): string { return DAMAGE_LABEL[d]; }
  statusLabel(b: CollapsedBuilding): string { return BUILDING_STATUS_LABEL[b.estado]; }
  damageColor(d: DamageLevel): string { return damageColor(d); }
  statusColor(b: CollapsedBuilding): string { return buildingStatusColor(b.estado); }

  focus(b: CollapsedBuilding): void {
    this.ui.focusOn({ lat: b.lat, lng: b.lng, id: b.id, zoom: 16 });
  }
}
