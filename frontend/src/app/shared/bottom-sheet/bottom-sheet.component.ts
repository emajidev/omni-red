import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Reusable half-screen bottom sheet. Sits over the map; tapping the backdrop or
 * the close button dismisses it. Content is projected via <ng-content>.
 */
@Component({
  selector: 'app-bottom-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Backdrop -->
    <div class="fixed inset-0 z-[1000] bg-primary/30 backdrop-blur-sm transition-opacity"
         (click)="close.emit()"></div>

    <!-- Sheet -->
    <section
      class="fixed bottom-0 inset-x-0 sm:left-[10vw] sm:right-[10vw] sm:w-[80vw] z-[1001] flex max-h-[85vh] sm:max-h-[75vh] min-h-[50vh] sm:min-h-[45vh] flex-col
             rounded-t-3xl border-t border-black/5 bg-white shadow-sheet animate-sheet-up
             pb-[env(safe-area-inset-bottom)]"
      role="dialog" aria-modal="true">

      <!-- Grab handle -->
      <div class="flex justify-center pt-3 pb-1">
        <span class="h-1.5 w-12 rounded-full bg-black/10"></span>
      </div>

      <!-- Header (Optional) -->
      @if (!hideHeader) {
        <header class="flex items-center gap-3 px-5 pt-2 pb-4 border-b border-black/5">
          <span class="grid h-10 w-10 place-items-center rounded-2xl text-xl shadow-sm"
                [class]="accentBg">
            @switch (icon) {
              @case ('alert') { <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg> }
              @case ('safe') { <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> }
              @case ('search') { <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg> }
              @case ('camera') { <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0118.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg> }
              @case ('hospital') { <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg> }
              @default { <span class="text-base font-bold">{{ icon }}</span> }
            }
          </span>
          <div class="min-w-0 flex-1">
            <h2 class="truncate text-lg font-extrabold text-textmain">{{ title }}</h2>
            @if (subtitle) {
              <p class="truncate text-[13px] font-medium text-textmuted">{{ subtitle }}</p>
            }
          </div>
          <button type="button" (click)="close.emit()"
                  class="grid h-10 w-10 place-items-center rounded-2xl bg-black/5 text-slate-500
                         hover:bg-black/10 active:scale-95 transition"
                  aria-label="Cerrar">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </header>
      }

      <!-- Scrollable body -->
      <div class="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
        <ng-content></ng-content>
      </div>
    </section>
  `
})
export class BottomSheetComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() icon = '•';
  @Input() hideHeader = false;
  /** Tailwind classes for the icon badge background. */
  @Input() accentBg = 'bg-appbg text-textmain';
  @Output() close = new EventEmitter<void>();
}
