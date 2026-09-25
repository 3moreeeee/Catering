import { DOCUMENT, Injectable, PLATFORM_ID, computed, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MotionService } from '../motion/motion.service';

/**
 * How much 3D this device and this user should get.
 *
 *  off    — no WebGL at all. The `three` chunk is never imported. Poster only.
 *  static — build the scene, render one frame, stop. 3D look, zero ongoing cost.
 *  lite   — reduced DPR, opaque materials, no pointer parallax, 30fps cap.
 *  full   — the intended experience.
 */
export type WebGLTier = 'off' | 'static' | 'lite' | 'full';

interface NavigatorWithHints extends Navigator {
  readonly deviceMemory?: number;
  readonly connection?: { readonly saveData?: boolean; readonly effectiveType?: string };
}

@Injectable({ providedIn: 'root' })
export class WebGLCapabilityService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly motion = inject(MotionService);

  private cachedSupport: boolean | null = null;

  /**
   * Recomputed when reduced-motion changes, so toggling the OS setting live
   * turns the canvas off without a reload.
   */
  readonly tier = computed<WebGLTier>(() => {
    if (!this.isBrowser) {
      return 'off';
    }
    if (this.motion.prefersReducedMotion()) {
      return 'off';
    }
    if (!this.supportsWebGL2()) {
      return 'off';
    }

    const nav = this.document.defaultView?.navigator as NavigatorWithHints | undefined;
    if (nav?.connection?.saveData === true) {
      return 'off';
    }
    if (nav?.connection?.effectiveType === 'slow-2g' || nav?.connection?.effectiveType === '2g') {
      return 'off';
    }

    const memory = nav?.deviceMemory ?? 8;
    const cores = nav?.hardwareConcurrency ?? 8;
    if (memory < 4 || cores <= 2) {
      return 'static';
    }

    const coarse =
      this.document.defaultView?.matchMedia('(pointer: coarse)').matches ?? false;
    const narrow = (this.document.defaultView?.innerWidth ?? 1440) < 768;
    if (coarse || narrow) {
      return 'lite';
    }

    return 'full';
  });

  /** True when a canvas should be created at all. */
  readonly enabled = computed(() => this.tier() !== 'off');

  /** Device pixel ratio ceiling for the active tier. */
  readonly maxPixelRatio = computed(() => (this.tier() === 'lite' ? 1.5 : 2));

  private supportsWebGL2(): boolean {
    if (this.cachedSupport !== null) {
      return this.cachedSupport;
    }
    try {
      const canvas = this.document.createElement('canvas');
      const context = canvas.getContext('webgl2');
      this.cachedSupport = context !== null;
      // Release the probe context immediately — browsers cap live contexts.
      context?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      this.cachedSupport = false;
    }
    return this.cachedSupport;
  }
}
