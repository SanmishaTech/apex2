'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export type SortOrder = 'asc' | 'desc';
export type SortState = {
	field: string;
	order: SortOrder;
};

export type Column<T> = {
	key: string; // unique column key maps to field for sorting
	header: string | React.ReactNode;
	accessor?: (row: T) => React.ReactNode; // if omitted, will attempt (row as any)[key]
	sortable?: boolean;
	className?: string; // header cell classes
	cellClassName?: string; // body cell classes
	hideHeaderLabel?: boolean; // still renders clickable area for icon
};

export type DataTableProps<T extends object> = {
	columns: Column<T>[];
	data: T[];
	loading?: boolean;
	emptyMessage?: string;
	sort?: SortState;
	onSortChange?: (next: SortState) => void;
	getRowKey?: (row: T, index: number) => string | number;
	getRowClassName?: (row: T, index: number) => string;
	renderRowActions?: (row: T) => React.ReactNode;
	actionsHeader?: React.ReactNode;
	className?: string;
	tableClassName?: string;
	scrollContainerClassName?: string; // customize the scroll wrapper div for responsive tweaks
	dense?: boolean;
	stickyHeader?: boolean;
	noStriping?: boolean;
	skeletonRows?: number;
	/** Number of leading data columns to make sticky on horizontal scroll */
	stickyColumns?: number; // e.g. 2 => first two columns sticky
	/** Minimum table width (px) before horizontal scroll. Defaults to 900 */
	minTableWidth?: number; // Set default minTableWidth=900
	/** Apply a simpler tailwind style (overflow-x-auto wrapper + divide lines) similar to provided snippet */
	simpleStyle?: boolean;
};

export function DataTable<T extends object>({
	columns,
	data,
	loading,
	emptyMessage = 'No records found',
	sort,
	onSortChange,
	getRowKey,
	getRowClassName,
	renderRowActions,
	actionsHeader = 'Actions',
	className,
	tableClassName,
	scrollContainerClassName,
	dense,
	stickyHeader,
	noStriping,
	skeletonRows = 8,
	stickyColumns,
	minTableWidth, // no default so it can shrink to container width unless explicitly set
	simpleStyle,
}: DataTableProps<T>) {
	const rowKey = (row: T, i: number) => {
		if (getRowKey) return getRowKey(row, i);
		if (Object.prototype.hasOwnProperty.call(row, 'id')) {
			const val = (row as Record<string, unknown>)['id'];
			if (typeof val === 'string' || typeof val === 'number') return val;
		}
		return i;
	};

	function toggleSort(col: Column<T>) {
		if (!onSortChange || !col.sortable) return;
		if (!sort || sort.field !== col.key) {
			onSortChange({ field: col.key, order: 'asc' });
		} else {
			onSortChange({
				field: col.key,
				order: sort.order === 'asc' ? 'desc' : 'asc',
			});
		}
	}

	// Determine if actions column should render (any row returns a non-empty action)
	const hasAnyActions = React.useMemo(() => {
		if (!renderRowActions) return false;
		// While loading we keep the column (skeleton) if actions are expected at all
		if (loading) return true;
		try {
			for (const row of data) {
				const node = renderRowActions(row);
				if (node === null || node === undefined || node === false) continue;
				// Also treat empty string as empty
				if (typeof node === 'string' && node.trim() === '') continue;
				// If it's an array/fragment with no children, skip
				if (React.isValidElement(node)) return true;
				// Fallback: anything truthy counts
				return true;
			}
			return false;
		} catch {
			return true; // fail open to avoid accidental layout shift due to an error
		}
	}, [renderRowActions, data, loading]);

	// Sticky columns offsets calculation
	const thRefs = React.useRef<(HTMLTableCellElement | null)[]>([]);
	const [leftOffsets, setLeftOffsets] = React.useState<number[]>([]);

	const recomputeOffsets = React.useCallback(() => {
		if (!stickyColumns || stickyColumns < 1) return;
		const next: number[] = [];
		let acc = 0;
		for (let i = 0; i < Math.min(stickyColumns, columns.length); i++) {
			const w = thRefs.current[i]?.getBoundingClientRect().width ?? 0;
			next[i] = acc;
			acc += w;
		}
		setLeftOffsets(next);
	}, [stickyColumns, columns]);

	React.useLayoutEffect(() => {
		recomputeOffsets();
	}, [recomputeOffsets, data, loading, simpleStyle, dense]);

	React.useEffect(() => {
		if (!stickyColumns || stickyColumns < 1) return;
		function onResize() {
			recomputeOffsets();
		}
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, [stickyColumns, recomputeOffsets]);

	const isSticky = (idx: number) => !!stickyColumns && idx < stickyColumns;

	return (
		<div
			className={cn(
				simpleStyle
					? 'relative'
					: 'relative rounded-lg border bg-background shadow-sm',
				className
			)}
		>
			{/* Horizontal scroll only if content wider than container */}
			<div
				className={cn(
					'block w-full max-w-full overflow-x-auto',
					scrollContainerClassName
				)}
				style={{
					WebkitOverflowScrolling: 'touch',
					msOverflowStyle: '-ms-autohiding-scrollbar',
				}}
			>
				<table
					className={cn(
						simpleStyle
							? 'min-w-full divide-y divide-border'
							: 'w-full border-separate border-spacing-0',
						tableClassName
					)}
					style={minTableWidth ? { minWidth: `${minTableWidth}px` } : undefined}
					aria-busy={loading ? 'true' : 'false'}
				>
						<thead
							className={cn(
								simpleStyle
									? 'bg-muted/30'
									: 'bg-muted/40 backdrop-blur supports-[backdrop-filter]:bg-muted/30',
								stickyHeader && 'sticky top-0 z-10'
							)}
						>
							<tr className='text-left'>
							{columns.map((col, idx) => {
								const active = sort?.field === col.key;
								return (
									<th
										key={col.key}
										ref={(el) => {
											thRefs.current[idx] = el;
										}}
										className={cn(
											simpleStyle
												? 'px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground'
												: 'py-2.5 px-3 font-medium align-middle border-b border-border/70 first:rounded-tl-lg last:rounded-tr-lg text-xs tracking-wide',
											col.sortable && 'cursor-pointer select-none group',
											col.className,
											isSticky(idx) && 'sticky z-20 bg-background border-r border-border/60'
										)}
										style={isSticky(idx) ? { left: leftOffsets[idx] || 0 } : undefined}
										onClick={() => toggleSort(col)}
										aria-sort={
											active
												? sort?.order === 'asc'
													? 'ascending'
													: 'descending'
												: 'none'
										}
										scope='col'
									>
										<span
											className={cn(
												simpleStyle
													? 'inline-flex items-center gap-1'
													: 'inline-flex items-center gap-1',
												col.hideHeaderLabel && 'sr-only'
											)}
										>
											{col.header}
											{col.sortable && (
												<span
													className={cn(
														'text-[10px] text-muted-foreground transition-opacity',
														!active && 'opacity-0 group-hover:opacity-100'
													)}
												>
													{active ? (sort?.order === 'asc' ? '▲' : '▼') : '↕'}
												</span>
											)}
										</span>
									</th>
								);
							})}
							{renderRowActions && hasAnyActions && (
								<th
									className={cn(
											simpleStyle
												? 'px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap'
												: 'py-2.5 px-3 font-medium align-middle border-b border-border/70 text-xs tracking-wide last:rounded-tr-lg whitespace-nowrap text-right'
									)}
								>
									{actionsHeader}
								</th>
							)}
						</tr>
					</thead>
						<tbody className={cn('text-xs leading-tight', simpleStyle && 'divide-y divide-border bg-background')}>
							{loading &&
								Array.from({ length: skeletonRows }).map((_, rIdx) => (
									<tr
										key={`sk-${rIdx}`}
										className={cn(
											simpleStyle ? '' : 'border-t',
											!noStriping && !simpleStyle && rIdx % 2 === 1 && 'bg-muted/20'
										)}
									>
										{columns.map((col, cIdx) => (
											<td
												key={col.key + cIdx}
												className={cn(
													simpleStyle ? 'px-6 py-4 whitespace-nowrap' : 'py-2 px-3',
													dense && 'py-1',
													col.cellClassName
												)}
											>
												<div className='h-4 w-full max-w-[140px] bg-muted/60 rounded animate-pulse' />
											</td>
										))}
										{renderRowActions && hasAnyActions && (
											<td className={cn(simpleStyle ? 'px-6 py-4 whitespace-nowrap text-right' : 'py-2 px-3 whitespace-nowrap text-right', dense && 'py-1')}>
												<div className='h-4 w-12 bg-muted/60 rounded animate-pulse' />
											</td>
										)}
									</tr>
								))}

							{!loading && data.length === 0 && (
								<tr>
									<td
										colSpan={columns.length + (renderRowActions ? 1 : 0)}
										className='py-8 text-center text-muted-foreground'
									>
										{emptyMessage}
									</td>
								</tr>
							)}

						{!loading &&
							data.map((row, i) => (
								<tr
									key={rowKey(row, i)}
									className={cn(
										simpleStyle
											? 'transition-colors hover:bg-muted/30'
											: 'border-t transition-colors hover:bg-muted/40',
										!noStriping && !simpleStyle && i % 2 === 1 && 'bg-muted/20 dark:bg-muted/10',
										getRowClassName?.(row, i)
									)}
								>
										{columns.map((col, cIdx) => (
											<td
												key={col.key}
												className={cn(
													simpleStyle ? 'px-6 py-4 whitespace-nowrap align-middle' : 'py-2 px-3 align-middle',
													dense && 'py-1',
													col.cellClassName,
													isSticky(cIdx) && 'sticky z-10 bg-background border-r border-border/60'
												)}
												style={isSticky(cIdx) ? { left: leftOffsets[cIdx] || 0 } : undefined}
											>
												{col.accessor
													? col.accessor(row)
													: ((row as unknown as Record<string, unknown>)[
														col.key
													] as React.ReactNode) ?? '—'}
											</td>
										))}
										{renderRowActions && hasAnyActions && (
											<td className={cn(simpleStyle ? 'px-6 py-4 whitespace-nowrap text-right' : 'py-2 px-3 whitespace-nowrap text-right', dense && 'py-1')}>
												<div className='flex justify-end gap-2'>
													{renderRowActions(row)}
												</div>
											</td>
										)}
									</tr>
								))}
						</tbody>
				</table>
			</div>
		</div>
	);
}
