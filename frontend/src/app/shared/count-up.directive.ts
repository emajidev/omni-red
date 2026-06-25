import { Directive, ElementRef, effect, inject, input } from '@angular/core';

/**
 * Animates a number from its previous value to the new one (count-up).
 * Usage: <span [appCountUp]="metric()"></span>
 */
@Directive({ selector: '[appCountUp]', standalone: true })
export class CountUpDirective {
  private el = inject(ElementRef<HTMLElement>);
  readonly value = input.required<number>({ alias: 'appCountUp' });
  private prev = 0;

  constructor() {
    effect(() => this.run(this.value()));
  }

  private run(to: number): void {
    const from = this.prev;
    this.prev = to;
    const dur = 550;
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      this.el.nativeElement.textContent = String(Math.round(from + (to - from) * eased));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}
