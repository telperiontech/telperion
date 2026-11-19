import { CodeBlock, CodeLine } from '@osw/docs';
import { EntryList, useApiDocs } from '@osw/api';
import { ChoosingTable } from './ChoosingTable';

const quickStart = (packageName: string) => `import { ReactiveWebLocalStorage } from "${packageName}/reactive-web-local-storage";

const storage = new ReactiveWebLocalStorage<"user" | "settings">("my-app");

storage.get<string>("settings", "theme").subscribe((theme) => {
  document.documentElement.dataset.theme = theme ?? "light";
});

await storage.set("settings", "theme", "dark"); // the subscriber runs again with "dark"`;
const paths = `await storage.set("user", "", { name: "Ada" });          // the whole store
await storage.set("user", "profile.theme", "dark");     // creates "profile" on the way
await storage.push("user", "tags", "admin");            // appends, creating the array
await storage.patch("user", "", { age: 36 });           // merges into the object

storage.get("user");                 // { name: "Ada", profile: { theme: "dark" }, tags: ["admin"], age: 36 }
storage.get("user", "profile.theme"); // "dark"

await storage.drop("user", "tags", "admin");            // removes the first equal item
await storage.delete("user", "profile");                // removes the property`;
const notes = [
	['Current value first', 'get() emits the current value as soon as you subscribe, then every change. Missing stores and paths are undefined.'],
	['Frozen values', 'Emitted values are deep-frozen. Copy before you change them; write the new value back with set().'],
	['Ordered writes', 'Writes run one at a time, in call order, and resolve once subscribers have the new value. A write that takes over a second is rejected.'],
	['Same-instance changes', 'A storage observes the writes made through itself. Cookie storages created with the same linker also observe each other; nothing else is picked up, including other tabs.'],
] as const;

export function OverviewPage() {
	const { model, docsPath, entriesOf } = useApiDocs();

	return (
		<div className="max-w-4xl">
			<header>
				<p className="font-mono text-sm font-semibold text-secondary-700">{model.packageName}</p>
				<h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Reactive storage</h1>
				<p className="mt-4 max-w-2xl text-base leading-relaxed text-neutral-920">
					localStorage, sessionStorage and cookies as RxJS Observables. Subscribe to a value, or to a path inside it, and
					get the current value and every later change; write with promises that resolve once subscribers are up to date.
					This reference is generated from the library's source on every release.
				</p>
				<CodeLine code={`pnpm add ${model.packageName}`} language="sh" prompt="$" className="mt-6 max-w-md bg-neutral-30" />
			</header>

			<section aria-labelledby="quick-start" className="mt-12">
				<h2 id="quick-start" className="text-lg font-semibold tracking-tight">Quick start</h2>
				<p className="mt-1 text-sm text-neutral-920">
					Pick a storage, give it your app's name, and use it like a small reactive key-value store.
				</p>
				<CodeBlock code={quickStart(model.packageName)} copyable={false} className="mt-4" />
			</section>

			<section aria-labelledby="stores-and-paths" className="mt-12">
				<h2 id="stores-and-paths" className="text-lg font-semibold tracking-tight">Stores and key paths</h2>
				<p className="mt-1 text-sm text-neutral-920">
					Data lives in named stores, one JSON value each. A dot-separated key path reaches inside a store; an empty
					path means the whole store.
				</p>
				<CodeBlock code={paths} copyable={false} className="mt-4" />
			</section>

			<section aria-labelledby="choosing" className="mt-12">
				<h2 id="choosing" className="text-lg font-semibold tracking-tight">Choosing a storage</h2>
				<p className="mt-1 text-sm text-neutral-920">All of them share the same API; they differ in where the data is kept.</p>
				<ChoosingTable docsPath={docsPath} />
			</section>

			<section aria-labelledby="good-to-know" className="mt-12">
				<h2 id="good-to-know" className="text-lg font-semibold tracking-tight">Good to know</h2>
				<dl className="mt-4 grid gap-4 sm:grid-cols-2">
					{notes.map(([title, text]) => (
						<div key={title} className="rounded-xl border border-neutral-100 p-4">
							<dt className="text-sm font-semibold">{title}</dt>
							<dd className="mt-1 text-sm text-neutral-920">{text}</dd>
						</div>
					))}
				</dl>
			</section>

			{model.categories.map((category) => (
				<section key={category.id} aria-labelledby={`category-${category.id}`} className="mt-12">
					<h2 id={`category-${category.id}`} className="text-lg font-semibold tracking-tight">
						<a href={docsPath(category.id)} className="hover:text-secondary-800">{category.title}</a>
					</h2>
					{category.description && <p className="mt-1 text-sm text-neutral-920">{category.description}</p>}
					<div className="mt-4">
						<EntryList entries={entriesOf(category)} />
					</div>
				</section>
			))}
		</div>
	);
}
