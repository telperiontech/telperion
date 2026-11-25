import type { AnyMarbleScenario } from '../types';
import fromCallback from './from-callback';
import debounceTimeBuffer from './operators/debounce-time-buffer';
import mapTo from './operators/map-to';
import pluck from './operators/pluck';
import shareLast from './operators/share-last';
import toAsyncIteratable from './to-async-iteratable';

/** Marble scenarios by module id (the docs entry id), e.g. `operators/pluck` */
export const scenarios: Record<string, AnyMarbleScenario[]> = {
	'from-callback': fromCallback,
	'operators/debounce-time-buffer': debounceTimeBuffer,
	'operators/map-to': mapTo,
	'operators/pluck': pluck,
	'operators/share-last': shareLast,
	'to-async-iteratable': toAsyncIteratable,
};
