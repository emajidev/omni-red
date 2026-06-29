import {
  ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal,
} from '@angular/core';
import { CrisisDataService } from '../../core/services/crisis-data.service';
import { UiService } from '../../core/services/ui.service';
import { CRISIS_SINCE } from '../../core/util/labels';

/**
 * Línea de tiempo de sismos: una barra arrastrable que va desde el inicio de la
 * crisis (24 jun) hasta el último sismo. Al mover el cursor, el mapa solo deja
 * los epicentros ocurridos hasta esa fecha (ver {@link UiService.timelineAt}),
 * así los sismos se van "colocando" en orden cronológico. Incluye reproducción
 * automática (play/pausa) y marcas por evento a lo largo de la barra.
 */
@Component({
  selector: 'app-timeline-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="timeline pointer-events-auto w-[min(94vw,560px)] rounded-2xl glass-bar px-3 py-2.5 fade-in">

      <!-- Cabecera: estado + cierre -->
      <div class="mb-1.5 flex items-center gap-2">
        <span class="grid h-5 w-5 place-items-center rounded-full" style="background: #3b82f6; color:#fff; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);">
          <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
             <circle cx="12" cy="12" r="9" /><path stroke-linecap="round" d="M12 8v4l2.5 2.5" />
          </svg>
        </span>
        <div class="min-w-0 flex-1 leading-tight">
          <div>Linea de tiempo · sismos </div>
          <div class="truncate text-[13px] font-extrabold" style="color: var(--txt)">{{ cursorLabel() }}</div>
          <div class="text-[10px] font-semibold" style="color: var(--txt-muted)">
            {{ shownCount() }} de {{ totalCount() }} sismos · desde el 24 jun
          </div>
        </div>
        <button (click)="showAll()" aria-label="Ver todos los sismos"
                class="grid h-7 w-7 place-items-center rounded-full transition active:scale-90"
                style="background: var(--chip-bg); color: var(--txt-muted)" title="Ver todos">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 5l7 7-7 7M13 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <!-- Controles: play + barra con marcas -->
      <div class="flex items-center gap-2.5">
        <button (click)="togglePlay()" [attr.aria-label]="playing() ? 'Pausar' : 'Reproducir'"
                class="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white transition hover:scale-105 active:scale-90"
                style="background: rgba(59, 130, 246, 0.75); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.2); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);">
          @if (playing()) {
            <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
          } @else {
            <svg class="h-4 w-4 translate-x-[1px]" fill="currentColor" viewBox="0 0 24 24"><path d="M7 5.5v13a1 1 0 001.5.87l11-6.5a1 1 0 000-1.74l-11-6.5A1 1 0 007 5.5z"/></svg>
          }
        </button>

        <div class="relative flex-1">
          <!-- Marcas: un punto por sismo, coloreado por magnitud -->
          <div class="pointer-events-none absolute inset-x-0 top-1/2 z-0 h-4 -translate-y-1/2">
            @for (t of ticks(); track $index) {
              <span class="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    [style.left.%]="t.pct" [style.background]="t.color"
                    [style.opacity]="t.ms <= cursorMs() ? '1' : '.28'"></span>
            }
          </div>
          <input type="range" class="timeline-range relative z-10 w-full"
                 [min]="minMs()" [max]="maxMs()" [step]="STEP"
                 [value]="cursorMs()"
                 (input)="onScrub($any($event.target).value)" />
        </div>
      </div>

      <!-- Extremos de la barra -->
      <div class="mt-1 flex justify-between text-[10px] font-semibold" style="color: var(--txt-muted)">
        <span>{{ shortDate(minMs()) }}</span>
        <span>{{ shortDate(maxMs()) }}</span>
      </div>
    </div>
  `,
  styles: [`
    .timeline-range {
      -webkit-appearance: none;
      appearance: none;
      height: 4px;
      border-radius: 9999px;
      background: var(--chip-bg);
      outline: none;
    }
    .timeline-range::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 20px;
      height: 20px;
      border-radius: 9999px;
      background: rgba(59, 130, 246, 0.7);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      border: 2px solid rgba(255, 255, 255, 0.9);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
      cursor: pointer;
      transition: transform 0.15s;
    }
    .timeline-range::-webkit-slider-thumb:hover {
      transform: scale(1.15);
    }
    .timeline-range::-moz-range-thumb {
      width: 20px;
      height: 20px;
      border-radius: 9999px;
      background: rgba(59, 130, 246, 0.7);
      backdrop-filter: blur(4px);
      border: 2px solid rgba(255, 255, 255, 0.9);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
      cursor: pointer;
      transition: transform 0.15s;
    }
    .timeline-range::-moz-range-thumb:hover {
      transform: scale(1.15);
    }
  `]
})
export class TimelineBarComponent implements OnDestroy {
  data = inject(CrisisDataService);
  ui = inject(UiService);

  /** Paso del slider: 5 minutos (suave sin ser excesivo para ~4-5 días). */
  readonly STEP = 5 * 60_000;

  /** Sismos de la crisis (desde el 24 jun), que es lo que ordena la línea. */
  private readonly crisisQuakes = computed(() =>
    this.data.quakes().filter((q) => +new Date(q.ocurrido_en) >= +CRISIS_SINCE),
  );

  /** Inicio de la barra: el comienzo de la crisis. */
  readonly minMs = computed(() => +CRISIS_SINCE);

  /** Fin de la barra: el último sismo (o ahora). Garantiza un rango no nulo. */
  readonly maxMs = computed(() => {
    let max = this.minMs();
    for (const q of this.crisisQuakes()) max = Math.max(max, +new Date(q.ocurrido_en));
    return Math.max(max, this.minMs() + 3_600_000);
  });

  readonly totalCount = computed(() => this.crisisQuakes().length);

  /**
   * Cursor recortado al rango [min, max]. El valor crudo arranca en "ahora"
   * (≥ último sismo) para que de inicio se vean TODOS; al recortarlo, la barra y
   * la etiqueta quedan en el extremo derecho en lugar de salirse de rango.
   */
  readonly cursorMs = computed(() =>
    Math.max(this.minMs(), Math.min(this.ui.timelineAt(), this.maxMs())),
  );

  /** Cuántos sismos están "colocados" hasta el cursor actual. */
  readonly shownCount = computed(
    () => this.crisisQuakes().filter((q) => +new Date(q.ocurrido_en) <= this.cursorMs()).length,
  );

  /** Marcas a lo largo de la barra: posición (%) + color por magnitud. */
  readonly ticks = computed(() => {
    const min = this.minMs();
    const span = this.maxMs() - min || 1;
    return this.crisisQuakes().map((q) => {
      const ms = +new Date(q.ocurrido_en);
      return {
        ms,
        pct: Math.max(0, Math.min(100, ((ms - min) / span) * 100)),
        color: this.magColor(q.magnitud),
      };
    });
  });

  /** Fecha + hora del cursor (etiqueta principal). */
  readonly cursorLabel = computed(() =>
    new Date(this.cursorMs()).toLocaleString('es-VE', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    }),
  );

  private rafId: number | null = null;
  readonly playing = signal(false);

  ngOnDestroy(): void {
    this.stop();
  }

  /** Lleva el cursor al final: muestra todos los sismos de la crisis. */
  showAll(): void {
    this.stop();
    this.ui.timelineAt.set(this.maxMs());
  }

  onScrub(value: string): void {
    this.stop(); // mover a mano cancela la reproducción
    this.ui.timelineAt.set(Number(value));
    this.isolateSismosLayer();
  }

  togglePlay(): void {
    if (this.playing()) { this.stop(); return; }

    const min = this.minMs();
    const max = this.maxMs();
    // Si está al final (o casi), reinicia desde el principio.
    const from = this.ui.timelineAt() >= max - this.STEP ? min : this.ui.timelineAt();
    const span = max - from;
    if (span <= 0) return;

    this.isolateSismosLayer();
    this.playing.set(true);
    const t0 = performance.now();
    const DURATION = 12_000; // recorre toda la crisis en ~12s
    let lastApplied = 0;
    const tick = (now: number): void => {
      if (!this.playing()) return;
      const frac = Math.min(1, (now - t0) / DURATION);
      // Aplica ~10 veces/seg (y al final): evita reconstruir la capa de sismos
      // del mapa a 60fps mientras avanza el cursor.
      if (frac >= 1 || now - lastApplied >= 100) {
        lastApplied = now;
        this.ui.timelineAt.set(Math.round(from + span * frac));
      }
      if (frac >= 1) { this.stop(); return; }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private isolateSismosLayer(): void {
    if (!this.ui.layers().sismos || this.ui.layers().personas) {
      this.ui.setAllLayers(false);
      // Ensure sismos is turned on since setAllLayers(false) turns it off
      setTimeout(() => {
        if (!this.ui.layers().sismos) {
          this.ui.toggleLayer('sismos');
        }
      }, 0);
    }
  }

  private stop(): void {
    this.playing.set(false);
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  shortDate(ms: number): string {
    return new Date(ms).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' });
  }

  /** Color del punto según magnitud (mismo criterio que el resto de la app). */
  private magColor(mag: number): string {
    return mag >= 5 ? 'var(--c-alert)' : mag >= 4 ? 'var(--c-warn)' : '#94a3b8';
  }
}
