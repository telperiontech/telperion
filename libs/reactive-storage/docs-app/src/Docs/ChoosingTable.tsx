interface StorageRow {
	id: string;
	name: string;
	kept: string;
	size: string;
	server: string;
}

const ROWS: StorageRow[] = [
	{ id: 'reactive-web-local-storage', name: 'ReactiveWebLocalStorage', kept: 'Until removed', size: 'About 5 MB per site', server: 'No' },
	{ id: 'reactive-web-session-storage', name: 'ReactiveWebSessionStorage', kept: 'Until the tab is closed', size: 'About 5 MB per site', server: 'No' },
	{ id: 'reactive-cookie-storage', name: 'ReactiveCookieStorage', kept: 'Until it expires', size: '4000 bytes per store', server: 'Yes, with every request' },
	{ id: 'reactive-web-storage', name: 'ReactiveWebStorage', kept: 'Up to the Storage you pass', size: 'Up to the Storage you pass', server: 'No' },
];
const cell = 'px-4 py-2.5 align-top';

/** The storages side by side: lifetime, size and whether the server sees the data */
export function ChoosingTable({ docsPath }: { docsPath: (id: string) => string }) {
	return (
		<div className="mt-4 overflow-x-auto rounded-xl border border-neutral-40">
			<table className="w-full min-w-[36rem] text-left text-sm">
				<thead className="bg-neutral-10 text-xs font-semibold text-neutral-550">
					<tr>
						<th scope="col" className={cell}>Storage</th>
						<th scope="col" className={cell}>Kept</th>
						<th scope="col" className={cell}>Size</th>
						<th scope="col" className={cell}>Sent to the server</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-neutral-40 text-neutral-660">
					{ROWS.map((row) => (
						<tr key={row.id}>
							<th scope="row" className={`${cell} font-mono text-[13px] font-medium`}>
								<a href={docsPath(row.id)} className="text-neutral-900 hover:text-secondary-660">{row.name}</a>
							</th>
							<td className={cell}>{row.kept}</td>
							<td className={cell}>{row.size}</td>
							<td className={cell}>{row.server}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
