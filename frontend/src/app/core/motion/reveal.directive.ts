import {
  Directive,
  ElementRef,
  DestroyRef,
  afterNextRender,
  inject,
  input,
} from '@angular/core';
import { MotionService } from './motion.service';

export type RevealKind = 'fade-up' | 'mask' | 'stagger';

/**
 * Bare `fkReveal` (no value) binds the empty string, so the input accepts it
 * and normalises to the default kind.
 */
type RevealInput = RevealKind | '';

/**
 * Scroll-triggered entrance animation.
 *
 * The critical property: **the element's resting state is visible.** Server-
 * rendered HTML has no inline opacity, so with JS disabled, with GSAP blocked,
 * or under `prefers-reduced-motion`, the content is simply there. The directive
 * hides the element only after it has confirmed it can animate it back — so
 * there is no flash-of-invisible-content failure mode.
 */
@Directive({
  selector: '[fkReveal]',
  standalone: true,
})
export class RevealDirective {
  readonly fkReveal = input<RevealInput>('fade-up');

  /** Normalises the bare-attribute empty string to the default. */
  private kind(): RevealKind {
    const value = this.fkReveal();
    return value === '' ? 'fade-up' : value;
  }
  readonly revealDelay = input(0);
  /** Child selector to stagger, for `fkReveal="stagger"`. */
  readonly revealChildren = input<string>('');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly motion = inject(MotionService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => void this.init());
  }

  private async init(): Promise<void> {
    const gsapModule = await this.motion.gsap();
    if (!gsapModule) {
      return;
    }
    const { gsap } = gsapModule;
    const { ScrollTrigger } = await import('gsap/ScrollTrigger');
    const element = this.host.nativeElement;

    const targets: Element[] =
      this.kind() === 'stagger' && this.revealChildren()
        ? [...element.querySelectorAll(this.revealChildren())]
        : [element];

    if (targets.length === 0) {
      return;
    }

    const from =
      this.kind() === 'mask'
        ? { clipPath: 'inset(0 0 100% 0)', opacity: 1 }
        : { opacity: 0, y: 24 };

    const to =
      this.kind() === 'mask'
        ? { clipPath: 'inset(0 0 0% 0)' }
        : { opacity: 1, y: 0 };

    const tween = gsap.fromTo(targets, from, {
      ...to,
      duration: this.kind() === 'mask' ? 0.72 : 0.6,
      ease: 'power3.out',
      delay: this.revealDelay() / 1000,
      stagger: this.kind() === 'stagger' ? 0.04 : 0,
      scrollTrigger: {
        trigger: element,
        start: 'top 85%',
        once: true,
      },
    });

    this.destroyRef.onDestroy(() => {
      tween.scrollTrigger?.kill();
      tween.kill();
      ScrollTrigger.refresh();
    });
  }
}
