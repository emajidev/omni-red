import { ChangeDetectionStrategy, Component, OnInit, inject, AfterViewInit, signal } from '@angular/core';

// ... other imports remain the same ...
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
    <!-- 3 Second Splash Screen -->
    @if (showSplash()) {
      <div class="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#F2F2F7] transition-opacity duration-1000" [class.opacity-0]="fadeSplash()">
        <h1 class="text-[2.5rem] font-extrabold tracking-tight text-black mb-6">SomosUno</h1>
        
        <!-- Loading Progress Bar -->
        <div class="w-48 h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div class="h-full bg-black rounded-full" style="animation: fill-bar 2s linear forwards;"></div>
        </div>
      </div>
    }

    <!-- ===== Single view: the map IS the canvas ===== -->
    <main class="relative h-[100dvh] w-full overflow-hidden">
      <app-crisis-map></app-crisis-map>

      <!-- ===== Top overlay: brand + prominent search + live metric chips ===== -->
      <header class="pointer-events-none absolute inset-x-0 top-0 z-[500] p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div class="pointer-events-auto mx-auto flex max-w-2xl flex-col gap-3 gs-header">
          <div class="flex items-center gap-2 animate-stagger-1">
            <div class="flex items-center gap-2 rounded-2xl bg-white/80 backdrop-blur-xl px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-black/5">
              <span class="text-lg font-bold tracking-tight text-black">SomosUno</span>
              <span class="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    [class]="supa.isLive ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'">
                {{ supa.isLive ? 'LIVE' : 'DEMO' }}
              </span>
            </div>

            <!-- Prominent central search bar -->
            <button (click)="ui.open('search')"
                    class="flex flex-1 items-center gap-2 rounded-2xl bg-white/80 backdrop-blur-xl px-4 py-3 text-left shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-black/5 hover:border-black/10 transition">
              <span class="text-slate-400">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </span>
              <span class="truncate text-sm font-medium text-slate-500">{{ ui.query() || 'Buscar nombre, zona...' }}</span>
            </button>
          </div>

          <!-- Live metric chips -->
          <div class="flex gap-2 overflow-x-auto pb-1 text-xs font-medium hide-scrollbar animate-stagger-2">
            <span class="flex items-center gap-1.5 rounded-full border border-black/5 bg-white/80 backdrop-blur-md px-3 py-1.5 text-black shadow-sm"><b [appCountUp]="data.metrics().total_reportados"></b> reportados</span>
            <span class="flex items-center gap-1.5 rounded-full border border-black/5 bg-red-50 backdrop-blur-md px-3 py-1.5 text-red-600 shadow-sm"><b [appCountUp]="data.metrics().desaparecidos"></b> desaparecidos</span>
            <span class="flex items-center gap-1.5 rounded-full border border-black/5 bg-green-50 backdrop-blur-md px-3 py-1.5 text-green-600 shadow-sm"><b [appCountUp]="data.metrics().localizados"></b> a salvo</span>
            <span class="flex items-center gap-1.5 rounded-full border border-black/5 bg-orange-50 backdrop-blur-md px-3 py-1.5 text-orange-600 shadow-sm"><b [appCountUp]="data.metrics().criticos"></b> críticos</span>
            <span class="flex items-center gap-1.5 rounded-full border border-black/5 bg-blue-50 backdrop-blur-md px-3 py-1.5 text-blue-600 shadow-sm"><b [appCountUp]="data.metrics().centros_activos"></b> acopio</span>
          </div>
        </div>
      </header>

      <!-- ===== Right side panel (sheet) ===== -->
      @if (ui.sheet() === 'search') { <app-search-sheet class="gs-sheet"></app-search-sheet> }
      @if (ui.sheet() === 'report') { <app-report-sheet class="gs-sheet"></app-report-sheet> }
      @if (ui.sheet() === 'ocr')    { <app-ocr-sheet class="gs-sheet"></app-ocr-sheet> }
      @if (ui.sheet() === 'centers'){ <app-centers-sheet class="gs-sheet"></app-centers-sheet> }

      <!-- ===== Legend (only visible when map is main view) ===== -->
      <div class="absolute bottom-[100px] right-4 z-[400] flex flex-col gap-2 rounded-2xl bg-white/80 p-3 text-[10px] font-medium shadow-[0_8px_32px_rgba(0,0,0,0.06)] backdrop-blur-md border border-black/5 gs-legend"
           [class.hidden]="ui.sheet()">
        <div class="flex items-center gap-2 text-textmain"><span class="h-3 w-3 rounded-full bg-alert"></span>Desaparecido</div>
        <div class="flex items-center gap-2 text-textmain"><span class="h-3 w-3 rounded-full bg-safe"></span>A Salvo</div>
        <div class="flex items-center gap-2 text-textmain"><span class="h-3 w-3 rounded-full bg-info"></span>Acopio</div>
      </div>

      <!-- ===== Light Glassmorphic Bottom Navigation (Apple Style) ===== -->
      <nav class="absolute inset-x-0 bottom-6 z-[600] flex justify-center px-4 pointer-events-none gs-nav">
        <!-- Glassmorphic Container -->
        <div class="pointer-events-auto flex w-full max-w-[420px] items-center justify-between rounded-[2.5rem] bg-white/70 px-4 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.06)] backdrop-blur-2xl border border-black/5 animate-stagger-3">
          
          <!-- Item 1: Buscar (Search) -->
          <button (click)="ui.open('search')" class="flex flex-col items-center justify-center gap-1 w-[72px] h-14 rounded-3xl transition-all active:scale-95 animate-stagger-4"
                  [class]="ui.sheet() === 'search' ? 'bg-black text-white shadow-md' : 'text-slate-500 hover:text-black hover:bg-black/5'">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span class="text-xs font-semibold tracking-wide">Buscar</span>
          </button>
          
          <!-- Item 2: Reportar (RED) -->
          <button (click)="ui.openReport('desaparecido')" class="flex flex-col items-center justify-center gap-1 w-[72px] h-14 rounded-3xl transition-all active:scale-95 animate-stagger-5"
                  [class]="ui.sheet() === 'report' ? 'bg-red-500 text-white shadow-md' : 'text-red-500 hover:text-red-600 hover:bg-red-50'">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span class="text-xs font-semibold tracking-wide">Reportar</span>
          </button>
          
          <!-- Item 3: Escanear -->
          <button (click)="ui.open('ocr')" class="flex flex-col items-center justify-center gap-1 w-[72px] h-14 rounded-3xl transition-all active:scale-95 animate-stagger-5"
                  [class]="ui.sheet() === 'ocr' ? 'bg-black text-white shadow-md' : 'text-slate-500 hover:text-black hover:bg-black/5'">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span class="text-xs font-semibold tracking-wide">Escanear</span>
          </button>
          
          <!-- Item 4: Acopio -->
          <button (click)="ui.open('centers')" class="flex flex-col items-center justify-center gap-1 w-[72px] h-14 rounded-3xl transition-all active:scale-95 animate-stagger-5"
                  [class]="ui.sheet() === 'centers' ? 'bg-black text-white shadow-md' : 'text-slate-500 hover:text-black hover:bg-black/5'">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span class="text-xs font-semibold tracking-wide">Acopio</span>
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

  showSplash = signal(true);
  fadeSplash = signal(false);

  ngOnInit(): void {
    this.data.loadAll();
    
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
