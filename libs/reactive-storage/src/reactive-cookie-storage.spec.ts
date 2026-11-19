/**
 * @jest-environment jsdom
 */
import { firstValueFrom } from 'rxjs';
import { ReactiveCookieStorage } from './reactive-cookie-storage';

const cookieNames = () => document.cookie.split('; ').filter(Boolean).map((cookie) => cookie.slice(0, cookie.indexOf('=')));

describe('ReactiveCookieStorage', () => {
	const instances: ReactiveCookieStorage[] = [];
	const create = (appName = 'spec', linker?: unknown) => {
		const storage = new ReactiveCookieStorage(appName, { path: '/' }, linker);

		instances.push(storage);

		return storage;
	};

	afterEach(() => {
		instances.splice(0).forEach((storage) => storage.destroy());
		cookieNames().forEach((name) => (document.cookie = `${name}=; path=/; max-age=0`));
	});

	it('keeps simple names as they are, as earlier versions wrote them', async () => {
		await create('my-app').set('user_settings', 'theme', 'dark');

		expect(cookieNames()).toEqual(['my-app_user_settings']);
	});

	it.each(['user-settings', 'user.settings', 'user settings', 'a/b', 'semi;colon', '(paren)'])(
		'reads back a store named %j after a reload',
		async (storeName) => {
			await create().set(storeName, 'theme', 'dark');

			await expect(firstValueFrom(create().get(storeName, 'theme'))).resolves.toBe('dark');
		},
	);

	it('reads back stores of an app name with special characters', async () => {
		await create('my app.v2').set('prefs', 'theme', 'dark');

		expect(cookieNames()).toEqual(['my%20app.v2_prefs']);
		await expect(firstValueFrom(create('my app.v2').get('prefs', 'theme'))).resolves.toBe('dark');
	});

	it('notifies linked instances of each other’s writes', async () => {
		const linker = Symbol('spec');
		const writer = create('spec', linker);
		const reader = create('spec', linker);
		const theme = reader.get('prefs', 'theme');

		await firstValueFrom(theme);
		await writer.set('prefs', 'theme', 'dark');

		await expect(firstValueFrom(theme)).resolves.toBe('dark');
	});
});
