import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { BottomSheetComponent } from '../../shared/bottom-sheet/bottom-sheet.component';
import { CrisisDataService } from '../../core/services/crisis-data.service';
import { UiService } from '../../core/services/ui.service';
import { CAPACITY_CHIP, CAPACITY_LABEL, timeAgo } from '../../core/util/labels';

/** Two tabs in one sheet: relief centers grid + seismic feed. */
@Component({
  selector: 'app-centers-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BottomSheetComponent],
  template: `
    <app-bottom-sheet title="Acopio y sismos" subtitle="Centros activos y últimas réplicas"
                      icon="📦" accentBg="bg-info/20 text-info" (close)="ui.close()">

      <!-- Tabs -->
      <div class="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-ink-700 p-1">
        <button (click)="tab.set('centers')"
                class="rounded-lg py-2 text-sm font-semibold transition"
                [class]="tab()==='centers' ? 'bg-info text-white' : 'text-slate-300'">
          📦 Centros ({{ data.centers().length }})
        </button>
        <button (click)="tab.set('quakes')"
                class="rounded-lg py-2 text-sm font-semibold transition"
                [class]="tab()==='quakes' ? 'bg-alert text-white' : 'text-slate-300'">
          🌐 Sismos ({{ data.quakes().length }})
        </button>
      </div>

      @if (tab() === 'centers') {
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          @for (c of data.centers(); track c.id) {
            <button (click)="focus(c)"
                    class="rounded-xl bg-ink-700/50 p-3 text-left ring-1 ring-ink-600 hover:bg-ink-700 active:scale-[.99] transition fade-in">
              <div class="flex items-start justify-between gap-2">
                <span class="text-sm font-semibold text-slate-100">{{ c.nombre }}</span>
                <span class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" [class]="cap(c.capacidad)">{{ capLabel(c.capacidad) }}</span>
              </div>
              <div class="mt-0.5 text-xs text-slate-400">📍 {{ c.ubicacion }}</div>
              <div class="mt-2 flex flex-wrap gap-1">
                @for (s of c.insumos_solicitados; track s) {
                  <span class="rounded-md bg-ink-600 px-1.5 py-0.5 text-[10px] text-slate-200">{{ s }}</span>
                } @empty {
                  <span class="text-[10px] text-slate-500">Sin solicitudes activas</span>
                }
              </div>
            </button>
          }
        </div>
      } @else {
        <ol class="relative space-y-3 border-l border-ink-600 pl-4">
          @for (q of data.quakes(); track q.id) {
            <li class="relative fade-in">
              <span class="absolute -left-[21px] top-1 grid h-3 w-3 place-items-center rounded-full"
                    [class]="q.magnitud >= 5 ? 'bg-alert' : q.magnitud >= 4 ? 'bg-warn' : 'bg-slate-500'"></span>
              <div class="flex items-baseline justify-between">
                <span class="text-sm font-bold"
                      [class]="q.magnitud >= 5 ? 'text-alert' : q.magnitud >= 4 ? 'text-warn' : 'text-slate-200'">
                  M {{ q.magnitud.toFixed(1) }}
                </span>
                <span class="text-[11px] text-slate-500">{{ ago(q.ocurrido_en) }}</span>
              </div>
              <div class="text-xs text-slate-300">{{ q.epicentro }}</div>
              <div class="text-[11px] text-slate-500">Prof. {{ q.profundidad_km }} km · {{ q.fuente }}</div>
            </li>
          }
        </ol>
      }
    </app-bottom-sheet>
  `
})
export class CentersSheetComponent {
  data = inject(CrisisDataService);
  ui = inject(UiService);

  readonly tab = signal<'centers' | 'quakes'>('centers');

  focus(c: { id: string; lat: number; lng: number }): void {
    this.ui.focusOn({ lat: c.lat, lng: c.lng, id: c.id, zoom: 14 });
  }

  cap = (c: any) => CAPACITY_CHIP[c as keyof typeof CAPACITY_CHIP];
  capLabel = (c: any) => CAPACITY_LABEL[c as keyof typeof CAPACITY_LABEL];
  ago = (iso: string) => timeAgo(iso);
}
