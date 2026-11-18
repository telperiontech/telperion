import { firstValueFrom, Observable, timer, type SchedulerLike } from 'rxjs';
import { toAsyncIteratable } from '@telperion/rx-utils/to-async-iteratable';
import { defineScenario } from '../define';

/** A `for await` loop over the source whose body takes `work` frames; emits what each iteration receives */
function forAwait(source: Observable<unknown>, work: number, scheduler: SchedulerLike): Observable<unknown> {
	return new Observable((subscriber) => {
		let active = true;

		(async () => {
			for await (const value of toAsyncIteratable(source)) {
				if (!active) break;

				subscriber.next(value);
				await firstValueFrom(timer(work, scheduler));
			}

			subscriber.complete();
		})().catch((error: unknown) => subscriber.error(error));

		return () => {
			active = false;
		};
	});
}

export const slowConsumer = defineScenario({
	id: 'slow-consumer',
	title: 'A slow loop over a fast source',
	description:
		'The source pushes whenever it likes; the loop pulls one value per iteration. Values that arrive while the body is busy are buffered and handed out in order.',
	engine: 'stepped',
	inputs: { source: { marbles: '-a-b-c-d---|' } },
	subscribers: [{ label: 'for await', marbles: '^' }],
	args: {
		work: { default: 4, control: { type: 'range', min: 0, max: 8 }, description: 'Frames each loop iteration takes' },
	},
	operator: ({ work }) => `for await (…) { /* ${work} frames */ }`,
	code: ({ work }) => `import { toAsyncIteratable } from '@telperion/rx-utils';

for await (const value of toAsyncIteratable(source$)) {
  await process(value); // ${work} frames
}`,
	run: ({ source }, { work }, scheduler) => forAwait(source, work, scheduler),
	expected: [{ marbles: '-a---b---c---d' }],
	duration: 24,
});

export default [slowConsumer];
