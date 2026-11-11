import { renderStory } from '@osw/stories/core';
import '@telperion/elements';
import '@telperion/elements/drag-drop';
import '@telperion/elements/icon';
import '@telperion/elements/icon/material-symbols.css';
import { isRenderMessage, type PreviewMessage, type RenderMessage } from '../protocol/messages';
import { listenToEvents, preventFormNavigation } from './events';
import './preview.css';
import { registry } from './registry';

/**
 * Runs inside `preview.html`: renders the story the parent asks for, reports the content
 * height so the parent can size the iframe, and forwards the events it was asked to log.
 */

const root = document.getElementById('root') as HTMLElement;
const container = document.getElementById('story') as HTMLElement;
let stopListening = () => {};

const post = (message: PreviewMessage) => window.parent.postMessage(message, '*');

function render({ componentId, storyId, args, events }: RenderMessage): void {
	const component = registry.getComponent(componentId);
	const story = component && registry.getStory(component, storyId);

	if (!story) {
		post({ type: 'osw-preview:error', message: `Unknown story ${componentId}/${storyId}` });

		return;
	}

	document.body.dataset['layout'] = story.parameters.layout ?? 'padded';
	stopListening();
	stopListening = listenToEvents(events, post);

	try {
		renderStory(story, { ...story.args, ...args }, container);
	} catch (error) {
		post({ type: 'osw-preview:error', message: error instanceof Error ? error.message : String(error) });
	}
}

/** Content height: the story itself plus the root's padding (the root may stretch to the viewport) */
function contentHeight(): number {
	const style = getComputedStyle(root);

	return Math.ceil(container.getBoundingClientRect().height + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom));
}

let lastHeight = 0;
const reportSize = () => {
	const height = contentHeight();

	if (height !== lastHeight) post({ type: 'osw-preview:size', height: (lastHeight = height) });
};

new ResizeObserver(() => requestAnimationFrame(reportSize)).observe(container);

window.addEventListener('message', (event) => {
	if (event.source === window.parent && isRenderMessage(event.data)) render(event.data);
});

preventFormNavigation();
post({ type: 'osw-preview:ready' });
