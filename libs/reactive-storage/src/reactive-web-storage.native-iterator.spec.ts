/**
 * @jest-environment jsdom
 */
import '@telperion/rx-utils/static/async-iterator';
import { firstValueFrom, take, toArray } from 'rxjs';
import { ReactiveWebStorage } from './reactive-web-storage';

/** With `Observable.prototype[Symbol.asyncIterator]` present, as in rxjs 8, the storage uses it */
describe('ReactiveWebStorage with a native Observable async iterator', () => {
	beforeEach(() => localStorage.clear());

	it('emits every change made through set()', async () => {
		const storage = new ReactiveWebStorage(localStorage, 'spec');
		const names = firstValueFrom(storage.get<string>('user', 'name').pipe(take(3), toArray()));

		await storage.set('user', 'name', 'Ada');
		await storage.set('user', 'name', 'Grace');

		await expect(names).resolves.toEqual([undefined, 'Ada', 'Grace']);
	});
});
