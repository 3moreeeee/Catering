import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { inject } from '@angular/core';
import { COMPANY } from '../../../data/company.data';

/**
 * Shared location card for the homepage and contact page.
 *
 * The company has published a postal address but no coordinates, so both the
 * embed and the external link use the address as a Google Maps search query.
 * This avoids publishing a guessed pin while still giving visitors a usable,
 * interactive map.
 *
 * **The Google embed is not loaded until it is asked for.** It used to sit in
 * the markup from the first render, which handed a third party a request — and
 * a set of cookies — on behalf of a visitor who had not asked for a map, cost
 * several hundred kilobytes of someone else's JavaScript, and made the page's
 * completeness depend on a network the visitor might be blocking. A blocked or
 * throttled maps.google.com would leave a dead grey rectangle where the
 * company's address should be.
 *
 * So the card renders its own designed panel: the address, the locality, and a
 * button. Press the button and the iframe is created. Whatever happens, the
 * postal address and the "open in Google Maps" link are real, selectable,
 * copyable HTML that never depended on the embed at all.
 */
@Component({
  selector: 'fk-google-map-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <div class="map-card__frame" [class.is-live]="live()">
        @if (live()) {
          <iframe
            [src]="embedUrl"
            width="720"
            height="540"
            style="border: 0"
            [title]="t('contact.mapTitle') + ' — ' + address"
            loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"
            allowfullscreen
          ></iframe>
        } @else {
          <!-- The designed stand-in. Drawn with the brand's own tokens, so it
               is a piece of the page rather than a placeholder for one. -->
          <div class="map-card__still">
            <span class="map-card__marker" aria-hidden="true"></span>
            <button type="button" class="btn btn--secondary btn--sm map-card__load" (click)="load()">
              {{ t('contact.loadMap') }}
            </button>
            <p class="map-card__consent">{{ t('contact.mapConsent') }}</p>
          </div>
        }

        <div class="map-card__badge" aria-hidden="true">
          <span class="map-card__pulse"><span></span></span>
          <span>
            <strong>{{ t('contact.mapTitle') }}</strong>
            <small>{{ company.address.street }}, {{ company.address.locality }}</small>
          </span>
        </div>
      </div>

      <div class="map-card__foot">
        <span class="map-card__address">
          <span class="map-card__pin" aria-hidden="true"></span>
          {{ address }}
        </span>
        <a
          class="btn btn--secondary btn--sm"
          [href]="mapsUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ t('contact.viewOnMap') }}
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </ng-container>
  `,
  styleUrl: './google-map-card.scss',
})
export class GoogleMapCard {
  private readonly sanitizer = inject(DomSanitizer);

  readonly company = COMPANY;
  readonly address = `${COMPANY.address.street}, ${COMPANY.address.postalCode} ${COMPANY.address.locality}, ${COMPANY.address.country}`;
  readonly mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(this.address)}`;

  /** False until the visitor asks for the embed. Never true during SSR. */
  readonly live = signal(false);

  /**
   * Built from the same address string as the external link, so the two can
   * never point at different places. Marked trusted because it is assembled
   * here from a constant and an encoded literal — no user input reaches it.
   */
  readonly embedUrl: SafeResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
    `https://www.google.com/maps?q=${encodeURIComponent(this.address)}&output=embed&z=15`,
  );

  load(): void {
    this.live.set(true);
  }
}
