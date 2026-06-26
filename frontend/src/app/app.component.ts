import { ChangeDetectionStrategy, Component, OnInit, inject, AfterViewInit, signal, computed } from '@angular/core';

// ... other imports remain the same ...
import { FormsModule } from '@angular/forms';

import { CrisisMapComponent } from './features/map/crisis-map.component';
import { SearchSheetComponent } from './features/search/search-sheet.component';
import { ReportSheetComponent } from './features/report/report-sheet.component';
import { OcrSheetComponent } from './features/ocr/ocr-sheet.component';
import { CentersSheetComponent } from './features/centers/centers-sheet.component';
import { SismosSheetComponent } from './features/sismos/sismos-sheet.component';
import { FacilitiesSheetComponent } from './features/facilities/facilities-sheet.component';
import { CountUpDirective } from './shared/count-up.directive';

import { CrisisDataService } from './core/services/crisis-data.service';
import { UiService } from './core/services/ui.service';
import { PresenceService } from './core/services/presence.service';
import { PersonReport } from './core/models/models';
import { CRISIS_SINCE, statusColor, timeAgo } from './core/util/labels';

declare var gsap: any;

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, CountUpDirective, CrisisMapComponent,
    SearchSheetComponent, ReportSheetComponent, OcrSheetComponent, CentersSheetComponent,
    SismosSheetComponent, FacilitiesSheetComponent
  ],
  template: `
    <!-- 3 Second Splash Screen -->
    @if (showSplash()) {
      <div class="fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-1000"
           style="background: var(--bg); color: var(--txt);" [class.opacity-0]="fadeSplash()">
        <h1 class="text-[2.5rem] font-extrabold tracking-tight mb-6">SomosUno</h1>

        <!-- Loading Progress Bar -->
        <div class="w-48 h-1.5 rounded-full overflow-hidden" style="background: var(--chip-bg);">
          <div class="h-full rounded-full" style="background: var(--c-alert); animation: fill-bar 2s linear forwards;"></div>
        </div>
      </div>
    }

    <!-- ===== Single view: the map IS the canvas ===== -->
    <main class="relative h-[100dvh] w-full overflow-hidden">
      <app-crisis-map></app-crisis-map>

      <!-- ===== Ticker sísmico (franja superior, ≤30px) ===== -->
      <div class="seismic-ticker glass-bar" aria-label="Estado sísmico">
        <span class="seismic-state" [style.color]="quakeAlert().color">
          <span class="sdot" [style.background]="quakeAlert().color"></span>
          {{ quakeAlert().label }}
        </span>
        <span class="seismic-sep"></span>
        <span class="seismic-replicas">{{ quakeAlert().replicas }} réplicas/24h</span>
        <span class="seismic-sep"></span>
        <div class="seismic-marquee">
          <div class="seismic-track">
            <span>{{ quakeTicker() }}</span>
            <span>{{ quakeTicker() }}</span>
          </div>
        </div>
      </div>

      <!-- ===== Top overlay: brand + live metrics in a themed glass bar ===== -->
      <header class="pointer-events-none absolute inset-x-0 top-7 z-[500] p-3 pt-[max(.75rem,env(safe-area-inset-top))]">
        <div class="pointer-events-auto mx-auto flex w-full max-w-[460px] flex-col items-center gap-2 rounded-2xl glass-bar p-3 animate-stagger-1 gs-header">
          <!-- Centered Brand -->
          <div class="flex items-center gap-2">
            <span class="text-base font-extrabold tracking-tight">SomosUno</span>
          </div>

          <!-- Live metrics — uniform family, color only on dot + value -->
          <div class="flex flex-wrap justify-center gap-1.5">
            <span class="stat-chip"><span class="dot" style="background:#94a3b8"></span><b class="val" [appCountUp]="data.metrics().total_reportados"></b><span class="lbl">total</span></span>
            <span class="stat-chip"><span class="dot" style="background:var(--c-alert)"></span><b class="val" [appCountUp]="data.metrics().desaparecidos"></b><span class="lbl">desap.</span></span>
            <span class="stat-chip"><span class="dot" style="background:var(--c-safe)"></span><b class="val" [appCountUp]="data.metrics().localizados"></b><span class="lbl">salvo</span></span>
            <span class="stat-chip"><span class="dot" style="background:var(--c-info)"></span><b class="val" [appCountUp]="data.metrics().centros_activos"></b><span class="lbl">acopio</span></span>
            <span class="stat-chip" title="Usuarios conectados ahora"><span class="dot dot-live" style="background:#22c55e"></span><b class="val">{{ presence.online() }}</b><span class="lbl">en línea</span></span>
          </div>
        </div>
      </header>

      <!-- ===== Theme toggle (floating, top-right; debajo del ticker) ===== -->
      <button (click)="ui.toggleTheme()" aria-label="Cambiar tema"
              class="pointer-events-auto absolute right-3 top-9 z-[550] icon-btn">
        @if (ui.theme() === 'dark') {
          <!-- sun -->
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <circle cx="12" cy="12" r="4" />
            <path stroke-linecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" />
          </svg>
        } @else {
          <!-- moon -->
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
          </svg>
        }
      </button>

      <!-- ===== Recientes — dos listas apiladas (Desaparecidos / A salvo) ===== -->
      @if (!ui.sheet()) {
        <aside class="pointer-events-auto absolute left-3 top-1/2 z-[450] hidden max-h-[82vh] w-[244px] -translate-y-1/2 flex-col overflow-hidden rounded-2xl glass-bar sm:flex gs-recent">

          <!-- Desaparecidos -->
          <div class="recent-head">
            <span class="relative flex h-2 w-2">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style="background: var(--c-alert)"></span>
              <span class="relative inline-flex h-2 w-2 rounded-full" style="background: var(--c-alert)"></span>
            </span>
            <span class="title">Desaparecidos</span>
            <span class="count">{{ missingPeople().length }}</span>
          </div>
          <div class="max-h-[28vh] overflow-y-auto px-2 pb-2">
            @for (person of missingPeople(); track person.id) {
              <div class="recent-item" (click)="focusPerson(person)">
                <span class="h-2 w-2 flex-none rounded-full" [style.background]="dotColor(person)"></span>
                <div class="min-w-0 flex-1">
                  <div class="name truncate">{{ person.nombre }}</div>
                  <div class="meta truncate">{{ person.ubicacion }} · {{ ago(person.created_at) }}</div>
                </div>
              </div>
            } @empty {
              <div class="px-3 py-5 text-center text-[11px]" style="color: var(--txt-muted)">Sin desaparecidos</div>
            }
          </div>

          <!-- Divisor -->
          <div class="mx-3 border-t" style="border-color: var(--divider)"></div>

          <!-- A salvo -->
          <div class="recent-head">
            <span class="h-2 w-2 rounded-full" style="background: var(--c-safe)"></span>
            <span class="title">A salvo</span>
            <span class="count">{{ safePeople().length }}</span>
          </div>
          <div class="max-h-[28vh] overflow-y-auto px-2 pb-2">
            @for (person of safePeople(); track person.id) {
              <div class="recent-item" (click)="focusPerson(person)">
                <span class="h-2 w-2 flex-none rounded-full" [style.background]="dotColor(person)"></span>
                <div class="min-w-0 flex-1">
                  <div class="name truncate">{{ person.nombre }}</div>
                  <div class="meta truncate">{{ person.ubicacion }} · {{ ago(person.created_at) }}</div>
                </div>
              </div>
            } @empty {
              <div class="px-3 py-5 text-center text-[11px]" style="color: var(--txt-muted)">Sin reportes a salvo</div>
            }
          </div>

        </aside>
      }

      <!-- ===== Themed Glass Bottom Navigation ===== -->
      <nav class="absolute inset-x-0 bottom-0 z-[600] flex justify-center px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] pointer-events-none gs-nav">
        <div class="nav-scroll pointer-events-auto flex w-full max-w-[460px] items-center justify-start gap-1 overflow-x-auto rounded-[2rem] glass-bar px-2 py-1.5 animate-stagger-3">

          <!-- Item 1: Buscar -->
          <button (click)="ui.open('search')" class="nav-btn" [class.is-active]="ui.sheet() === 'search'">
            <svg class="h-[22px] w-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span class="lbl">Buscar</span>
          </button>

          <!-- Item 2: Reportar — red accent -->
          <button (click)="ui.openReport('desaparecido')" class="nav-btn nav-btn--report" [class.is-active]="ui.sheet() === 'report'">
            <svg class="h-[22px] w-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span class="lbl">Reportar</span>
          </button>

          <!-- Item 3: Cargar (imagen OCR / CSV) -->
          <button (click)="ui.open('ocr')" class="nav-btn" [class.is-active]="ui.sheet() === 'ocr'">
            <svg class="h-[22px] w-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 16V4m0 0L8 8m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
            </svg>
            <span class="lbl">Cargar</span>
          </button>

          <!-- Item 4: Acopio -->
          <button (click)="ui.open('centers')" class="nav-btn" [class.is-active]="ui.sheet() === 'centers'">
            <svg class="h-[22px] w-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span class="lbl">Acopio</span>
          </button>

          <!-- Item 5: Refugios -->
          <button (click)="ui.open('refugios')" class="nav-btn" [class.is-active]="ui.sheet() === 'refugios'">
            <svg class="h-[22px] w-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 11l9-7 9 7M5 10v10h14V10" />
            </svg>
            <span class="lbl">Refugios</span>
          </button>

          <!-- Item 6: Hospitales -->
          <button (click)="ui.open('hospitales')" class="nav-btn" [class.is-active]="ui.sheet() === 'hospitales'">
            <svg class="h-[22px] w-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v8m-4-4h8M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16" />
            </svg>
            <span class="lbl">Hospitales</span>
          </button>

          <!-- Item 7: Sismos (histórico) -->
          <button (click)="ui.open('sismos')" class="nav-btn" [class.is-active]="ui.sheet() === 'sismos'">
            <svg class="h-[22px] w-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 12h3l2-6 4 14 3-9 2 4h4" />
            </svg>
            <span class="lbl">Sismos</span>
          </button>

        </div>
      </nav>

      <!-- ===== Half-screen sheet host ===== -->
      @switch (ui.sheet()) {
        @case ('search')  { <app-search-sheet /> }
        @case ('report')  { <app-report-sheet /> }
        @case ('ocr')     { <app-ocr-sheet /> }
        @case ('centers') { <app-centers-sheet /> }
        @case ('sismos')  { <app-sismos-sheet /> }
        @case ('refugios')   { <app-facilities-sheet tipo="refugio" /> }
        @case ('hospitales') { <app-facilities-sheet tipo="hospital" /> }
      }

      <!-- ===== Loading overlay ===== -->
      @if (data.loading()) {
        <div class="absolute inset-0 z-[2000] grid place-items-center" style="background: var(--bg);">
          <div class="text-center">
            <div class="mt-2 animate-pulse text-sm" style="color: var(--txt-muted);">Cargando datos…</div>
          </div>
        </div>
      }

      <!-- ===== Toasts ===== -->
      <div class="pointer-events-none absolute inset-x-0 top-24 z-[3000] flex flex-col items-center gap-2 px-3">
        @for (t of ui.toasts(); track t.id) {
          <div class="pointer-events-auto max-w-md rounded-xl px-4 py-2.5 text-sm font-medium shadow-card ring-1 animate-count-pop"
               [class]="toastClass(t.kind)">
            {{ t.text }}
          </div>
        }
      </div>
    </main>
  `,
  styles: [`
    .chip { display:inline-flex; align-items:center; white-space:nowrap; border-radius:9999px;
            padding:.3rem .75rem; font-weight:500; --tw-ring-inset: inset; box-shadow: 0 0 0 1px var(--tw-ring-color);
            background-color: var(--tw-bg-opacity, 1); transition: transform 0.2s; }
    .action-chip { display:flex; flex-direction:column; align-items:center; gap:.2rem;
            border-radius:1.25rem; background:#FFFFFF; padding:.75rem .25rem; font-size:.75rem;
            font-weight:600; color:#4A5568; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #EDF2F7; transition: all .2s cubic-bezier(0.4, 0, 0.2, 1); }
    .action-chip:active { transform: scale(.94); box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .action-chip > :first-child { font-size:1.25rem; margin-bottom: 2px; }
    .dot-live { animation: dot-live-pulse 1.6s ease-in-out infinite; }
    @keyframes dot-live-pulse { 0%,100% { opacity: 1; } 50% { opacity: .3; } }
  `]
})
export class AppComponent implements OnInit, AfterViewInit {
  data = inject(CrisisDataService);
  ui = inject(UiService);
  presence = inject(PresenceService);

  showSplash = signal(true);
  fadeSplash = signal(false);

  /**
   * Dos listas separadas para el panel lateral. La API ya devuelve los reportes
   * ordenados por `created_at desc` (ver PersonasService.findAll), así que
   * filtrar por estado conserva el orden de recencia. Excluimos `fallecido`.
   */
  missingPeople = computed(() =>
    this.data.people().filter((p) => p.estado === 'desaparecido').slice(0, 40)
  );
  safePeople = computed(() =>
    this.data.people().filter((p) => p.estado === 'a_salvo').slice(0, 40)
  );

  /** Estado de alerta sísmica derivado de la magnitud máxima reciente (24h). */
  quakeAlert = computed(() => {
    const recent = this.data.quakes().filter(
      (q) => Date.now() - +new Date(q.ocurrido_en) < 86_400_000
    );
    const maxMag = recent.reduce((m, q) => Math.max(m, q.magnitud), 0);
    let label = 'Sin actividad';
    let color = 'var(--c-safe)';
    if (maxMag >= 5)      { label = 'Alerta alta';     color = 'var(--c-alert)'; }
    else if (maxMag >= 4) { label = 'Alerta moderada'; color = 'var(--c-warn)'; }
    else if (maxMag > 0)  { label = 'Vigilancia';      color = 'var(--c-info)'; }
    return { label, color, replicas: recent.length, maxMag };
  });

  /** Línea de noticias del ticker (se duplica en plantilla para loop continuo). */
  quakeTicker = computed(() => {
    const qs = this.data.quakes().filter((q) => new Date(q.ocurrido_en) >= CRISIS_SINCE);
    if (!qs.length) return 'Sin sismos recientes · monitoreo activo';
    return qs
      .slice(0, 8)
      .map((q) => `M${q.magnitud.toFixed(1)} · ${q.epicentro} · ${timeAgo(q.ocurrido_en)}`)
      .join(' • ');
  });

  /** Dot color for a report in the recent list. */
  dotColor(p: PersonReport): string {
    return statusColor(p.estado);
  }

  /** Relative timestamp for the recent list. */
  ago(iso: string): string {
    return timeAgo(iso);
  }

  /** Fly the map to a report when tapped in the recent list. */
  focusPerson(p: PersonReport): void {
    this.ui.focusOn({ lat: p.lat, lng: p.lng, id: p.id, zoom: 15 }, false);
  }

  ngOnInit(): void {
    this.data.loadAll();
    this.presence.start();   // contador de usuarios conectados (latido cada 15s)

    // 3 second splash screen (2s visible + 1s fade)
    setTimeout(() => {
      this.fadeSplash.set(true); // Start fade out
      setTimeout(() => {
        this.showSplash.set(false); // Remove from DOM after transition
      }, 1000); // 1s transition duration
    }, 2000); // Wait 2s before fading
  }

  ngAfterViewInit(): void {
    // GSAP Stagger animations for a premium feel when loading
    setTimeout(() => {
      gsap.from(".gs-header", { opacity: 0, y: -20, duration: 0.6, ease: "power3.out" });
      gsap.from(".gs-chip", { opacity: 0, scale: 0.8, stagger: 0.05, duration: 0.4, ease: "back.out(1.5)", delay: 0.2 });
      gsap.from(".gs-nav", { opacity: 0, y: 20, duration: 0.6, ease: "power3.out", delay: 0.1 });
      gsap.from(".gs-recent", { opacity: 0, x: -20, duration: 0.5, ease: "power2.out", delay: 0.4 });
    }, 100);
  }

  toastClass(kind: string): string {
    switch (kind) {
      case 'success': return 'bg-safebg text-safe ring-safe/40';
      case 'alert':   return 'bg-alertbg text-alert ring-alert/40';
      case 'warn':    return 'bg-warnbg text-warn ring-warn/40';
      default:        return 'glass-bar ring-transparent';
    }
  }
}
