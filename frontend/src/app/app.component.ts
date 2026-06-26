import { ChangeDetectionStrategy, Component, OnInit, inject, AfterViewInit, signal, computed } from '@angular/core';

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

      <!-- ===== Top overlay: centered brand + live metric chips in black glassmorphism container ===== -->
      <header class="pointer-events-none absolute inset-x-0 top-0 z-[500] p-3 pt-[max(.75rem,env(safe-area-inset-top))]">
        <div class="pointer-events-auto mx-auto flex w-full max-w-[460px] flex-col items-center gap-2 rounded-2xl bg-black/60 backdrop-blur-xl p-3 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] animate-stagger-1 gs-header">
          <!-- Centered Brand -->
          <div class="flex items-center gap-2">
            <span class="text-base font-extrabold tracking-tight text-white">SomosUno</span>
            <span style="font-size:1.1rem;line-height:1;font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">&#x1F1FB;&#x1F1EA;</span>
          </div>

          <!-- Centered Live metric chips: background matching their status, text white/bright -->
          <div class="flex flex-wrap justify-center gap-1.5 text-[11px] font-semibold">
            <span class="flex items-center gap-1 rounded-full bg-slate-800/85 border border-slate-700/50 px-2.5 py-1 text-slate-100 shadow-sm"><b [appCountUp]="data.metrics().total_reportados"></b>&nbsp;total</span>
            <span class="flex items-center gap-1 rounded-full bg-red-600/85 border border-red-500/50 px-2.5 py-1 text-white shadow-sm"><b [appCountUp]="data.metrics().desaparecidos"></b>&nbsp;desap.</span>
            <span class="flex items-center gap-1 rounded-full bg-green-600/85 border border-green-500/50 px-2.5 py-1 text-white shadow-sm"><b [appCountUp]="data.metrics().localizados"></b>&nbsp;salvo</span>
            <span class="flex items-center gap-1 rounded-full bg-orange-600/85 border border-orange-500/50 px-2.5 py-1 text-white shadow-sm"><b [appCountUp]="data.metrics().criticos"></b>&nbsp;críticos</span>
            <span class="flex items-center gap-1 rounded-full bg-blue-600/85 border border-blue-500/50 px-2.5 py-1 text-white shadow-sm"><b [appCountUp]="data.metrics().centros_activos"></b>&nbsp;acopio</span>
          </div>
        </div>
      </header>

      <!-- ===== Floating Recent Bubbles — desktop only, hidden when sheet open (relocated to left) ===== -->
      @if (!ui.sheet()) {
        <div class="pointer-events-none absolute left-4 top-1/2 z-[450] hidden sm:flex -translate-y-1/2 flex-col gap-4 overflow-visible h-[200px] justify-end pb-8">
          @for (person of recentPeople(); track person.id; let i = $index) {
            <div class="rounded-full bg-white/90 backdrop-blur-md px-3 py-1.5 shadow-lg border border-black/5 flex items-center gap-2 animate-[float-up_10s_ease-in-out_infinite] opacity-0"
                 [style.animation-delay]="(i * 2) + 's'">
              <span class="h-1.5 w-1.5 rounded-full" [class]="person.estado === 'a_salvo' ? 'bg-green-500' : 'bg-red-500'"></span>
              <span class="text-[10px] font-bold text-slate-700 whitespace-nowrap max-w-[100px] truncate">{{ person.nombre }}</span>
            </div>
          }
        </div>
      }

      <!-- ===== Legend — desktop only, above the nav bar ===== -->
      @if (!ui.sheet()) {
        <div class="absolute bottom-[88px] right-3 z-[400] hidden sm:flex flex-col gap-1.5 rounded-2xl bg-white/90 backdrop-blur-md p-2.5 text-[10px] font-semibold shadow-[0_4px_20px_rgba(0,0,0,0.10)] border border-black/5">
          <div class="flex items-center gap-2 text-slate-700"><span class="h-2.5 w-2.5 rounded-full bg-alert"></span>Desaparecido</div>
          <div class="flex items-center gap-2 text-slate-700"><span class="h-2.5 w-2.5 rounded-full bg-safe"></span>A Salvo</div>
          <div class="flex items-center gap-2 text-slate-700"><span class="h-2.5 w-2.5 rounded-full bg-info"></span>Acopio</div>
        </div>
      }

      <!-- ===== Black Glassmorphism Bottom Navigation with Shadow ===== -->
      <nav class="absolute inset-x-0 bottom-0 z-[600] flex justify-center px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] pointer-events-none gs-nav">
        <!-- Dark Glass Container -->
        <div class="pointer-events-auto flex w-full max-w-[460px] items-center justify-between rounded-[2rem] bg-black/60 backdrop-blur-xl px-2 py-1.5 shadow-[0_-2px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.4)] border border-white/10 animate-stagger-3">
          
          <!-- Item 1: Buscar -->
          <button (click)="ui.open('search')" class="flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 h-14 rounded-[1.5rem] transition-all duration-200 active:scale-95"
                  [class]="ui.sheet() === 'search' ? 'bg-white text-slate-950 shadow-inner' : 'text-slate-400 hover:text-white hover:bg-white/10'">
            <svg class="h-[22px] w-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span class="text-[10px] font-bold tracking-wide">Buscar</span>
          </button>
          
          <!-- Item 2: Reportar — red accent -->
          <button (click)="ui.openReport('desaparecido')" class="flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 h-14 rounded-[1.5rem] transition-all duration-200 active:scale-95"
                  [class]="ui.sheet() === 'report' ? 'bg-gradient-to-tr from-red-600 to-red-400 text-white shadow-[0_4px_16px_rgba(220,38,38,0.4)]' : 'text-red-400 hover:text-red-300 hover:bg-red-500/10'">
            <svg class="h-[22px] w-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span class="text-[10px] font-bold tracking-wide">Reportar</span>
          </button>
          
          <!-- Item 3: Escanear -->
          <button (click)="ui.open('ocr')" class="flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 h-14 rounded-[1.5rem] transition-all duration-200 active:scale-95"
                  [class]="ui.sheet() === 'ocr' ? 'bg-white text-slate-950 shadow-inner' : 'text-slate-400 hover:text-white hover:bg-white/10'">
            <svg class="h-[22px] w-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0118.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span class="text-[10px] font-bold tracking-wide">Escanear</span>
          </button>
          
          <!-- Item 4: Acopio -->
          <button (click)="ui.open('centers')" class="flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 h-14 rounded-[1.5rem] transition-all duration-200 active:scale-95"
                  [class]="ui.sheet() === 'centers' ? 'bg-white text-slate-950 shadow-inner' : 'text-slate-400 hover:text-white hover:bg-white/10'">
            <svg class="h-[22px] w-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span class="text-[10px] font-bold tracking-wide">Acopio</span>
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

  recentPeople = computed(() => {
    return this.data.people().slice(0, 5);
  });

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
