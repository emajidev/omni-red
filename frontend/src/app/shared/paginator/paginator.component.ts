import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/**
 * Paginador reutilizable (numerado, con selector de tamaño de página).
 *
 * Es "tonto": solo muestra controles y emite cambios. Sirve tanto para
 * paginación de servidor (el padre pasa el `total` del backend y vuelve a
 * consultar al cambiar de página) como de cliente (el padre pasa
 * `array.length` y corta el array según `page`/`pageSize`).
 *
 * Uso:
 *   <app-paginator [total]="total()" [page]="page()" [pageSize]="size()"
 *                  (pageChange)="page.set($event)" (pageSizeChange)="size.set($event)" />
 */
@Component({
  selector: 'app-paginator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (totalPages() > 1 || (showSizeSelector() && total() > minToShow())) {
      <div class="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t"
           style="border-color: var(--divider)">
        <span class="text-[11px] font-semibold" style="color: var(--txt-muted)">
          {{ rangeStart() }}–{{ rangeEnd() }} de {{ total() }}
        </span>

        <div class="flex items-center gap-1">
          <button type="button" (click)="go(page() - 1)" [disabled]="page() <= 1"
                  class="grid h-7 w-7 place-items-center rounded-lg text-sm font-bold ring-1 transition disabled:opacity-40"
                  style="background: var(--chip-bg); color: var(--txt); --tw-ring-color: var(--glass-border)"
                  aria-label="Página anterior">‹</button>

          @for (n of pages(); track $index) {
            @if (n === -1) {
              <span class="px-1 text-[11px]" style="color: var(--txt-muted)">…</span>
            } @else {
              <button type="button" (click)="go(n)"
                      class="grid h-7 min-w-[1.75rem] place-items-center rounded-lg px-2 text-[12px] font-bold ring-1 transition"
                      [style.background]="n === page() ? 'var(--c-info)' : 'var(--chip-bg)'"
                      [style.color]="n === page() ? '#fff' : 'var(--txt)'"
                      [style.--tw-ring-color]="n === page() ? 'var(--c-info)' : 'var(--glass-border)'"
                      [attr.aria-current]="n === page() ? 'page' : null">
                {{ n }}
              </button>
            }
          }

          <button type="button" (click)="go(page() + 1)" [disabled]="page() >= totalPages()"
                  class="grid h-7 w-7 place-items-center rounded-lg text-sm font-bold ring-1 transition disabled:opacity-40"
                  style="background: var(--chip-bg); color: var(--txt); --tw-ring-color: var(--glass-border)"
                  aria-label="Página siguiente">›</button>
        </div>

        @if (showSizeSelector()) {
          <select [value]="pageSize()" (change)="changeSize($event)"
                  class="rounded-lg px-2 py-1 text-[11px] font-semibold outline-none ring-1"
                  style="background: var(--sheet-inset); color: var(--txt); --tw-ring-color: var(--glass-border)"
                  aria-label="Elementos por página">
            @for (s of pageSizeOptions(); track s) {
              <option [value]="s">{{ s }} / pág.</option>
            }
          </select>
        }
      </div>
    }
  `,
})
export class PaginatorComponent {
  /** Total de elementos (servidor: total del backend; cliente: array.length). */
  readonly total = input.required<number>();
  /** Página actual (1-based). */
  readonly page = input.required<number>();
  readonly pageSize = input<number>(20);
  readonly pageSizeOptions = input<number[]>([10, 20, 50, 100]);
  readonly showSizeSelector = input<boolean>(true);
  /** Muestra el selector de tamaño aunque haya una sola página, si total > este valor. */
  readonly minToShow = input<number>(0);

  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / Math.max(1, this.pageSize()))),
  );
  readonly rangeStart = computed(() =>
    this.total() === 0 ? 0 : (this.page() - 1) * this.pageSize() + 1,
  );
  readonly rangeEnd = computed(() => Math.min(this.page() * this.pageSize(), this.total()));

  /** Números de página a mostrar, con -1 como separador "…". */
  readonly pages = computed<number[]>(() => {
    const tp = this.totalPages();
    const cur = this.page();
    if (tp <= 7) return Array.from({ length: tp }, (_, i) => i + 1);
    const wanted = [1, tp, cur, cur - 1, cur + 1].filter((n) => n >= 1 && n <= tp);
    const arr = [...new Set(wanted)].sort((a, b) => a - b);
    const out: number[] = [];
    let prev = 0;
    for (const n of arr) {
      if (n - prev > 1) out.push(-1);
      out.push(n);
      prev = n;
    }
    return out;
  });

  go(n: number): void {
    const target = Math.min(Math.max(1, n), this.totalPages());
    if (target !== this.page()) this.pageChange.emit(target);
  }

  changeSize(ev: Event): void {
    const v = Number((ev.target as HTMLSelectElement).value);
    if (Number.isFinite(v) && v !== this.pageSize()) this.pageSizeChange.emit(v);
  }
}
