import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BottomSheetComponent } from '../../shared/bottom-sheet/bottom-sheet.component';
import { CountUpDirective } from '../../shared/count-up.directive';
import { PaginatorComponent } from '../../shared/paginator/paginator.component';
import { CrisisDataService } from '../../core/services/crisis-data.service';
import { UiService } from '../../core/services/ui.service';
import { ExternalPerson, PagedPersonas, PersonStatus } from '../../core/models/models';
import { SOURCE_LABEL, STATUS_CHIP, STATUS_LABEL, timeAgo } from '../../core/util/labels';

/**
 * Buscador + resultados. La búsqueda/paginación de personas se resuelve en el
 * SERVIDOR (endpoint paginado): búsqueda por nombre/cédula y filtros por
 * estado, ubicación y sitio (hospital/refugio). El registro médico externo
 * (fvivemas) sigue como fallback.
 */
@Component({
  selector: 'app-search-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, BottomSheetComponent, CountUpDirective, PaginatorComponent],
  template: `
    <app-bottom-sheet [hideHeader]="true" (close)="ui.close()">

      <!-- Custom Search Header -->
      <div class="flex items-center gap-2 mb-3">
        <div class="flex flex-1 items-center gap-2 rounded-2xl bg-appbg px-4 ring-1 ring-black/5 focus-within:ring-black/10 transition">
          <svg class="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input [ngModel]="ui.query()" (ngModelChange)="onQuery($event)"
                 type="search" inputmode="search" autocomplete="off"
                 placeholder="Buscar por nombre o cédula…"
                 class="w-full bg-transparent py-3.5 text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none" />
          @if (ui.query()) {
            <button (click)="onQuery('')" class="text-slate-400 hover:text-slate-600 font-bold">✕</button>
          }
        </div>
        <button type="button" (click)="ui.close()" class="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-appbg text-slate-500 hover:bg-black/5 transition ring-1 ring-black/5">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Minimalist Metrics (del contexto de búsqueda, calculadas en servidor) -->
      <div class="flex items-center justify-between px-1 text-[11px] font-semibold text-textmuted mb-4 pb-4 border-b border-black/5">
        <span><b class="text-textmain font-extrabold text-sm" [appCountUp]="totals().personas"></b> Reg.</span>
        <span><b class="text-red-500 font-extrabold text-sm" [appCountUp]="totals().desaparecidos"></b> Desaparecidos</span>
        <span><b class="text-green-600 font-extrabold text-sm" [appCountUp]="totals().encontrados"></b> Encontrados</span>
      </div>

      <!-- Filtros -->
      <div class="mb-3 space-y-2">
        <div class="flex flex-wrap gap-1.5">
          @for (e of estadoChips; track e.val) {
            <button type="button" (click)="setEstado(e.val)"
                    class="rounded-full px-3 py-1 text-[11px] font-bold transition"
                    [style.background]="estadoFilter() === e.val ? e.bg : 'var(--chip-bg)'"
                    [style.color]="estadoFilter() === e.val ? '#fff' : 'var(--txt-muted)'">
              {{ e.label }}
            </button>
          }
        </div>
        <input [ngModel]="ubicacionFilter()" (ngModelChange)="setUbicacion($event)"
               type="text" autocomplete="off" placeholder="Filtrar por ubicación (Ej: Catia)…"
               class="w-full rounded-xl px-3 py-2.5 text-sm font-medium outline-none ring-1"
               style="background: var(--sheet-inset); color: var(--txt); --tw-ring-color: var(--glass-border)" />
        <select [ngModel]="centroFilter()" (ngModelChange)="setCentro($event)"
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

      <div class="px-1 mb-2 flex items-center justify-between text-[11px] font-semibold text-textmuted">
        <span>{{ totalCount() }} resultado(s)</span>
        @if (loading()) { <span class="animate-pulse">Buscando…</span> }
      </div>

      <!-- Results -->
      <ul class="space-y-3">
        @for (p of rows(); track p.id) {
          <li>
            <button (click)="focus(p)"
                    class="flex w-full items-start gap-3 rounded-xl bg-white p-4 text-left shadow-sm
                           ring-1 ring-borderlight hover:bg-appbg active:scale-[.99] transition fade-in">
              <span class="mt-1 h-3 w-3 shrink-0 rounded-full shadow-sm"
                    [style.background]="p.estado === 'encontrado' ? '#38A169' : p.estado === 'desaparecido' ? '#E53E3E' : '#718096'"></span>
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
                <span class="mt-1 block truncate text-[13px] text-textmuted">{{ p.cedula ?? 'Sin cédula' }}{{ p.edad ? ' · ' + p.edad + ' años' : '' }} · {{ p.ubicacion }}</span>
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
            @if (externalResults().length) {
              Sin coincidencias en la base local. Mira el registro médico externo 👇
            } @else {
              Sin coincidencias{{ ui.query() ? ' para "' + ui.query() + '"' : '' }}.
            }
          </li>
        }
      </ul>

      <!-- Paginación (servidor) -->
      <app-paginator [total]="totalCount()" [page]="page()" [pageSize]="size()"
                     (pageChange)="goPage($event)" (pageSizeChange)="changeSize($event)" />

      <!-- Fallback: fuentes externas (fvivemas + ayuda-api) -->
      @if (externalResults().length) {
        <div class="mt-5 border-t border-black/5 pt-4">
          <div class="mb-2 flex items-center gap-2 px-1">
            <span class="rounded-full bg-info/15 px-2 py-0.5 text-[10px] font-bold text-info ring-1 ring-info/30">Fuentes externas</span>
            <span class="text-[11px] font-semibold text-textmuted">fvivemas + ayuda-api ({{ externalResults().length }})</span>
          </div>
          <ul class="space-y-3">
            @for (p of externalResults(); track p.id) {
              <li>
                <button (click)="focusExternal(p)"
                        class="flex w-full items-start gap-3 rounded-xl bg-white p-4 text-left shadow-sm
                               ring-1 ring-borderlight hover:bg-appbg active:scale-[.99] transition fade-in">
                  <span class="mt-1 h-3 w-3 shrink-0 rounded-full bg-info shadow-sm"></span>
                  <span class="min-w-0 flex-1">
                    <span class="flex items-center gap-2">
                      <span class="truncate text-sm font-bold text-textmain">{{ p.nombre }}</span>
                      <span class="shrink-0 rounded-full bg-info/15 px-2 py-0.5 text-[10px] font-bold text-info ring-1 ring-info/30">{{ p.fuente }}</span>
                    </span>
                    <span class="mt-1 block truncate text-[13px] text-textmuted">{{ p.cedula ?? 'Sin cédula' }}{{ p.edad ? ' · ' + p.edad + ' años' : '' }} · {{ p.ubicacion }}</span>
                    @if (p.telefono_contacto) {
                      <span class="mt-1 block text-[12px] font-semibold text-info">📞 {{ p.telefono_contacto }}</span>
                    }
                    @if (p.detalle) {
                      <span class="mt-1 block truncate text-[12px] text-textmuted">🩺 {{ p.detalle }}</span>
                    }
                    <span class="mt-1 block text-[11px] font-semibold text-textmuted">Registro médico externo · {{ ago(p.created_at) }}</span>
                  </span>
                  @if (p.lat != null) { <span class="mt-2 font-bold text-textmuted">›</span> }
                </button>
              </li>
            }
          </ul>
        </div>
      }
    </app-bottom-sheet>
  `
})
export class SearchSheetComponent {
  data = inject(CrisisDataService);
  ui = inject(UiService);

  readonly estadoFilter = signal<'todos' | PersonStatus>('todos');
  readonly ubicacionFilter = signal('');
  readonly centroFilter = signal<string>(''); // centro_id o '' (todos)
  readonly page = signal(1);
  readonly size = signal(20);
  readonly loading = signal(false);
  readonly result = signal<PagedPersonas | null>(null);

  private seq = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  readonly rows = computed(() => this.result()?.data ?? []);
  readonly totalCount = computed(() => this.result()?.total ?? 0);

  /** Totales del contexto de búsqueda; antes del primer fetch usa las métricas globales. */
  readonly totals = computed(() => {
    const r = this.result();
    if (r) return r.totals;
    const m = this.data.metrics();
    return {
      personas: m.total_reportados,
      encontrados: m.localizados,
      desaparecidos: m.desaparecidos,
      fallecidos: 0,
      desconocidos: 0,
    };
  });

  /** fvivemas: el backend ya devolvió las coincidencias del término actual. */
  readonly externalResults = computed<ExternalPerson[]>(() => this.data.external());

  readonly estadoChips = [
    { val: 'todos', label: 'Todos', bg: '#64748b' },
    { val: 'desaparecido', label: 'Desaparecidos', bg: 'var(--c-alert)' },
    { val: 'encontrado', label: 'Encontrados', bg: 'var(--c-safe)' },
    { val: 'fallecido', label: 'Fallecidos', bg: '#94a3b8' },
    { val: 'desconocido', label: 'Desconocidos', bg: '#94a3b8' },
  ] as const;

  constructor() {
    void this.fetch(); // carga inicial (página 1, sin filtros)

    // Fallback externo (fvivemas): se resuelve en backend, con debounce de 300ms.
    effect((onCleanup) => {
      const q = this.ui.query();
      const t = setTimeout(() => void this.data.searchExternal(q), 300);
      onCleanup(() => clearTimeout(t));
    });
  }

  // --- Cambios de filtro (resetean a página 1, con debounce) ---------------
  onQuery(v: string): void { this.ui.query.set(v); this.reload(); }
  setEstado(v: 'todos' | PersonStatus): void { this.estadoFilter.set(v); this.reload(); }
  setUbicacion(v: string): void { this.ubicacionFilter.set(v); this.reload(); }
  setCentro(v: string): void { this.centroFilter.set(v); this.reload(); }

  // --- Paginación -----------------------------------------------------------
  goPage(n: number): void { this.page.set(n); void this.fetch(); }
  changeSize(n: number): void { this.size.set(n); this.page.set(1); void this.fetch(); }

  private reload(): void {
    this.page.set(1);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.fetch(), 250);
  }

  private async fetch(): Promise<void> {
    const mySeq = ++this.seq;
    this.loading.set(true);
    try {
      const r = await this.data.searchPersonas({
        page: this.page(),
        size: this.size(),
        q: this.ui.query().trim() || undefined,
        estado: this.estadoFilter() === 'todos' ? undefined : (this.estadoFilter() as PersonStatus),
        ubicacion: this.ubicacionFilter().trim() || undefined,
        centroId: this.centroFilter() || undefined,
      });
      if (mySeq === this.seq) this.result.set(r);
    } catch {
      if (mySeq === this.seq) this.result.set(null);
    } finally {
      if (mySeq === this.seq) this.loading.set(false);
    }
  }

  focus(p: { id: string; lat: number; lng: number }): void {
    this.ui.focusOn({ lat: p.lat, lng: p.lng, id: p.id, zoom: 15 });
  }

  /** Centra el mapa en el hospital del registro externo (no hay marcador). */
  focusExternal(p: ExternalPerson): void {
    if (p.lat != null && p.lng != null) {
      this.ui.focusOn({ lat: p.lat, lng: p.lng, id: p.id, zoom: 15 });
    }
  }

  chip = (s: any) => STATUS_CHIP[s as keyof typeof STATUS_CHIP];
  label = (s: any) => STATUS_LABEL[s as keyof typeof STATUS_LABEL];
  source = (s: any) => SOURCE_LABEL[s as keyof typeof SOURCE_LABEL];
  ago = (iso: string) => timeAgo(iso);
}
