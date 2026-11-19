/**
 * @jest-environment jsdom
 */
import { firstValueFrom, filter, take, toArray } from 'rxjs';
import { ReactiveWebStorage } from './reactive-web-storage';

describe('ReactiveWebStorage', () => {
	beforeEach(() => localStorage.clear());

	it('reads what is already in storage, under its app namespace', async () => {
		localStorage.setItem('spec/user', JSON.stringify({ name: 'Ada' }));
		localStorage.setItem('other/user', JSON.stringify({ name: 'Grace' }));

		const storage = new ReactiveWebStorage(localStorage, 'spec');

		await expect(firstValueFrom(storage.get('user', 'name'))).resolves.toBe('Ada');
	});

	it('emits every change made through set()', async () => {
		const storage = new ReactiveWebStorage(localStorage, 'spec');
		const names = firstValueFrom(storage.get<string>('user', 'name').pipe(take(3), toArray()));

		await storage.set('user', 'name', 'Ada');
		await storage.set('user', 'name', 'Grace');

		await expect(names).resolves.toEqual([undefined, 'Ada', 'Grace']);
		expect(JSON.parse(localStorage.getItem('spec/user')!)).toEqual({ name: 'Grace' });
	});

	it('emits a removal made through delete()', async () => {
		const storage = new ReactiveWebStorage(localStorage, 'spec');

		await storage.set('user', '', { name: 'Ada' });

		const removed = firstValueFrom(storage.get('user').pipe(filter((user) => user === undefined)));

		await storage.delete('user');

		await expect(removed).resolves.toBeUndefined();
		expect(localStorage.getItem('spec/user')).toBeNull();
	});
});
