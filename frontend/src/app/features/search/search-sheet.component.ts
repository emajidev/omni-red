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
                      icon="🔍" accentBg="bg-infobg text-info" (close)="ui.close()">

      <!-- Metrics -->
      <div class="grid grid-cols-3 gap-2">
        <div class="rounded-xl bg-appbg p-3 ring-1 ring-borderlight shadow-sm">
          <div class="text-2xl font-extrabold text-textmain animate-count-pop" [appCountUp]="m().total_reportados"></div>
          <div class="text-[11px] font-semibold text-textmuted">Reportados</div>
        </div>
        <div class="rounded-xl bg-alertbg p-3 ring-1 ring-alert/20 shadow-sm">
          <div class="text-2xl font-extrabold text-alert animate-count-pop" [appCountUp]="m().desaparecidos"></div>
          <div class="text-[11px] font-semibold text-alert">Desaparecidos</div>
        </div>
        <div class="rounded-xl bg-safebg p-3 ring-1 ring-safe/20 shadow-sm">
          <div class="text-2xl font-extrabold text-safe animate-count-pop" [appCountUp]="m().localizados"></div>
          <div class="text-[11px] font-semibold text-safe">A salvo</div>
        </div>
      </div>

      <div class="mt-3 flex items-center gap-2 rounded-xl bg-warnbg px-4 py-2.5 ring-1 ring-warn/30 shadow-sm">
        <span class="text-warn text-lg">⚠️</span>
        <span class="text-sm font-bold text-warn"><b [appCountUp]="m().criticos"></b> casos críticos</span>
        <span class="ml-auto text-[11px] font-medium text-warn/80">(2+ fuentes)</span>
      </div>

      <!-- Search box -->
      <div class="sticky top-0 z-10 -mx-1 mt-4 bg-surface pb-3 pt-1">
        <div class="flex items-center gap-2 rounded-xl bg-appbg px-4 shadow-sm ring-1 ring-borderlight focus-within:ring-info transition">
          <span class="text-textmuted">🔎</span>
          <input [ngModel]="ui.query()" (ngModelChange)="ui.query.set($event)"
                 type="search" inputmode="search" autocomplete="off"
                 placeholder="Ej: María, V-12.345.678, Catia…"
                 class="w-full bg-transparent py-3 text-sm font-medium text-textmain placeholder:text-textmuted outline-none" />
          @if (ui.query()) {
            <button (click)="ui.query.set('')" class="text-textmuted hover:text-textmain font-bold">✕</button>
          }
        </div>
        <p class="mt-2 px-2 text-[11px] font-semibold text-textmuted">{{ results().length }} resultado(s)</p>
      </div>

      <!-- Results -->
      <ul class="space-y-3">
        @for (p of results(); track p.id) {
          <li>
            <button (click)="focus(p)"
                    class="flex w-full items-start gap-3 rounded-xl bg-surface p-4 text-left shadow-sm
                           ring-1 ring-borderlight hover:bg-appbg active:scale-[.99] transition fade-in">
              <span class="mt-1 h-3 w-3 shrink-0 rounded-full shadow-sm"
                    [style.background]="p.estado === 'a_salvo' ? '#38A169' : p.estado === 'desaparecido' ? '#E53E3E' : '#718096'"></span>
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-2">
                  <span class="truncate text-sm font-bold text-textmain">{{ p.nombre }}</span>
                  <span class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" [class]="chip(p.estado)">{{ label(p.estado) }}</span>
                </span>
                <span class="mt-1 block truncate text-[13px] text-textmuted">{{ p.cedula ?? 'Sin cédula' }} · {{ p.ubicacion }}</span>
                <span class="mt-1 block text-[11px] font-semibold text-textmuted">{{ source(p.fuente) }} · {{ ago(p.created_at) }}{{ p.veces_reportado > 1 ? ' · ⚑ '+p.veces_reportado+' fuentes' : '' }}</span>
              </span>
              <span class="mt-2 text-textmuted font-bold">›</span>
            </button>
          </li>
        } @empty {
          <li class="rounded-xl bg-appbg p-8 text-center text-sm font-medium text-textmuted ring-1 ring-borderlight shadow-inner">
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
