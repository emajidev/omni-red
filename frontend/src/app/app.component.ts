import { ChangeDetectionStrategy, Component, OnInit, inject, AfterViewInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CrisisMapComponent } from './features/map/crisis-map.component';
import { SearchSheetComponent } from './features/search/search-sheet.component';
import { ReportSheetComponent } from './features/report/report-sheet.component';
import { OcrSheetComponent } from './features/ocr/ocr-sheet.component';
import { CentersSheetComponent } from './features/centers/centers-sheet.component';
import { CountUpDirective } from './shared/count-up.directive';

import { CrisisDataService } from './core/services/crisis-data.service';
import { SupabaseService } from './core/services/supabase.service';
import { UiService } from './core/services/ui.service';

declare var gsap: any;

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, CountUpDirective, CrisisMapComponent,
    SearchSheetComponent, ReportSheetComponent, OcrSheetComponent, CentersSheetComponent
  ],
  template: `
    <!-- ===== Single view: the map IS the canvas ===== -->
    <main class="relative h-[100dvh] w-full overflow-hidden">
      <app-crisis-map></app-crisis-map>

      <!-- ===== Top overlay: brand + prominent search + live metric chips ===== -->
      <header class="pointer-events-none absolute inset-x-0 top-0 z-[500] p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div class="pointer-events-auto mx-auto flex max-w-2xl flex-col gap-3 gs-header">
          <div class="flex items-center gap-2">
            <div class="flex items-center gap-2 rounded-xl bg-surface px-4 py-2.5 shadow-card ring-1 ring-borderlight">
              <span class="text-base font-extrabold tracking-tight text-textmain">LocalizaVZLA</span>
              <span class="rounded-md px-1.5 py-0.5 text-[9px] font-bold"
                    [class]="supa.isLive ? 'bg-safebg text-safe' : 'bg-warnbg text-warn'">
                {{ supa.isLive ? 'LIVE' : 'DEMO' }}
              </span>
            </div>

            <!-- Prominent central search bar -->
            <button (click)="ui.open('search')"
                    class="flex flex-1 items-center gap-2 rounded-xl bg-surface px-4 py-2.5 text-left shadow-card ring-1 ring-borderlight hover:ring-info transition">
              <span class="text-textmuted">🔎</span>
              <span class="truncate text-sm font-medium text-textmuted">{{ ui.query() || 'Buscar nombre, zona...' }}</span>
            </button>
          </div>

          <!-- Live metric chips -->
          <div class="flex gap-2 overflow-x-auto pb-1 text-xs">
            <span class="chip gs-chip ring-borderlight bg-surface text-textmain"><b class="text-textmain" [appCountUp]="data.metrics().total_reportados"></b>&nbsp;reportados</span>
            <span class="chip gs-chip ring-alertbg bg-alertbg text-alert"><b [appCountUp]="data.metrics().desaparecidos"></b>&nbsp;desaparecidos</span>
            <span class="chip gs-chip ring-safebg bg-safebg text-safe"><b [appCountUp]="data.metrics().localizados"></b>&nbsp;a salvo</span>
            <span class="chip gs-chip ring-warnbg bg-warnbg text-warn"><b [appCountUp]="data.metrics().criticos"></b>&nbsp;críticos</span>
            <span class="chip gs-chip ring-infobg bg-infobg text-info"><b [appCountUp]="data.metrics().centros_activos"></b>&nbsp;acopio</span>
          </div>
        </div>
      </header>

      <!-- ===== Map legend (bottom-left) ===== -->
      <div class="pointer-events-none absolute bottom-36 left-4 z-[500] space-y-1 rounded-xl bg-surface p-3 text-[11px] font-medium shadow-card ring-1 ring-borderlight gs-legend">
        <div class="flex items-center gap-2 text-textmain"><span class="h-3 w-3 rounded-full bg-alert"></span>Desaparecido</div>
        <div class="flex items-center gap-2 text-textmain"><span class="h-3 w-3 rounded-full bg-safe"></span>A salvo</div>
        <div class="flex items-center gap-2 text-textmain"><span class="h-3 w-3 rounded-full bg-info"></span>Acopio</div>
      </div>

      <!-- ===== Premium Pill-Shaped Bottom Navigation ===== -->
      <nav class="absolute inset-x-0 bottom-6 z-[600] flex justify-center px-4 pointer-events-none gs-nav">
        <div class="pointer-events-auto flex w-full max-w-[380px] items-center justify-between rounded-[2.5rem] bg-white/95 px-6 py-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.08)] backdrop-blur-xl ring-1 ring-borderlight">
          
          <!-- Item 1: Mapa (Home) -->
          <button (click)="ui.sheet.set(null)" class="flex flex-col items-center gap-1.5 transition-transform active:scale-95"
                  [class]="!ui.sheet() ? 'text-info' : 'text-textmuted hover:text-textmain'">
            <svg class="h-6 w-6" [attr.fill]="!ui.sheet() ? 'currentColor' : 'none'" [attr.stroke]="!ui.sheet() ? 'none' : 'currentColor'" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span class="text-[11px] font-semibold tracking-wide">Mapa</span>
          </button>
          
          <!-- Item 2: Lista -->
          <button (click)="ui.open('search')" class="flex flex-col items-center gap-1.5 transition-transform active:scale-95"
                  [class]="ui.sheet() === 'search' ? 'text-info' : 'text-textmuted hover:text-textmain'">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span class="text-[11px] font-semibold tracking-wide">Lista</span>
          </button>
          
          <!-- Center Elevated Button: Reportar -->
          <div class="relative -top-6 mx-2">
            <button (click)="ui.openReport('desaparecido')" 
                    class="flex h-[4.2rem] w-[4.2rem] items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-blue-400 text-white shadow-[0_12px_24px_rgba(43,108,176,0.4)] ring-[6px] ring-appbg/80 transition-transform hover:scale-105 active:scale-95">
              <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          
          <!-- Item 4: Escanear -->
          <button (click)="ui.open('ocr')" class="flex flex-col items-center gap-1.5 transition-transform active:scale-95"
                  [class]="ui.sheet() === 'ocr' ? 'text-info' : 'text-textmuted hover:text-textmain'">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span class="text-[11px] font-semibold tracking-wide">Escanear</span>
          </button>
          
          <!-- Item 5: Acopio -->
          <button (click)="ui.open('centers')" class="flex flex-col items-center gap-1.5 transition-transform active:scale-95"
                  [class]="ui.sheet() === 'centers' ? 'text-info' : 'text-textmuted hover:text-textmain'">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span class="text-[11px] font-semibold tracking-wide">Acopio</span>
          </button>
          
        </div>
      </nav>

      <!-- ===== Half-screen sheet host ===== -->
      @switch (ui.sheet()) {
        @case ('search')  { <app-search-sheet /> }
        @case ('report')  { <app-report-sheet /> }
        @case ('ocr')     { <app-ocr-sheet /> }
        @case ('centers') { <app-centers-sheet /> }
      }

      <!-- ===== Loading overlay ===== -->
      @if (data.loading()) {
        <div class="absolute inset-0 z-[2000] grid place-items-center bg-appbg">
          <div class="text-center">
            <div class="text-3xl font-extrabold text-primary">LocalizaVZLA</div>
            <div class="mt-2 animate-pulse text-sm text-textmuted">Cargando base de datos…</div>
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
  `]
})
export class AppComponent implements OnInit, AfterViewInit {
  data = inject(CrisisDataService);
  ui = inject(UiService);
  supa = inject(SupabaseService);

  ngOnInit(): void {
    this.data.loadAll();
  }

  ngAfterViewInit(): void {
    // GSAP Stagger animations for a premium feel when loading
    setTimeout(() => {
      gsap.from(".gs-header", { opacity: 0, y: -20, duration: 0.6, ease: "power3.out" });
      gsap.from(".gs-chip", { opacity: 0, scale: 0.8, stagger: 0.05, duration: 0.4, ease: "back.out(1.5)", delay: 0.2 });
      gsap.from(".gs-nav", { opacity: 0, y: 20, duration: 0.6, ease: "power3.out", delay: 0.1 });
      gsap.from(".gs-action", { opacity: 0, y: 15, stagger: 0.1, duration: 0.5, ease: "back.out(1.2)", delay: 0.3 });
      gsap.from(".gs-legend", { opacity: 0, x: -20, duration: 0.5, ease: "power2.out", delay: 0.5 });
    }, 100);
  }

  toastClass(kind: string): string {
    switch (kind) {
      case 'success': return 'bg-safebg text-safe ring-safe/40';
      case 'alert':   return 'bg-alertbg text-alert ring-alert/40';
      case 'warn':    return 'bg-warnbg text-warn ring-warn/40';
      default:        return 'bg-surface text-textmain ring-borderlight';
    }
  }
}
