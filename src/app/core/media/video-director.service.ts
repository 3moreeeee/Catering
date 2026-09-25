import { DOCUMENT, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MotionService } from '../motion/motion.service';

/**
 * A player the director is allowed to start and stop.
 *
 * `cinematic-media` registers itself as one of these. The director never
 * touches the DOM; it only decides who is allowed to be playing.
 */
export interface ManagedPlayer {
  /** How much of the element is currently visible, 0–1. */
  visibility: number;
  play(): void;
  pause(): void;
}

/**
 * Browser hints that are still not in the TS DOM lib.
 */
interface NavigatorWithSaveData extends Navigator {
  readonly connection?: { saveData?: boolean; effectiveType?: string };
}

/**
 * The single authority on which video — if any — is allowed to decode.
 *
 * Two jobs, both of which exist to protect the homepage's performance budget:
 *
 * 1. **One player at a time.** Seven chapters on one page means seven video
 *    decoders competing for the same handful of hardware decode slots. On a
 *    mid-range Android that is the difference between a smooth page and a
 *    janky one. Players report how visible they are; the most visible player
 *    wins and every other one is paused.
 *
 * 2. **Whether video is permitted at all.** Reduced motion, Save-Data, or a
 *    2G/3G connection mean the page shows poster
 *    frames and never downloads a single video file. This is checked once,
 *    in the browser, before any `<video>` element is given a `src`.
 *
 * On the server `videoPermitted` is false, so SSR always emits the poster —
 * which is exactly what we want, because the poster is the LCP element.
 */
@Injectable({ providedIn: 'root' })
export class VideoDirectorService {
  private readonly document = inject(DOCUMENT);
  private readonly motion = inject(MotionService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly players = new Set<ManagedPlayer>();
  private current: ManagedPlayer | null = null;

  private readonly permitted = signal(false);
  /**
   * True only when this device, connection and user preference all allow
   * video. Components must render the poster and skip the `<video>` source
   * entirely when this is false.
   */
  readonly videoPermitted = this.permitted.asReadonly();

  constructor() {
    if (!this.isBrowser) {
      return;
    }
    this.permitted.set(this.assessDevice());

    // Reduced motion can be toggled while the page is open; honour it live.
    const query = this.document.defaultView?.matchMedia('(prefers-reduced-motion: reduce)');
    query?.addEventListener('change', () => {
      const allowed = this.assessDevice();
      this.permitted.set(allowed);
      if (!allowed) {
        this.pauseAll();
      }
    });

    // Browsers may suspend video while the tab is hidden. IntersectionObserver
    // does not necessarily fire again when the tab becomes visible, so resume
    // the visible winner explicitly for reliable demo playback.
    this.document.addEventListener('visibilitychange', () => {
      if (!this.document.hidden) {
        this.reconsider();
      }
    });
  }

  /**
   * Decides once whether this visitor gets video at all.
   *
   * Deliberately conservative: every unknown is treated as a reason to fall
   * back to the poster. A poster that shows instantly is a better experience
   * than a film that stutters.
   */
  private assessDevice(): boolean {
    if (!this.motion.canAnimate) {
      return false;
    }
    const nav = this.document.defaultView?.navigator as NavigatorWithSaveData | undefined;
    if (!nav) {
      return false;
    }
    if (nav.connection?.saveData) {
      return false;
    }
    const effectiveType = nav.connection?.effectiveType;
    if (effectiveType === 'slow-2g' || effectiveType === '2g' || effectiveType === '3g') {
      return false;
    }
    return true;
  }

  register(player: ManagedPlayer): void {
    this.players.add(player);
  }

  unregister(player: ManagedPlayer): void {
    this.players.delete(player);
    if (this.current === player) {
      this.current = null;
    }
  }

  /**
   * Called by a player whenever its visibility changes. Picks the most visible
   * player above the threshold, starts it, and pauses everyone else.
   *
   * The 0.35 threshold means a chapter has to be meaningfully on screen before
   * it costs anything — scrolling quickly past a section never starts its film.
   */
  reconsider(): void {
    if (!this.permitted()) {
      this.pauseAll();
      return;
    }

    let best: ManagedPlayer | null = null;
    for (const player of this.players) {
      if (player.visibility < 0.35) {
        continue;
      }
      if (!best || player.visibility > best.visibility) {
        best = player;
      }
    }

    if (best === this.current) {
      // `current` records the selected player, not whether the browser has
      // silently paused it. Calling play is idempotent and repairs that state.
      best?.play();
      return;
    }

    this.current?.pause();
    this.current = best;
    best?.play();
  }

  private pauseAll(): void {
    for (const player of this.players) {
      player.pause();
    }
    this.current = null;
  }
}
