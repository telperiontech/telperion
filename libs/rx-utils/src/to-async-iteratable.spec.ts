import { NEVER, Observable, Subject, of, throwError } from 'rxjs';
import { makeAsyncIterator, toAsyncIteratable } from './to-async-iteratable';

describe('makeAsyncIterator', () => {
	it('yields every value, then done when the source completes', async () => {
		const iterator = makeAsyncIterator(of(1, 2));

		await expect(iterator.next()).resolves.toEqual({ value: 1, done: false });
		await expect(iterator.next()).resolves.toEqual({ value: 2, done: false });
		await expect(iterator.next()).resolves.toEqual({ value: undefined, done: true });
		await expect(iterator.next()).resolves.toEqual({ value: undefined, done: true });
	});

	it('subscribes on the first next() call, not before', () => {
		let subscribed = 0;
		const source = new Observable<number>(() => {
			subscribed++;
		});
		const iterator = makeAsyncIterator(source);

		expect(subscribed).toBe(0);

		void iterator.next();
		void iterator.next();

		expect(subscribed).toBe(1);
	});

	it('buffers values that arrive while nobody waits, and hands them out in order', async () => {
		const subject = new Subject<string>();
		const iterator = makeAsyncIterator(subject);
		const first = iterator.next();

		subject.next('a');
		subject.next('b');
		subject.next('c');

		await expect(first).resolves.toEqual({ value: 'a', done: false });
		await expect(iterator.next()).resolves.toEqual({ value: 'b', done: false });
		await expect(iterator.next()).resolves.toEqual({ value: 'c', done: false });
	});

	it('resolves a pending next() with done when the source completes', async () => {
		const subject = new Subject<number>();
		const iterator = makeAsyncIterator(subject);
		const pending = iterator.next();

		subject.complete();

		await expect(pending).resolves.toEqual({ value: undefined, done: true });
	});

	it('rejects pending and later next() calls with the source error', async () => {
		const subject = new Subject<number>();
		const iterator = makeAsyncIterator(subject);
		const pending = iterator.next();
		const error = new Error('boom');

		subject.error(error);

		await expect(pending).rejects.toBe(error);
		await expect(iterator.next()).rejects.toBe(error);
	});

	it('hands out buffered values before the error', async () => {
		const iterator = makeAsyncIterator(new Observable<number>((subscriber) => {
			subscriber.next(1);
			subscriber.error('late');
		}));

		await expect(iterator.next()).resolves.toEqual({ value: 1, done: false });
		await expect(iterator.next()).rejects.toBe('late');
	});

	it('return() unsubscribes and settles pending next() calls with done', async () => {
		let unsubscribed = false;
		const iterator = makeAsyncIterator(new Observable<number>(() => () => {
			unsubscribed = true;
		}));
		const pending = iterator.next();

		await expect(iterator.return()).resolves.toEqual({ value: undefined, done: true });
		await expect(pending).resolves.toEqual({ value: undefined, done: true });
		expect(unsubscribed).toBe(true);
	});

	it('throw() unsubscribes and rejects pending next() calls', async () => {
		let unsubscribed = false;
		const iterator = makeAsyncIterator(new Observable<number>(() => () => {
			unsubscribed = true;
		}));
		const pending = iterator.next();

		await expect(iterator.throw('stop')).rejects.toBe('stop');
		await expect(pending).rejects.toBe('stop');
		expect(unsubscribed).toBe(true);
	});

	describe('Symbol.asyncDispose', () => {
		const original = Object.getOwnPropertyDescriptor(Symbol, 'asyncDispose');
		const setAsyncDispose = (value: symbol | undefined) => Object.defineProperty(Symbol, 'asyncDispose', { value, configurable: true });

		afterEach(() => {
			if (original) Object.defineProperty(Symbol, 'asyncDispose', original);
			else delete (Symbol as { asyncDispose?: symbol }).asyncDispose;
		});

		it('unsubscribes where the runtime has it', async () => {
			const asyncDispose = Symbol('Symbol.asyncDispose');
			let unsubscribed = false;

			setAsyncDispose(asyncDispose);

			const iterator = makeAsyncIterator(new Observable<number>(() => () => {
				unsubscribed = true;
			}));

			void iterator.next();
			await (iterator as unknown as Record<symbol, () => Promise<void>>)[asyncDispose]();

			expect(unsubscribed).toBe(true);
		});

		it('is left out where the runtime lacks it', () => {
			setAsyncDispose(undefined);

			expect(Object.keys(makeAsyncIterator(NEVER))).not.toContain('undefined');
		});
	});

	it('is its own async iterable', () => {
		const iterator = makeAsyncIterator(NEVER);

		expect(iterator[Symbol.asyncIterator]()).toBe(iterator);
	});
});

describe('toAsyncIteratable', () => {
	it('ends a for await loop when the source completes', async () => {
		const received: number[] = [];

		for await (const value of toAsyncIteratable(of(1, 2, 3))) received.push(value);

		expect(received).toEqual([1, 2, 3]);
	});

	it('throws the source error out of a for await loop', async () => {
		const loop = async () => {
			for await (const _ of toAsyncIteratable(throwError(() => 'fail'))) {
				// never reached
			}
		};

		await expect(loop()).rejects.toBe('fail');
	});

	it('unsubscribes when a for await loop breaks', async () => {
		let unsubscribed = false;
		const source = new Observable<number>((subscriber) => {
			subscriber.next(1);

			return () => {
				unsubscribed = true;
			};
		});

		for await (const _ of toAsyncIteratable(source)) break;

		expect(unsubscribed).toBe(true);
	});
});
