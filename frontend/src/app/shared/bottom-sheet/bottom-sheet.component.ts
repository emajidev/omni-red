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
      class="fixed inset-x-0 bottom-0 z-[1001] flex max-h-[75vh] min-h-[45vh] flex-col
             rounded-t-3xl border-t border-borderlight bg-surface shadow-sheet animate-sheet-up
             pb-[env(safe-area-inset-bottom)]"
      role="dialog" aria-modal="true">

      <!-- Grab handle -->
      <div class="flex justify-center pt-3 pb-1">
        <span class="h-1.5 w-12 rounded-full bg-borderlight"></span>
      </div>

      <!-- Header -->
      <header class="flex items-center gap-3 px-5 pt-2 pb-4 border-b border-borderlight/60">
        <span class="grid h-10 w-10 place-items-center rounded-2xl text-xl shadow-sm"
              [class]="accentBg">{{ icon }}</span>
        <div class="min-w-0 flex-1">
          <h2 class="truncate text-lg font-extrabold text-textmain">{{ title }}</h2>
          @if (subtitle) {
            <p class="truncate text-[13px] font-medium text-textmuted">{{ subtitle }}</p>
          }
        </div>
        <button type="button" (click)="close.emit()"
                class="grid h-10 w-10 place-items-center rounded-2xl bg-appbg text-textmuted
                       hover:bg-borderlight active:scale-95 transition"
                aria-label="Cerrar">
                <span class="font-bold">✕</span>
        </button>
      </header>

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
  /** Tailwind classes for the icon badge background. */
  @Input() accentBg = 'bg-appbg text-textmain';
  @Output() close = new EventEmitter<void>();
}
