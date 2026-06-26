import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BottomSheetComponent } from '../../shared/bottom-sheet/bottom-sheet.component';
import { CountUpDirective } from '../../shared/count-up.directive';
import { CrisisDataService } from '../../core/services/crisis-data.service';
import { UiService } from '../../core/services/ui.service';
import { PersonStatus } from '../../core/models/models';
import { SOURCE_LABEL, STATUS_CHIP, STATUS_LABEL, timeAgo } from '../../core/util/labels';

/**
 * Search + results sheet: real-time filter by name / cédula / location, plus
 * the animated critical metrics.
 */
@Component({
  selector: 'app-search-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, BottomSheetComponent, CountUpDirective],
  template: `
    <app-bottom-sheet [hideHeader]="true" (close)="ui.close()">

      <!-- Custom Search Header -->
      <div class="flex items-center gap-2 mb-3">
        <div class="flex flex-1 items-center gap-2 rounded-2xl bg-appbg px-4 ring-1 ring-black/5 focus-within:ring-black/10 transition">
          <svg class="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input [ngModel]="ui.query()" (ngModelChange)="ui.query.set($event)"
                 type="search" inputmode="search" autocomplete="off"
                 placeholder="Ej: María, V-12.345.678, Catia…"
                 class="w-full bg-transparent py-3.5 text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none" />
          @if (ui.query()) {
            <button (click)="ui.query.set('')" class="text-slate-400 hover:text-slate-600 font-bold">✕</button>
          }
        </div>
        <button type="button" (click)="ui.close()" class="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-appbg text-slate-500 hover:bg-black/5 transition ring-1 ring-black/5">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Minimalist Metrics -->
      <div class="flex items-center justify-between px-1 text-[11px] font-semibold text-textmuted mb-4 pb-4 border-b border-black/5">
        <span><b class="text-textmain font-extrabold text-sm" [appCountUp]="m().total_reportados"></b> Reg.</span>
        <span><b class="text-red-500 font-extrabold text-sm" [appCountUp]="m().desaparecidos"></b> Desaparecidos</span>
        <span><b class="text-green-600 font-extrabold text-sm" [appCountUp]="m().localizados"></b> Encontrados</span>
      </div>

      <!-- Filtros -->
      <div class="mb-3 space-y-2">
        <div class="flex flex-wrap gap-1.5">
          @for (e of estadoChips; track e.val) {
            <button type="button" (click)="estadoFilter.set(e.val)"
                    class="rounded-full px-3 py-1 text-[11px] font-bold transition"
                    [style.background]="estadoFilter() === e.val ? e.bg : 'var(--chip-bg)'"
                    [style.color]="estadoFilter() === e.val ? '#fff' : 'var(--txt-muted)'">
              {{ e.label }}
            </button>
          }
        </div>
        <select [ngModel]="centroFilter()" (ngModelChange)="centroFilter.set($event)"
                class="w-full rounded-xl px-3 py-2.5 text-sm font-medium outline-none ring-1"
                style="background: var(--sheet-inset); color: var(--txt); --tw-ring-color: var(--glass-border)">
          <option value="">Todos los sitios (hospital/refugio)</option>
          <optgroup label="Hospitales">
            @for (h of data.hospitales(); track h.id) { <option [value]="h.id">{{ h.nombre }}</option> }
          </optgroup>
          <optgroup label="Refugios">
            @for (r of data.refugios(); track r.id) { <option [value]="r.id">{{ r.nombre }}</option> }
          </optgroup>
        </select>
      </div>

      <div class="px-1 mb-2 text-[11px] font-semibold text-textmuted">{{ results().length }} resultado(s)</div>

      <!-- Results -->
      <ul class="space-y-3">
        @for (p of results(); track p.id) {
          <li>
            <button (click)="focus(p)"
                    class="flex w-full items-start gap-3 rounded-xl bg-white p-4 text-left shadow-sm
                           ring-1 ring-borderlight hover:bg-appbg active:scale-[.99] transition fade-in">
              <span class="mt-1 h-3 w-3 shrink-0 rounded-full shadow-sm"
                    [style.background]="p.estado === 'a_salvo' ? '#38A169' : p.estado === 'desaparecido' ? '#E53E3E' : '#718096'"></span>
              @if (p.foto_url) {
                <div class="h-12 w-12 shrink-0 rounded-lg overflow-hidden ring-1 ring-black/5 shadow-sm">
                  <img [src]="p.foto_url" class="h-full w-full object-cover" />
                </div>
              }
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-2">
                  <span class="truncate text-sm font-bold text-textmain">{{ p.nombre }}</span>
                  <span class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" [class]="chip(p.estado)">{{ label(p.estado) }}</span>
                </span>
                <span class="mt-1 block truncate text-[13px] text-textmuted">{{ p.cedula ?? 'Sin cédula' }} · {{ p.ubicacion }}</span>
                @if (p.telefono_contacto) {
                  <span class="mt-1 block text-[12px] font-semibold text-info">📞 {{ p.telefono_contacto }}</span>
                }
                <span class="mt-1 block text-[11px] font-semibold text-textmuted">{{ source(p.fuente) }} · {{ ago(p.created_at) }}{{ p.veces_reportado > 1 ? ' · ⚑ '+p.veces_reportado+' fuentes' : '' }}</span>
              </span>
              <span class="mt-2 text-textmuted font-bold">›</span>
            </button>
          </li>
        } @empty {
          <li class="rounded-xl bg-appbg p-8 text-center text-sm font-medium text-textmuted ring-1 ring-borderlight shadow-inner">
            Sin coincidencias para "{{ ui.query() }}".
          </li>
        }
      </ul>
    </app-bottom-sheet>
  `
})
export class SearchSheetComponent {
  data = inject(CrisisDataService);
  ui = inject(UiService);

  readonly m = this.data.metrics;

  readonly estadoFilter = signal<'todos' | PersonStatus>('todos');
  readonly centroFilter = signal<string>(''); // centro_id o '' (todos)

  readonly estadoChips = [
    { val: 'todos', label: 'Todos', bg: '#64748b' },
    { val: 'desaparecido', label: 'Desaparecidos', bg: 'var(--c-alert)' },
    { val: 'a_salvo', label: 'A salvo', bg: 'var(--c-safe)' },
    { val: 'fallecido', label: 'Fallecidos', bg: '#94a3b8' },
  ] as const;

  readonly results = computed(() => {
    const q = this.norm(this.ui.query());
    const estado = this.estadoFilter();
    const centro = this.centroFilter();
    return this.data.people()
      .filter((p) => estado === 'todos' || p.estado === estado)
      .filter((p) => !centro || p.centro_id === centro)
      .filter((p) =>
        !q ||
        this.norm(p.nombre).includes(q) ||
        this.norm(p.cedula ?? '').includes(q) ||
        this.norm(p.ubicacion).includes(q)
      );
  });

  focus(p: { id: string; lat: number; lng: number }): void {
    this.ui.focusOn({ lat: p.lat, lng: p.lng, id: p.id, zoom: 15 });
  }

  chip = (s: any) => STATUS_CHIP[s as keyof typeof STATUS_CHIP];
  label = (s: any) => STATUS_LABEL[s as keyof typeof STATUS_LABEL];
  source = (s: any) => SOURCE_LABEL[s as keyof typeof SOURCE_LABEL];
  ago = (iso: string) => timeAgo(iso);

  private norm(s: string): string {
    return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
}
