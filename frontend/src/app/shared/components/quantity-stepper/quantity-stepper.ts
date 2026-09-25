import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * A − / value / + quantity control.
 *
 * Replaces the bare `<input type="number">`, whose native spinner arrows are
 * tiny, inconsistent across browsers and unusable on touch. The field stays
 * typeable for a buyer entering a large B2B quantity directly; the typed value
 * is committed on change (blur or Enter), not on every keystroke, so the cart
 * does not fire one request per digit.
 */
@Component({
  selector: 'fk-quantity-stepper',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="qty" [class.qty--lg]="size() === 'lg'" role="group" [attr.aria-label]="label()">
      <button
        type="button"
        class="qty__btn"
        [disabled]="disabled() || value() <= min()"
        [attr.aria-label]="decreaseLabel()"
        (click)="commit(value() - 1)"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M5 12h14" />
        </svg>
      </button>
      <input
        class="qty__input"
        type="number"
        inputmode="numeric"
        [id]="inputId()"
        [min]="min()"
        [max]="max()"
        step="1"
        [value]="value()"
        [disabled]="disabled()"
        [attr.aria-label]="label()"
        (change)="onTyped($event)"
        (keydown.enter)="$any($event.target).blur()"
      />
      <button
        type="button"
        class="qty__btn"
        [disabled]="disabled() || value() >= max()"
        [attr.aria-label]="increaseLabel()"
        (click)="commit(value() + 1)"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M5 12h14M12 5v14" />
        </svg>
      </button>
    </div>
  `,
  styleUrl: './quantity-stepper.scss',
})
export class QuantityStepper {
  readonly value = input.required<number>();
  readonly min = input(1);
  readonly max = input(9999);
  readonly disabled = input(false);
  readonly size = input<'md' | 'lg'>('md');
  readonly inputId = input<string | null>(null);
  readonly label = input('');
  readonly decreaseLabel = input('−');
  readonly increaseLabel = input('+');

  readonly valueChange = output<number>();

  onTyped(event: Event): void {
    const field = event.target as HTMLInputElement;
    const typed = Math.trunc(Number(field.value));
    const next = this.clamp(Number.isFinite(typed) ? typed : this.value());
    this.commit(next);
    // An out-of-range or cleared entry is clamped; show the clamped figure
    // rather than leaving the rejected text in the field.
    field.value = String(next);
  }

  commit(next: number): void {
    const clamped = this.clamp(next);
    if (clamped !== this.value()) this.valueChange.emit(clamped);
  }

  private clamp(next: number): number {
    return Math.min(this.max(), Math.max(this.min(), next));
  }
}
