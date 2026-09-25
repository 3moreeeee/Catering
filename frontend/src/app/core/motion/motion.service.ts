import { DOCUMENT, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * The single authority on whether the application is allowed to animate.
 *
 * Every animated surface asks this service first. Nothing reads
 * `matchMedia('(prefers-reduced-motion)')` directly, so the policy can never
 * drift between components.
 */
@Injectable({ providedIn: 'root' })
export class MotionService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly reduced = signal(false);
  /** True when the user has asked for reduced motion. */
  readonly prefersReducedMotion = this.reduced.asReadonly();

  private gsapPromise: Promise<typeof import('gsap')> | null = null;

  constructor() {
    if (!this.isBrowser) {
      // On the server, assume reduced motion: SSR output must be the static,
      // fully-visible version of every page.
      this.reduced.set(true);
      return;
    }

    const query = this.document.defaultView?.matchMedia('(prefers-reduced-motion: reduce)');
    if (query) {
      this.reduced.set(query.matches);
      query.addEventListener('change', (event) => this.reduced.set(event.matches));
    }
  }

  /** Motion is permitted only in the browser and only if the user allows it. */
  get canAnimate(): boolean {
    return this.isBrowser && !this.reduced();
  }

  /** Desktop-only enhancements (magnetic buttons, cursor parallax, panel hover). */
  get hasFinePointer(): boolean {
    return (
      this.isBrowser &&
      (this.document.defaultView?.matchMedia('(hover: hover) and (pointer: fine)').matches ?? false)
    );
  }

  /**
   * Lazily loads GSAP with ScrollTrigger registered exactly once.
   * Returns null when motion is not permitted — so the ~50 KB GSAP chunk is
   * never fetched for a reduced-motion user.
   */
  async gsap(): Promise<typeof import('gsap') | null> {
    if (!this.canAnimate) {
      return null;
    }
    this.gsapPromise ??= (async () => {
      const [core, scrollTrigger] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      core.gsap.registerPlugin(scrollTrigger.ScrollTrigger);
      return core;
    })();
    return this.gsapPromise;
  }
}
