import type { ReactNode } from 'react';

interface DataTableProps {
	header: ReactNode[];
	rows: ReactNode[][];
	className?: string;
}

/** Bordered, horizontally scrollable table used by markdown tables and API references */
export function DataTable({ header, rows, className = 'mt-3' }: DataTableProps) {
	return (
		<div className={`overflow-x-auto rounded-lg border border-neutral-40 ${className}`}>
			<table className="w-full text-left text-[13px]">
				<thead className="bg-neutral-10 text-xs text-neutral-550">
					<tr>{header.map((cell, index) => <th key={index} className="px-3 py-2 font-semibold">{cell}</th>)}</tr>
				</thead>
				<tbody className="divide-y divide-neutral-40">
					{rows.map((row, rowIndex) => (
						<tr key={rowIndex}>
							{row.map((cell, index) => <td key={index} className="px-3 py-2 align-top text-neutral-660">{cell}</td>)}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
