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
    <div class="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-[2px]"
         (click)="close.emit()"></div>

    <!-- Sheet -->
    <section
      class="fixed inset-x-0 bottom-0 z-[1001] flex max-h-[64vh] min-h-[42vh] flex-col
             rounded-t-2xl border-t border-ink-600 bg-ink-800 shadow-2xl animate-sheet-up
             pb-[env(safe-area-inset-bottom)]"
      role="dialog" aria-modal="true">

      <!-- Grab handle -->
      <div class="flex justify-center pt-2.5">
        <span class="h-1.5 w-10 rounded-full bg-ink-600"></span>
      </div>

      <!-- Header -->
      <header class="flex items-center gap-3 px-4 pt-2 pb-3 border-b border-ink-700">
        <span class="grid h-9 w-9 place-items-center rounded-xl text-lg"
              [class]="accentBg">{{ icon }}</span>
        <div class="min-w-0 flex-1">
          <h2 class="truncate text-base font-bold text-slate-100">{{ title }}</h2>
          @if (subtitle) {
            <p class="truncate text-xs text-slate-400">{{ subtitle }}</p>
          }
        </div>
        <button type="button" (click)="close.emit()"
                class="grid h-9 w-9 place-items-center rounded-xl bg-ink-700 text-slate-300
                       hover:bg-ink-600 active:scale-95 transition"
                aria-label="Cerrar">✕</button>
      </header>

      <!-- Scrollable body -->
      <div class="flex-1 overflow-y-auto overscroll-contain px-4 py-3">
        <ng-content></ng-content>
      </div>
    </section>
  `
})
export class BottomSheetComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() icon = '•';
  /** Tailwind classes for the icon badge background. */
  @Input() accentBg = 'bg-ink-700 text-slate-200';
  @Output() close = new EventEmitter<void>();
}
