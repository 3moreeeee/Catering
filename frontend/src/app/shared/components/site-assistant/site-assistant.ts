import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { LocaleService } from '../../../core/i18n/locale.service';

interface AssistantProduct {
  readonly name: string;
  readonly category: string;
  readonly href: string;
  readonly image: string | null;
}

interface AssistantResponse {
  readonly answer: string;
  readonly source: 'openai' | 'catalogue';
  readonly products: readonly AssistantProduct[];
}

interface ChatMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly products?: readonly AssistantProduct[];
}

@Component({
  selector: 'fk-site-assistant',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoDirective],
  templateUrl: './site-assistant.html',
})
export class SiteAssistant {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly locales = inject(LocaleService);
  private readonly transloco = inject(TranslocoService);

  private readonly launcher = viewChild<ElementRef<HTMLButtonElement>>('launcher');
  private readonly inputElement = viewChild<ElementRef<HTMLTextAreaElement>>('inputElement');
  private readonly messageList = viewChild<ElementRef<HTMLElement>>('messageList');

  readonly open = signal(false);
  readonly loading = signal(false);
  readonly messages = signal<readonly ChatMessage[]>([]);
  readonly input = signal('');
  readonly locale = this.locales.locale;

  toggle(): void {
    if (this.open()) {
      this.close();
      return;
    }
    this.open.set(true);
    setTimeout(() => this.inputElement()?.nativeElement.focus(), 0);
  }

  close(): void {
    if (!this.open()) return;
    this.open.set(false);
    setTimeout(() => this.launcher()?.nativeElement.focus({ preventScroll: true }), 0);
  }

  updateInput(event: Event): void {
    this.input.set((event.target as HTMLTextAreaElement).value);
  }

  submit(event: SubmitEvent): void {
    event.preventDefault();
    void this.send();
  }

  useSuggestion(text: string): void {
    this.input.set(text);
    void this.send();
  }

  onInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.send();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  private async send(): Promise<void> {
    const question = this.input().trim();
    if (question.length < 2 || this.loading()) return;

    const previous = this.messages();
    this.messages.set([...previous, { role: 'user', content: question }]);
    this.input.set('');
    this.loading.set(true);
    this.scrollToLatest();

    try {
      const response = await firstValueFrom(
        this.http.post<AssistantResponse>('/api/assistant', {
          message: question,
          locale: this.locale(),
          pagePath: this.router.url.split('?')[0],
          history: previous.slice(-6).map(({ role, content }) => ({ role, content })),
        }),
      );
      this.messages.update((items) => [
        ...items,
        { role: 'assistant', content: response.answer, products: response.products },
      ]);
    } catch (error) {
      const key =
        error instanceof HttpErrorResponse && error.status === 429
          ? 'assistant.rateLimited'
          : 'assistant.error';
      this.messages.update((items) => [
        ...items,
        { role: 'assistant', content: this.transloco.translate(key) },
      ]);
    } finally {
      this.loading.set(false);
      this.scrollToLatest();
      setTimeout(() => this.inputElement()?.nativeElement.focus(), 0);
    }
  }

  private scrollToLatest(): void {
    setTimeout(() => {
      const element = this.messageList()?.nativeElement;
      element?.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
    }, 0);
  }
}
