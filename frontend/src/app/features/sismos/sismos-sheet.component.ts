import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { BottomSheetComponent } from '../../shared/bottom-sheet/bottom-sheet.component';
import { CrisisDataService } from '../../core/services/crisis-data.service';
import { UiService } from '../../core/services/ui.service';
import { timeAgo } from '../../core/util/labels';

/** Histórico completo de sismos (todos los registrados, más recientes primero). */
@Component({
  selector: 'app-sismos-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BottomSheetComponent],
  template: `
    <app-bottom-sheet title="Histórico de sismos" subtitle="Todos los eventos registrados (USGS)"
                      icon="globe" accentBg="bg-warnbg text-warn" (close)="ui.close()">

      <ol class="relative space-y-3 border-l-2 pl-5 ml-2 mt-1" style="border-color: var(--divider)">
        @for (q of quakes(); track q.id) {
          <li class="relative fade-in">
            <span class="absolute -left-[27px] top-1.5 grid h-3.5 w-3.5 place-items-center rounded-full ring-4"
                  style="box-shadow:0 0 0 4px var(--sheet)"
                  [style.background]="dot(q.magnitud)"></span>
            <button (click)="focus(q)"
                    class="w-full text-left rounded-xl p-2.5 ring-1 transition active:scale-[.99]"
                    style="background: var(--sheet-inset); border-color: var(--glass-border)"
                    [style.--tw-ring-color]="'var(--glass-border)'">
              <div class="flex items-baseline justify-between gap-2">
                <span class="text-sm font-extrabold" [style.color]="dot(q.magnitud)">M {{ q.magnitud.toFixed(1) }}</span>
                <span class="text-[11px] font-bold" style="color: var(--txt-muted)">{{ ago(q.ocurrido_en) }}</span>
              </div>
              <div class="text-xs font-semibold mt-0.5" style="color: var(--txt)">{{ q.epicentro }}</div>
              <div class="text-[11px] font-medium mt-0.5" style="color: var(--txt-muted)">
                Prof. {{ q.profundidad_km }} km · {{ q.fuente }}
              </div>
            </button>
          </li>
        } @empty {
          <li class="text-sm" style="color: var(--txt-muted)">No hay sismos registrados.</li>
        }
      </ol>
    </app-bottom-sheet>
  `
})
export class SismosSheetComponent {
  data = inject(CrisisDataService);
  ui = inject(UiService);

  /** Todos los sismos, más recientes primero (la API ya ordena por fecha desc). */
  quakes = computed(() => this.data.quakes());

  dot(mag: number): string {
    return mag >= 5 ? 'var(--c-alert)' : mag >= 4 ? 'var(--c-warn)' : '#94a3b8';
  }

  ago = (iso: string) => timeAgo(iso);

  focus(q: { id: string; lat: number; lng: number }): void {
    this.ui.focusOn({ lat: q.lat, lng: q.lng, id: q.id, zoom: 9 });
  }
}
