/**
 * @jest-environment jsdom
 */
import { firstValueFrom } from 'rxjs';
import { ReactiveWebStorage } from './reactive-web-storage';

/** The shared write methods of ReactiveStorage, run on localStorage */
describe('ReactiveStorage', () => {
	let storage: ReactiveWebStorage;

	beforeEach(() => {
		localStorage.clear();
		storage = new ReactiveWebStorage(localStorage, 'spec');
	});

	const read = (key = '') => firstValueFrom(storage.get('store', key));

	describe('patch', () => {
		it('merges properties into the stored object', async () => {
			await storage.set('store', '', { name: 'Ada', age: 36 });
			await storage.patch('store', '', { age: 37, email: 'ada@example.com' });

			await expect(read()).resolves.toEqual({ name: 'Ada', age: 37, email: 'ada@example.com' });
		});

		it('merges at a nested path', async () => {
			await storage.set('store', 'profile', { theme: 'light', lang: 'en' });
			await storage.patch('store', 'profile', { theme: 'dark' });

			await expect(read('profile')).resolves.toEqual({ theme: 'dark', lang: 'en' });
		});

		it('skips null and undefined properties instead of erasing stored ones', async () => {
			await storage.set('store', '', { name: 'Ada', age: 36 });
			await storage.patch('store', '', { name: null, age: undefined, email: 'ada@example.com' } as Record<string, unknown>);

			await expect(read()).resolves.toEqual({ name: 'Ada', age: 36, email: 'ada@example.com' });
		});

		it('starts a new object when there is none, or when the value is not an object', async () => {
			await storage.patch('store', 'a', { x: 1 });
			await storage.set('store', 'b', [1, 2]);
			await storage.patch('store', 'b', { y: 2 });

			await expect(read()).resolves.toEqual({ a: { x: 1 }, b: { y: 2 } });
		});
	});

	describe('drop', () => {
		it('removes an object item by content, whatever the key order', async () => {
			await storage.set('store', 'items', [{ id: 1, text: 'Buy milk' }, { id: 2, text: 'Walk the dog' }]);
			await storage.drop('store', 'items', { text: 'Buy milk', id: 1 });

			await expect(read('items')).resolves.toEqual([{ id: 2, text: 'Walk the dog' }]);
		});

		it('removes only the first match', async () => {
			await storage.set('store', 'tags', ['a', 'b', 'a']);
			await storage.drop('store', 'tags', 'a');

			await expect(read('tags')).resolves.toEqual(['b', 'a']);
		});

		it('matches the item as it would be stored, ignoring undefined properties', async () => {
			await storage.set('store', 'items', [{ id: 1 }]);
			await storage.drop('store', 'items', { id: 1, note: undefined });

			await expect(read('items')).resolves.toEqual([]);
		});

		it('does nothing when no item matches or there is no array', async () => {
			await storage.set('store', 'items', [{ id: 1 }]);
			await storage.drop('store', 'items', { id: 2 });
			await storage.drop('store', 'missing', 'x');

			await expect(read()).resolves.toEqual({ items: [{ id: 1 }] });
		});
	});
});
