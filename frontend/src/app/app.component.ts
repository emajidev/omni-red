import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
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
      <header class="pointer-events-none absolute inset-x-0 top-0 z-[500] p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div class="pointer-events-auto mx-auto flex max-w-2xl flex-col gap-2">
          <div class="flex items-center gap-2">
            <div class="flex items-center gap-2 rounded-xl bg-ink-800/90 px-3 py-2 ring-1 ring-ink-600 backdrop-blur">
              <span class="text-base font-extrabold tracking-tight">🔴 OmniRed</span>
              <span class="rounded-md px-1.5 py-0.5 text-[9px] font-bold"
                    [class]="supa.isLive ? 'bg-safe/20 text-safe' : 'bg-warn/20 text-warn'">
                {{ supa.isLive ? 'LIVE' : 'DEMO' }}
              </span>
            </div>

            <!-- Prominent central search bar -->
            <button (click)="ui.open('search')"
                    class="flex flex-1 items-center gap-2 rounded-xl bg-ink-800/90 px-3 py-2 text-left ring-1 ring-ink-600 backdrop-blur hover:ring-info">
              <span class="text-slate-400">🔎</span>
              <span class="truncate text-sm text-slate-400">{{ ui.query() || 'Buscar nombre, cédula o ubicación…' }}</span>
            </button>
          </div>

          <!-- Live metric chips -->
          <div class="flex gap-2 overflow-x-auto pb-1 text-xs">
            <span class="chip ring-ink-600 bg-ink-800/90"><b class="text-slate-100" [appCountUp]="data.metrics().total_reportados"></b>&nbsp;reportados</span>
            <span class="chip ring-alert/40 bg-alert/15 text-alert"><b [appCountUp]="data.metrics().desaparecidos"></b>&nbsp;desaparecidos</span>
            <span class="chip ring-safe/40 bg-safe/15 text-safe"><b [appCountUp]="data.metrics().localizados"></b>&nbsp;a salvo</span>
            <span class="chip ring-warn/40 bg-warn/15 text-warn"><b [appCountUp]="data.metrics().criticos"></b>&nbsp;críticos</span>
            <span class="chip ring-info/40 bg-info/15 text-info"><b [appCountUp]="data.metrics().centros_activos"></b>&nbsp;acopio</span>
          </div>
        </div>
      </header>

      <!-- ===== Map legend (bottom-left) ===== -->
      <div class="pointer-events-none absolute bottom-32 left-3 z-[500] space-y-1 rounded-xl bg-ink-800/80 p-2 text-[10px] ring-1 ring-ink-600 backdrop-blur">
        <div class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-alert"></span>Desaparecido</div>
        <div class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-safe"></span>A salvo</div>
        <div class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-info"></span>Acopio</div>
      </div>

      <!-- ===== Bottom action bar: at-hand buttons → half-screen sheets ===== -->
      <nav class="absolute inset-x-0 bottom-0 z-[600] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div class="mx-auto max-w-2xl space-y-2">
          <!-- Two prominent mass-action buttons -->
          <div class="grid grid-cols-2 gap-2">
            <button (click)="ui.openReport('desaparecido')"
                    class="flex items-center justify-center gap-2 rounded-2xl bg-alert py-3.5 text-sm font-bold text-white shadow-lg shadow-alert/30 active:scale-[.98] transition">
              🚨 Reportar desaparecido
            </button>
            <button (click)="ui.openReport('a_salvo')"
                    class="flex items-center justify-center gap-2 rounded-2xl bg-safe py-3.5 text-sm font-bold text-white shadow-lg shadow-safe/30 active:scale-[.98] transition">
              🟢 Reportar a salvo
            </button>
          </div>
          <!-- Utility triggers -->
          <div class="grid grid-cols-3 gap-2">
            <button (click)="ui.open('search')" class="action-chip">🔍<span>Buscar</span></button>
            <button (click)="ui.open('ocr')" class="action-chip">📷<span>Cargar lista</span></button>
            <button (click)="ui.open('centers')" class="action-chip">📦<span>Acopio · Sismos</span></button>
          </div>
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
        <div class="absolute inset-0 z-[2000] grid place-items-center bg-ink-900">
          <div class="text-center">
            <div class="text-3xl font-extrabold text-alert">🔴 OmniRed</div>
            <div class="mt-2 animate-pulse text-sm text-slate-400">Sincronizando reportes…</div>
          </div>
        </div>
      }

      <!-- ===== Toasts ===== -->
      <div class="pointer-events-none absolute inset-x-0 top-24 z-[3000] flex flex-col items-center gap-2 px-3">
        @for (t of ui.toasts(); track t.id) {
          <div class="pointer-events-auto max-w-md rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg ring-1 animate-count-pop"
               [class]="toastClass(t.kind)">
            {{ t.text }}
          </div>
        }
      </div>
    </main>
  `,
  styles: [`
    .chip { display:inline-flex; align-items:center; white-space:nowrap; border-radius:9999px;
            padding:.25rem .6rem; --tw-ring-inset: inset; box-shadow: 0 0 0 1px var(--tw-ring-color);
            backdrop-filter: blur(4px); }
    .action-chip { display:flex; flex-direction:column; align-items:center; gap:.1rem;
            border-radius:1rem; background:rgba(18,24,33,.92); padding:.6rem .25rem; font-size:.7rem;
            font-weight:600; color:#cbd5e1; box-shadow: inset 0 0 0 1px #27313f; transition: transform .1s; }
    .action-chip:active { transform: scale(.96); }
    .action-chip > :first-child { font-size:1.1rem; }
  `]
})
export class AppComponent implements OnInit {
  data = inject(CrisisDataService);
  ui = inject(UiService);
  supa = inject(SupabaseService);

  ngOnInit(): void {
    this.data.loadAll();
  }

  toastClass(kind: string): string {
    switch (kind) {
      case 'success': return 'bg-safe/20 text-safe ring-safe/40';
      case 'alert':   return 'bg-alert/20 text-alert ring-alert/40';
      case 'warn':    return 'bg-warn/20 text-warn ring-warn/40';
      default:        return 'bg-ink-700 text-slate-100 ring-ink-600';
    }
  }
}
