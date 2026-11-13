import { trackEvent } from '../analytics';

const HOST_CLASSES = [
	'grid', 'place-items-center', 'size-7', 'rounded-md', 'text-neutral-850',
	'hover:text-neutral-990', 'hover:bg-neutral-50', 'transition-colors',
];

const RESET_DELAY = 1500;

/**
 * `<osw-copy-button text="…">`: copies `text` to the clipboard and briefly shows a check mark.
 *
 * Light DOM so Tailwind utilities on the host (positioning, background) apply as usual.
 * Uses `<tp-icon>`, which the shell registers. Host classes are added on connect, so
 * frameworks should keep their own `class` value static (same caveat as `<tp-icon>`).
 */
export class OswCopyButton extends HTMLElement {
	static readonly tagName = 'osw-copy-button';
	static readonly observedAttributes = ['text'];

	#button?: HTMLButtonElement;
	#copyIcon?: HTMLElement;
	#doneIcon?: HTMLElement;
	#copied = false;
	#timer?: ReturnType<typeof setTimeout>;

	get text(): string {
		return this.getAttribute('text') ?? '';
	}

	set text(value: string) {
		this.setAttribute('text', value);
	}

	connectedCallback(): void {
		this.classList.add(...HOST_CLASSES);
		if (!this.#button) this.#render();
		this.#sync();
	}

	disconnectedCallback(): void {
		clearTimeout(this.#timer);
		this.#copied = false;
	}

	attributeChangedCallback(): void {
		this.#sync();
	}

	#render(): void {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'grid size-full place-items-center rounded-[inherit] cursor-pointer';
		button.addEventListener('click', () => this.#copy());

		this.#copyIcon = this.#icon('content_copy');
		this.#doneIcon = this.#icon('check', 'text-success-600');
		button.append(this.#copyIcon, this.#doneIcon);

		this.#button = button;
		this.replaceChildren(button);
	}

	#icon(glyph: string, className = ''): HTMLElement {
		const icon = document.createElement('tp-icon');
		icon.setAttribute('aria-hidden', 'true');
		icon.style.fontSize = '16px';
		if (className) icon.setAttribute('class', className);
		icon.textContent = glyph;
		return icon;
	}

	async #copy(): Promise<void> {
		try {
			await navigator.clipboard.writeText(this.text);
		} catch {
			// Clipboard can be unavailable (insecure context, denied permission); fail quietly.
			return;
		}

		// Mostly install commands: the clearest sign a visitor is about to use a library
		trackEvent('copy_snippet', { snippet: this.text.slice(0, 100) });

		this.#copied = true;
		this.#sync();
		clearTimeout(this.#timer);
		this.#timer = setTimeout(() => {
			this.#copied = false;
			this.#sync();
		}, RESET_DELAY);
	}

	#sync(): void {
		if (!this.#button || !this.#copyIcon || !this.#doneIcon) return;

		this.#button.setAttribute('aria-label', this.#copied ? 'Copied' : `Copy "${this.text}"`);
		this.#button.title = this.#copied ? 'Copied' : 'Copy';
		this.#copyIcon.hidden = this.#copied;
		this.#doneIcon.hidden = !this.#copied;
	}
}
