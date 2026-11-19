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

	it.each(['user-settings', 'user.settings', 'user settings', 'a/b', 'ünïcode'])('reads back a store named %j after a reload', async (storeName) => {
		await new ReactiveWebStorage(localStorage, 'spec').set(storeName, 'theme', 'dark');

		const reloaded = new ReactiveWebStorage(localStorage, 'spec');

		await expect(firstValueFrom(reloaded.get(storeName, 'theme'))).resolves.toBe('dark');
	});

	it('works with a custom Storage implementation', async () => {
		/** Keeps its entries private, so only the Storage interface reveals them */
		class MemoryStorage implements Storage {
			readonly #entries = new Map<string, string>();
			get length() { return this.#entries.size; }
			key(index: number) { return [...this.#entries.keys()][index] ?? null; }
			getItem(key: string) { return this.#entries.get(key) ?? null; }
			setItem(key: string, value: string) { this.#entries.set(key, value); }
			removeItem(key: string) { this.#entries.delete(key); }
			clear() { this.#entries.clear(); }
		}

		const memory = new MemoryStorage();

		await new ReactiveWebStorage(memory, 'spec').set('user', 'name', 'Ada');

		await expect(firstValueFrom(new ReactiveWebStorage(memory, 'spec').get('user', 'name'))).resolves.toBe('Ada');
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
