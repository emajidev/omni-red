import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CrisisDataService } from '../../core/services/crisis-data.service';
import { UiService } from '../../core/services/ui.service';
import { ConnectionService } from '../../core/services/connection.service';
import { CountUpDirective } from '../../shared/count-up.directive';

/**
 * Vista LIGERA (sin mapa) para conexiones lentas o para quien prefiera lo
 * esencial: cabecera, acciones primordiales (buscar / reportar) y métricas.
 * Inspirada en una landing sobria de emergencia. Las acciones abren las mismas
 * hojas que el resto de la app (no dependen del mapa).
 */
@Component({
  selector: 'app-lite-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CountUpDirective],
  template: `
    <div class="lite min-h-[100dvh] w-full overflow-y-auto" style="background: var(--bg); color: var(--txt)">

      <!-- Cabecera -->
      <header class="sticky top-0 z-10 border-b backdrop-blur"
              style="border-color: var(--divider); background: color-mix(in srgb, var(--bg) 86%, transparent)">
        <div class="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div class="flex items-center gap-2.5">
            <svg class="h-[22px] w-[32px] rounded-sm shadow-sm" viewBox="0 0 90 60" xmlns="http://www.w3.org/2000/svg">
              <rect width="90" height="20" fill="#FCE300"/><rect y="20" width="90" height="20" fill="#0038A8"/><rect y="40" width="90" height="20" fill="#CE1126"/>
            </svg>
            <div class="leading-tight">
              <div class="text-[15px] font-black tracking-tight">SomosUnoVzla</div>
              <div class="text-[11px] font-semibold" style="color: var(--txt-muted)">Terremoto Venezuela</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button (click)="ui.toggleTheme()" aria-label="Cambiar tema"
                    class="grid h-9 w-9 place-items-center rounded-full" style="background: var(--chip-bg); color: var(--txt)">
              @if (ui.theme() === 'dark') {
                <svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><circle cx="12" cy="12" r="4"/><path stroke-linecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"/></svg>
              } @else {
                <svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
              }
            </button>
            <!-- Cambiar a versión full (con mapa) -->
            <button (click)="conn.setMode('full')"
                    class="flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold transition active:scale-95"
                    style="background: var(--c-info); color:#fff">
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7"/></svg>
              Versión full
            </button>
          </div>
        </div>
      </header>

      <main class="mx-auto max-w-3xl px-4 pb-20 pt-7">
        <!-- Eyebrow -->
        <div class="mb-3 flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-wider" style="color: var(--c-alert)">
          <span class="relative flex h-2 w-2">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style="background: var(--c-alert)"></span>
            <span class="relative inline-flex h-2 w-2 rounded-full" style="background: var(--c-alert)"></span>
          </span>
          Emergencia · Sismo del 24 de junio
        </div>

        <!-- Hero -->
        <h1 class="lite-title font-black tracking-tight">Reconectemos a cada familia.</h1>
        <p class="mt-4 max-w-xl text-[15px] leading-relaxed" style="color: var(--txt-muted)">
          Tras el terremoto, muchas familias siguen sin saber de los suyos. Busca a alguien en el padrón,
          márcalo como localizado si lo reconoces, o repórtalo si no logras comunicarte.
        </p>

        @if (conn.detectedSlow()) {
          <div class="mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-[12px] font-semibold"
               style="background: var(--chip-bg); color: var(--txt-muted)">
            <span>⚡</span>
            <span>Detectamos una conexión lenta: activamos esta vista ligera (sin mapa) para que cargue más rápido.</span>
          </div>
        }

        <!-- Acciones primordiales -->
        <div class="mt-6 grid gap-3 sm:grid-cols-3">
          <button (click)="ui.open('search')" class="lite-action" style="background: var(--c-info); color:#fff">
            <span class="lite-action-title">🔍 Buscar persona</span>
            <span class="lite-action-sub">¿La reconoces en un hospital, refugio o centro? Identifícala.</span>
          </button>

          <button (click)="ui.openReport('desaparecido')" class="lite-action lite-action--outline" style="color: var(--c-alert)">
            <span class="lite-action-title">＋ Reportar desaparecido</span>
            <span class="lite-action-sub">Solo necesitas su nombre y dónde se le vio por última vez.</span>
          </button>

          <button (click)="ui.openReport('encontrado')" class="lite-action" style="background: var(--c-safe); color:#fff">
            <span class="lite-action-title">✓ Marcar encontrado</span>
            <span class="lite-action-sub">Confirma que una persona está a salvo y tranquiliza a su familia.</span>
          </button>
        </div>

        <!-- Métricas -->
        <div class="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div class="lite-stat">
            <div class="lite-stat-num" [appCountUp]="m().total_reportados"></div>
            <div class="lite-stat-lbl">Reportes</div>
          </div>
          <div class="lite-stat" style="background: rgba(239,68,68,.10); border-color: rgba(239,68,68,.25)">
            <div class="lite-stat-num" style="color:#ef4444" [appCountUp]="m().desaparecidos"></div>
            <div class="lite-stat-lbl">Desaparecidos</div>
          </div>
          <div class="lite-stat" style="background: rgba(34,197,94,.10); border-color: rgba(34,197,94,.25)">
            <div class="lite-stat-num" style="color:#16a34a" [appCountUp]="m().localizados"></div>
            <div class="lite-stat-lbl">Localizados</div>
          </div>
          <div class="lite-stat">
            <div class="lite-stat-num" [appCountUp]="m().sismos_24h"></div>
            <div class="lite-stat-lbl">Sismos (24 h)</div>
          </div>
        </div>

        <!-- Secciones secundarias -->
        <div class="mt-9">
          <div class="mb-2 text-[11px] font-bold uppercase tracking-wider" style="color: var(--txt-muted)">Más secciones</div>
          <div class="flex flex-wrap gap-2">
            @for (s of secondary; track s.sheet) {
              <button (click)="ui.open(s.sheet)"
                      class="flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold transition active:scale-95"
                      style="background: var(--chip-bg); color: var(--txt)">
                <span>{{ s.icon }}</span> {{ s.label }}
              </button>
            }
          </div>
        </div>

        <p class="mt-10 text-[11px] leading-relaxed" style="color: var(--txt-muted)">
          Información de dominio público recopilada de fuentes abiertas. Ante una emergencia, contacta siempre a los organismos oficiales de protección civil y rescate.
        </p>
      </main>
    </div>
  `,
  styles: [`
    .lite-title {
      font-family: Georgia, 'Times New Roman', 'Noto Serif', serif;
      font-size: clamp(2.4rem, 9vw, 4rem);
      line-height: 1.02;
      letter-spacing: -0.02em;
    }
    .lite-action {
      display: flex; flex-direction: column; gap: .35rem;
      border-radius: 1rem; padding: 1rem 1.1rem; text-align: left;
      box-shadow: 0 6px 18px rgba(0,0,0,.08);
      transition: transform .15s ease, box-shadow .15s ease;
    }
    .lite-action:active { transform: scale(.985); }
    .lite-action--outline {
      background: var(--sheet);
      border: 1.5px solid color-mix(in srgb, var(--c-alert) 45%, transparent);
      box-shadow: none;
    }
    .lite-action-title { font-size: .95rem; font-weight: 800; }
    .lite-action-sub { font-size: .72rem; font-weight: 600; opacity: .82; line-height: 1.3; }
    .lite-action:not(.lite-action--outline) .lite-action-sub { color: rgba(255,255,255,.9); }

    .lite-stat {
      border-radius: 1rem; padding: .9rem 1rem;
      background: var(--sheet); border: 1px solid var(--divider);
    }
    .lite-stat-num { font-size: 1.7rem; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; }
    .lite-stat-lbl { margin-top: .35rem; font-size: .66rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--txt-muted); }
  `]
})
export class LiteHomeComponent {
  data = inject(CrisisDataService);
  ui = inject(UiService);
  conn = inject(ConnectionService);

  readonly m = computed(() => this.data.metrics());

  /** Accesos a las demás hojas (todas funcionan sin mapa). */
  readonly secondary: { sheet: 'ocr' | 'sismos' | 'hospitales' | 'refugios' | 'centers' | 'edificios' | 'report-building'; icon: string; label: string }[] = [
    { sheet: 'ocr', icon: '📤', label: 'Cargar lista' },
    { sheet: 'sismos', icon: '⚡', label: 'Sismos' },
    { sheet: 'hospitales', icon: '🏥', label: 'Hospitales' },
    { sheet: 'refugios', icon: '🏠', label: 'Refugios' },
    { sheet: 'centers', icon: '📦', label: 'Acopio' },
    { sheet: 'edificios', icon: '🏚️', label: 'Edificios' },
    { sheet: 'report-building', icon: '🏗️', label: 'Reportar edificio' },
  ];
}
