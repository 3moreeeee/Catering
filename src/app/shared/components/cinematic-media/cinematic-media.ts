import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { VideoDirectorService, ManagedPlayer } from '../../../core/media/video-director.service';
import { imageKitMediaUrl } from '../../../core/config/imagekit.generated';

/**
 * A cinematic chapter surface: a poster frame, with a film layered over it when
 * the device, connection and user preference all allow one.
 *
 * The load order is the whole point of this component:
 *
 * 1. The server renders **only** the `<picture>`. The poster is therefore the
 *    LCP candidate — an AVIF of roughly 30 kB that decodes almost instantly.
 *    A video element is never the LCP, which is the single most common way a
 *    cinematic homepage ends up feeling slow.
 * 2. In the browser, an IntersectionObserver waits until the section is
 *    genuinely approaching the viewport before the `<video>` is created at all.
 *    Until then not one byte of film has been requested.
 * 3. The director decides which single film is allowed to decode, so seven
 *    chapters never compete for the same hardware decode slots.
 * 4. The film fades in over the poster only once it has real frames to show,
 *    so there is no black flash and no layout shift — the poster stays
 *    underneath for the whole life of the component.
 *
 * When video is not permitted — reduced motion, Save-Data, a low-memory device,
 * a slow connection, JavaScript disabled — the poster simply remains. That is a
 * complete, correct rendering of the section, not a degraded one.
 *
 * A film may also be marked `once`, in which case it plays through a single
 * time on arrival and then holds its last frame for the rest of the visit. See
 * the `once` input.
 */
@Component({
  selector: 'fk-cinematic-media',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <picture class="cm__poster">
      <source [srcset]="mediaUrl('/img/chapters/' + slug() + '.avif')" type="image/avif" />
      <source [srcset]="mediaUrl('/img/chapters/' + slug() + '.webp')" type="image/webp" />
      <img
        [src]="mediaUrl('/img/chapters/' + slug() + '.jpg')"
        [alt]="alt()"
        [attr.loading]="priority() ? 'eager' : 'lazy'"
        [attr.fetchpriority]="priority() ? 'high' : 'auto'"
        [attr.decoding]="priority() ? 'sync' : 'async'"
        [width]="mediaWidth()"
        [height]="mediaHeight()"
      />
    </picture>

    @if (mounted()) {
      <video
        #film
        class="cm__film"
        [class.is-visible]="playing()"
        [muted]="true"
        [attr.muted]="''"
        playsinline
        [loop]="!once()"
        [attr.preload]="priority() ? 'auto' : 'none'"
        disablepictureinpicture
        aria-hidden="true"
        tabindex="-1"
        (playing)="playing.set(true)"
        (canplay)="resume()"
        (loadeddata)="resume()"
        (stalled)="resume()"
        (ended)="onEnded()"
      >
        <source
          [src]="mediaUrl('/video/' + slug() + '.mobile.mp4')"
          media="(max-width: 640px)"
          type="video/mp4"
        />
        <source
          [src]="mediaUrl('/video/' + slug() + '.av1.mp4')"
          type="video/mp4; codecs=av01.0.05M.08"
        />
        <source [src]="mediaUrl('/video/' + slug() + '.mp4')" type="video/mp4" />
      </video>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      overflow: hidden;
      background-color: var(--c-forest-900);
      /* Reserving the ratio is what keeps CLS at zero: the box is the right
         size before either the poster or the film has arrived. */
      aspect-ratio: var(--cm-ratio, 16 / 9);
    }

    .cm__poster,
    .cm__film {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
    }

    .cm__poster img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
      object-position: var(--cm-focus, center);
    }

    .cm__film {
      object-fit: cover;
      object-position: var(--cm-focus, center);
      opacity: 0;
      transition: opacity var(--d-slow) var(--ease-out);
    }

    .cm__film.is-visible {
      opacity: 1;
    }

    @media (prefers-reduced-motion: reduce) {
      .cm__film {
        transition-duration: 1ms;
      }
    }
  `,
})
export class CinematicMedia implements ManagedPlayer {
  protected readonly mediaUrl = imageKitMediaUrl;
  /** Asset basename — resolves both `/video/<slug>.*` and `/img/chapters/<slug>.*`. */
  readonly slug = input.required<string>();
  /** Describes the poster for assistive technology. The film itself is decorative. */
  readonly alt = input.required<string>();
  /** Set on the hero only: makes the poster an eager, high-priority LCP candidate. */
  readonly priority = input(false);
  /**
   * The poster's real pixel dimensions. Films that are cropped by
   * scripts/prepare-videos.mjs to remove burned-in copy are no longer 1280×720,
   * and declaring the true intrinsic size keeps the browser's own aspect
   * calculation in agreement with the `--cm-ratio` the host reserves.
   */
  readonly mediaWidth = input(1280);
  readonly mediaHeight = input(720);
  /**
   * Plays the film through exactly once, then holds on its last frame.
   *
   * A looping film is wallpaper: it is always moving, so it never says
   * anything. A film that runs once is an event — it happens when you arrive,
   * it finishes, and the page settles. That only works if the film is composed
   * to end somewhere, which is why this is opt-in per chapter rather than a
   * global setting.
   *
   * Two things follow from it. The `loop` attribute is dropped, so the browser
   * stops at the final frame and leaves it on screen. And once the film has
   * ended it is never restarted: scrolling away and back must not replay it,
   * or a one-time event becomes a loop with extra steps. A fresh page load is
   * a fresh arrival, so it plays again then — which is the whole intent.
   */
  readonly once = input(false);

  private readonly director = inject(VideoDirectorService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly film = viewChild<ElementRef<HTMLVideoElement>>('film');

  /** True once the `<video>` element is allowed to exist in the DOM. */
  readonly mounted = signal(false);
  /** True once the film is actually rendering frames, which triggers the fade. */
  readonly playing = signal(false);
  /** Set when a `once` film reaches its end. It is never played again. */
  private readonly spent = signal(false);
  /** The director has asked for this film and has not asked it to stop. */
  private wanted = false;
  /** Bounded so a film that genuinely cannot play does not retry forever. */
  private attempts = 0;
  /** Deferred/hydrated instances initialize only after their own first render. */
  private observerStarted = false;

  /** Read by the director to decide who wins the single playback slot. */
  visibility = 0;

  constructor() {
    // The observer sets `mounted` and asks the director to reconsider in the
    // same breath, but at that instant the <video> is still a signal write that
    // has not been rendered — so the director's `play()` finds no element and
    // does nothing. Nothing would ever ask again on a page the visitor has not
    // scrolled, which left the hero film sitting on frame zero on arrival while
    // the director believed it was playing. The deferred start below is what
    // actually makes a film begin the first time it is asked for.
    afterRenderEffect(() => {
      if (!this.observerStarted) {
        this.observerStarted = true;
        this.observe();
      }
      if (!this.mounted()) {
        return;
      }
      // The hero starts itself.
      //
      // Everything else waits to be picked by the director, which grants one
      // playback slot so seven chapters never fight over the hardware decoder.
      // That arbitration is right for the chapters and wrong for the opening
      // film: it made the animation depend on a chain of a signal write, a
      // render, an observer callback and a selection that has to agree with
      // itself, and when any link lost the race the film sat on frame zero with
      // readyState 4 — fully loaded, never told to play. It played "sometimes",
      // which is the worst kind of works.
      //
      // A priority film is the page's opening and never competes with anything,
      // so it is simply started.
      if (this.priority() || this.wanted) {
        this.play();
      }
    });

    this.destroyRef.onDestroy(() => this.director.unregister(this));
  }

  private observe(): void {
    if (!this.director.videoPermitted()) {
      return;
    }
    this.director.register(this);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          this.visibility = entry.intersectionRatio;
          // Mount slightly before the section is properly on screen, so the
          // first frames are decoded by the time it matters.
          if (entry.intersectionRatio > 0 && !this.mounted()) {
            this.mounted.set(true);
          }
        }
        this.director.reconsider();
      },
      { threshold: [0, 0.15, 0.35, 0.6, 0.85], rootMargin: '15% 0px' },
    );

    observer.observe(this.host.nativeElement);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  /**
   * A finished one-shot film releases the decoder immediately. It is holding a
   * still frame from here on, so there is no reason for it to keep a slot the
   * chapters further down the page are waiting for.
   */
  /**
   * Called when the element reports it has data. If the film was asked for and
   * is not running, start it — this is the retry that makes the opening
   * animation reliable rather than a coin toss.
   */
  resume(): void {
    if ((!this.wanted && !this.priority()) || this.spent() || this.playing()) {
      return;
    }
    const element = this.film()?.nativeElement;
    if (element && element.paused) {
      void element.play().catch(() => undefined);
    }
  }

  onEnded(): void {
    if (!this.once()) {
      // Defensive fallback for browsers that occasionally fail to honour the
      // reflected loop attribute after a deferred/hydrated video is mounted.
      // The two homepage chapter films are ambient loops and must keep moving.
      const element = this.film()?.nativeElement;
      if (element) {
        element.currentTime = 0;
        void element.play().catch(() => undefined);
      }
      return;
    }
    this.spent.set(true);
    this.director.unregister(this);
  }

  play(): void {
    // Calling play() on an ended element seeks it back to zero, so without this
    // the director would replay the film every time it scrolled back into view.
    if (this.spent()) {
      return;
    }
    this.wanted = true;
    const element = this.film()?.nativeElement;
    if (!element) {
      // Asked for before the element exists. The render effect above retries.
      return;
    }
    // A rejected promise here is not necessarily final. On a cold cache the
    // element frequently has no data yet, play() rejects, and the film sits on
    // frame zero — which is why the opening animation used to start only about
    // half the time. The media events above call resume() as soon as the
    // element is ready, and this retries once more on the next frame; a genuine
    // refusal (autoplay blocked, decode failure) just leaves the poster up,
    // which is a complete rendering in its own right.
    void element.play().catch(() => {
      this.playing.set(false);
      if (this.attempts < 3 && this.wanted && !this.spent()) {
        this.attempts++;
        setTimeout(() => this.play(), 120);
      }
    });
  }

  pause(): void {
    this.wanted = false;
    const element = this.film()?.nativeElement;
    if (!element) {
      return;
    }
    element.pause();
  }
}
