import { saveConsent, storedConsent, type ConsentChoice } from './consent';

/** Elements with this attribute (e.g. the footer's "Cookie settings") reopen the banner */
const OPEN_ATTRIBUTE = 'data-osw-consent-open';

const HOST_CLASSES = [
	'fixed', 'inset-x-0', 'bottom-0', 'z-40', 'p-4', 'sm:p-6', 'pointer-events-none',
];

const BUTTON_CLASSES = 'rounded-lg px-4 py-2 text-sm font-semibold transition-colors cursor-pointer';

/**
 * `<osw-consent-banner>`: asks once whether Google Analytics may set cookies and stores
 * the answer. Shown while there is no saved choice, or when an `[data-osw-consent-open]`
 * element is clicked. Light DOM so the shell's Tailwind utilities apply.
 */
export class OswConsentBanner extends HTMLElement {
	static readonly tagName = 'osw-consent-banner';

	#onDocumentClick = (event: MouseEvent) => {
		const trigger = (event.target as Element | null)?.closest?.(`[${OPEN_ATTRIBUTE}]`);

		if (trigger) this.open({ focus: true });
	};

	connectedCallback(): void {
		this.classList.add(...HOST_CLASSES);
		document.addEventListener('click', this.#onDocumentClick);
		// Settings links stay hidden on builds without analytics, where this element is never defined
		document.querySelectorAll<HTMLElement>(`[${OPEN_ATTRIBUTE}]`).forEach((trigger) => (trigger.hidden = false));

		if (storedConsent()) this.close();
		else this.open();
	}

	disconnectedCallback(): void {
		document.removeEventListener('click', this.#onDocumentClick);
	}

	/** `focus` moves focus into the banner; only when the visitor asked for it, never on page load */
	open({ focus = false } = {}): void {
		this.#render();
		this.hidden = false;
		if (focus) this.querySelector<HTMLButtonElement>('[data-choice="granted"]')?.focus({ preventScroll: true });
	}

	close(): void {
		this.hidden = true;
		this.replaceChildren();
	}

	#choose(choice: ConsentChoice): void {
		saveConsent(choice);
		this.close();
	}

	#render(): void {
		const panel = document.createElement('section');
		panel.setAttribute('aria-label', 'Analytics consent');
		panel.className =
			'pointer-events-auto mx-auto flex max-w-3xl flex-col gap-4 rounded-xl border border-neutral-100 bg-white p-4 text-sm text-neutral-920 shadow-lg sm:flex-row sm:items-center sm:p-5';

		const text = document.createElement('p');
		text.className = 'flex-1 leading-relaxed';
		text.textContent =
			'We use Google Analytics cookies to learn which docs are useful. If you decline, no analytics cookies are set. You can change this any time from the footer.';

		const actions = document.createElement('div');
		actions.className = 'flex shrink-0 gap-2';
		actions.append(
			this.#button('denied', 'Decline', `${BUTTON_CLASSES} text-neutral-990 hover:bg-neutral-50 border border-neutral-100`),
			this.#button('granted', 'Accept', `${BUTTON_CLASSES} bg-primary-600 text-white hover:bg-primary-700`),
		);

		panel.append(text, actions);
		this.replaceChildren(panel);
	}

	#button(choice: ConsentChoice, label: string, className: string): HTMLButtonElement {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = className;
		button.dataset['choice'] = choice;
		button.textContent = label;
		button.addEventListener('click', () => this.#choose(choice));
		return button;
	}
}

export function defineConsentBanner(): void {
	if (!customElements.get(OswConsentBanner.tagName)) customElements.define(OswConsentBanner.tagName, OswConsentBanner);
}
