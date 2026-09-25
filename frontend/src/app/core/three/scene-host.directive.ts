import {
  DOCUMENT,
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import { HeroOrbitScene } from './scenes/hero-orbit.scene';
import { WebGLCapabilityService } from './webgl-capability.service';

/**
 * Owns the entire WebGL lifecycle so no scene has to remember it:
 *
 *  - imports `three` lazily, and only when the tier permits it;
 *  - starts the RAF loop on viewport entry, **cancels** it on exit;
 *  - pauses on tab blur;
 *  - self-demotes if frame time degrades;
 *  - disposes every GPU resource on destroy.
 *
 * The canvas is decorative: it is `aria-hidden` and carries no information that
 * is not already stated in adjacent HTML.
 */
@Directive({
  selector: 'canvas[fkHeroScene]',
  exportAs: 'fkHeroScene',
  standalone: true,
  host: {
    'aria-hidden': 'true',
    '[class.is-ready]': 'ready()',
  },
})
export class HeroSceneDirective {
  private readonly host = inject<ElementRef<HTMLCanvasElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly capability = inject(WebGLCapabilityService);
  private readonly destroyRef = inject(DestroyRef);

  /** True once the first frame has been drawn — fades the canvas over the poster. */
  readonly ready = signal(false);

  private scene: HeroOrbitScene | null = null;
  private frameId = 0;
  private lastTime = 0;
  private visible = false;
  private running = false;

  // Rolling frame-time monitor for self-demotion.
  private frameSamples: number[] = [];
  private demoted = false;

  constructor() {
    afterNextRender(() => void this.setup());
  }

  private async setup(): Promise<void> {
    const tier = this.capability.tier();
    if (tier === 'off') {
      // `three` is never imported. The poster image is the whole experience.
      return;
    }

    const three = await import('three');
    const canvas = this.host.nativeElement;
    const scene = new HeroOrbitScene(three, canvas, tier);
    await scene.init();
    this.scene = scene;

    this.applySize();

    const resizeObserver = new ResizeObserver(() => this.applySize());
    resizeObserver.observe(canvas.parentElement ?? canvas);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        this.visible = entry?.isIntersecting ?? false;
        this.visible ? this.start() : this.stop();
      },
      { threshold: 0.01 },
    );
    intersectionObserver.observe(canvas);

    const onVisibility = (): void => {
      this.document.hidden || !this.visible ? this.stop() : this.start();
    };
    this.document.addEventListener('visibilitychange', onVisibility);

    const onPointerMove = (event: PointerEvent): void => {
      const rect = canvas.getBoundingClientRect();
      this.scene?.setPointer(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -(((event.clientY - rect.top) / rect.height) * 2 - 1),
      );
    };
    if (tier === 'full') {
      this.document.addEventListener('pointermove', onPointerMove, { passive: true });
    }

    // `static` tier: one frame, then stop. Still 3D, zero ongoing cost.
    if (tier === 'static') {
      scene.update(0);
      scene.render();
      this.ready.set(true);
    }

    this.destroyRef.onDestroy(() => {
      this.stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      this.document.removeEventListener('visibilitychange', onVisibility);
      this.document.removeEventListener('pointermove', onPointerMove);
      this.scene?.dispose();
      this.scene = null;
    });
  }

  private applySize(): void {
    const canvas = this.host.nativeElement;
    const parent = canvas.parentElement;
    const width = parent?.clientWidth ?? canvas.clientWidth;
    const height = parent?.clientHeight ?? canvas.clientHeight;
    const ratio = Math.min(
      this.document.defaultView?.devicePixelRatio ?? 1,
      this.capability.maxPixelRatio(),
    );
    this.scene?.resize(width, height, ratio);
  }

  private start(): void {
    if (this.running || !this.scene || this.capability.tier() === 'static') {
      return;
    }
    this.running = true;
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame((time) => this.tick(time));
  }

  private stop(): void {
    // Cancel the loop outright rather than skipping frames — a paused RAF loop
    // still costs a callback every frame for the life of the page.
    this.running = false;
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = 0;
    }
  }

  private tick(time: number): void {
    if (!this.running || !this.scene) {
      return;
    }
    const delta = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;

    this.scene.update(delta);
    this.scene.render();

    if (!this.ready()) {
      this.ready.set(true);
    }

    this.monitor(delta * 1000);
    this.frameId = requestAnimationFrame((next) => this.tick(next));
  }

  /** Drops to a single static frame if the device cannot sustain the scene. */
  private monitor(frameMs: number): void {
    if (this.demoted) {
      return;
    }
    this.frameSamples.push(frameMs);
    if (this.frameSamples.length < 60) {
      return;
    }
    const mean = this.frameSamples.reduce((a, b) => a + b, 0) / this.frameSamples.length;
    this.frameSamples = [];

    if (mean > 40) {
      this.demoted = true;
      this.stop();
    }
  }
}
