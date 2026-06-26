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
                      icon="hospital" accentBg="bg-infobg text-info" (close)="ui.close()">

      <!-- Tabs -->
      <div class="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-appbg p-1.5 shadow-inner ring-1 ring-borderlight">
        <button (click)="tab.set('centers')"
                class="rounded-xl py-2.5 text-sm font-bold transition shadow-sm"
                [class]="tab()==='centers' ? 'bg-surface text-info ring-1 ring-borderlight' : 'text-textmuted hover:bg-borderlight/50'">
          📦 Centros ({{ data.centers().length }})
        </button>
        <button (click)="tab.set('quakes')"
                class="rounded-xl py-2.5 text-sm font-bold transition shadow-sm"
                [class]="tab()==='quakes' ? 'bg-surface text-alert ring-1 ring-borderlight' : 'text-textmuted hover:bg-borderlight/50'">
          🌐 Sismos ({{ data.quakes().length }})
        </button>
      </div>

      @if (tab() === 'centers') {
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          @for (c of data.centers(); track c.id) {
            <button (click)="focus(c)"
                    class="rounded-2xl bg-surface p-4 text-left shadow-sm ring-1 ring-borderlight hover:bg-appbg/80 active:scale-[.99] transition fade-in">
              <div class="flex items-start justify-between gap-3">
                <span class="text-sm font-extrabold text-textmain">{{ c.nombre }}</span>
                <span class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm" [class]="cap(c.capacidad)">{{ capLabel(c.capacidad) }}</span>
              </div>
              <div class="mt-1 text-[13px] font-medium text-textmuted">📍 {{ c.ubicacion }}</div>
              <div class="mt-3 flex flex-wrap gap-1.5">
                @for (s of c.insumos_solicitados; track s) {
                  <span class="rounded-lg bg-borderlight px-2 py-1 text-[10px] font-bold text-textmain">{{ s }}</span>
                } @empty {
                  <span class="text-[11px] font-medium text-textmuted">Sin solicitudes activas</span>
                }
              </div>
            </button>
          }
        </div>
      } @else {
        <ol class="relative space-y-4 border-l-2 border-borderlight pl-5 ml-2 mt-2">
          @for (q of data.quakes(); track q.id) {
            <li class="relative fade-in">
              <span class="absolute -left-[27px] top-1 grid h-3.5 w-3.5 place-items-center rounded-full ring-4 ring-surface shadow-sm"
                    [class]="q.magnitud >= 5 ? 'bg-alert' : q.magnitud >= 4 ? 'bg-warn' : 'bg-textmuted'"></span>
              <div class="flex items-baseline justify-between bg-appbg/50 p-2.5 rounded-xl ring-1 ring-borderlight">
                <div class="flex flex-col">
                  <span class="text-sm font-extrabold"
                        [class]="q.magnitud >= 5 ? 'text-alert' : q.magnitud >= 4 ? 'text-warn' : 'text-textmain'">
                    M {{ q.magnitud.toFixed(1) }}
                  </span>
                  <span class="text-xs font-semibold text-textmain mt-0.5">{{ q.epicentro }}</span>
                  <span class="text-[11px] font-medium text-textmuted mt-0.5">Prof. {{ q.profundidad_km }} km · {{ q.fuente }}</span>
                </div>
                <span class="text-[11px] font-bold text-textmuted self-start">{{ ago(q.ocurrido_en) }}</span>
              </div>
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
