import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BottomSheetComponent } from '../../shared/bottom-sheet/bottom-sheet.component';
import { CountUpDirective } from '../../shared/count-up.directive';
import { CrisisDataService } from '../../core/services/crisis-data.service';
import { UiService } from '../../core/services/ui.service';
import { SOURCE_LABEL, STATUS_CHIP, STATUS_LABEL, timeAgo } from '../../core/util/labels';

/**
 * Search + results sheet: real-time filter by name / cédula / location, plus
 * the animated critical metrics.
 */
@Component({
  selector: 'app-search-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, BottomSheetComponent, CountUpDirective],
  template: `
    <app-bottom-sheet title="Buscar personas" subtitle="Filtra por nombre, cédula o ubicación"
                      icon="🔍" accentBg="bg-info/20 text-info" (close)="ui.close()">

      <!-- Metrics -->
      <div class="grid grid-cols-3 gap-2">
        <div class="rounded-xl bg-ink-700/60 p-3 ring-1 ring-ink-600">
          <div class="text-2xl font-extrabold text-slate-100 animate-count-pop" [appCountUp]="m().total_reportados"></div>
          <div class="text-[11px] font-medium text-slate-400">Reportados</div>
        </div>
        <div class="rounded-xl bg-alert/10 p-3 ring-1 ring-alert/30">
          <div class="text-2xl font-extrabold text-alert animate-count-pop" [appCountUp]="m().desaparecidos"></div>
          <div class="text-[11px] font-medium text-alert/80">Desaparecidos</div>
        </div>
        <div class="rounded-xl bg-safe/10 p-3 ring-1 ring-safe/30">
          <div class="text-2xl font-extrabold text-safe animate-count-pop" [appCountUp]="m().localizados"></div>
          <div class="text-[11px] font-medium text-safe/80">A salvo</div>
        </div>
      </div>

      <div class="mt-2 flex items-center gap-2 rounded-xl bg-warn/10 px-3 py-2 ring-1 ring-warn/30">
        <span class="text-warn">⚠️</span>
        <span class="text-sm text-warn"><b [appCountUp]="m().criticos"></b> casos críticos</span>
        <span class="ml-auto text-[11px] text-slate-400">(2+ fuentes, sin localizar)</span>
      </div>

      <!-- Search box -->
      <div class="sticky top-0 z-10 -mx-1 mt-3 bg-ink-800 pb-2 pt-1">
        <div class="flex items-center gap-2 rounded-xl bg-ink-700 px-3 ring-1 ring-ink-600 focus-within:ring-info">
          <span class="text-slate-400">🔎</span>
          <input [ngModel]="ui.query()" (ngModelChange)="ui.query.set($event)"
                 type="search" inputmode="search" autocomplete="off"
                 placeholder="Ej: María, V-12.345.678, Catia…"
                 class="w-full bg-transparent py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none" />
          @if (ui.query()) {
            <button (click)="ui.query.set('')" class="text-slate-400 hover:text-slate-200">✕</button>
          }
        </div>
        <p class="mt-1 px-1 text-[11px] text-slate-500">{{ results().length }} resultado(s)</p>
      </div>

      <!-- Results -->
      <ul class="space-y-2">
        @for (p of results(); track p.id) {
          <li>
            <button (click)="focus(p)"
                    class="flex w-full items-start gap-3 rounded-xl bg-ink-700/50 p-3 text-left
                           ring-1 ring-ink-600 hover:bg-ink-700 active:scale-[.99] transition fade-in">
              <span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                    [style.background]="p.estado === 'a_salvo' ? '#22c55e' : p.estado === 'desaparecido' ? '#ef4444' : '#94a3b8'"></span>
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-2">
                  <span class="truncate text-sm font-semibold text-slate-100">{{ p.nombre }}</span>
                  <span class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" [class]="chip(p.estado)">{{ label(p.estado) }}</span>
                </span>
                <span class="mt-0.5 block truncate text-xs text-slate-400">{{ p.cedula ?? 'Sin cédula' }} · {{ p.ubicacion }}</span>
                <span class="mt-0.5 block text-[11px] text-slate-500">{{ source(p.fuente) }} · {{ ago(p.created_at) }}{{ p.veces_reportado > 1 ? ' · ⚑ '+p.veces_reportado+' fuentes' : '' }}</span>
              </span>
              <span class="mt-1 text-slate-500">›</span>
            </button>
          </li>
        } @empty {
          <li class="rounded-xl bg-ink-700/40 p-6 text-center text-sm text-slate-400">
            Sin coincidencias para “{{ ui.query() }}”.
          </li>
        }
      </ul>
    </app-bottom-sheet>
  `
})
export class SearchSheetComponent {
  data = inject(CrisisDataService);
  ui = inject(UiService);

  readonly m = this.data.metrics;

  readonly results = computed(() => {
    const q = this.norm(this.ui.query());
    const list = this.data.people();
    if (!q) return list;
    return list.filter((p) =>
      this.norm(p.nombre).includes(q) ||
      this.norm(p.cedula ?? '').includes(q) ||
      this.norm(p.ubicacion).includes(q)
    );
  });

  focus(p: { id: string; lat: number; lng: number }): void {
    this.ui.focusOn({ lat: p.lat, lng: p.lng, id: p.id, zoom: 15 });
  }

  chip = (s: any) => STATUS_CHIP[s as keyof typeof STATUS_CHIP];
  label = (s: any) => STATUS_LABEL[s as keyof typeof STATUS_LABEL];
  source = (s: any) => SOURCE_LABEL[s as keyof typeof SOURCE_LABEL];
  ago = (iso: string) => timeAgo(iso);

  private norm(s: string): string {
    return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
}
