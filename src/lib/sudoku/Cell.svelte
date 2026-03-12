<script lang="ts">
	import type { Cell } from './game';

	interface Props {
		cell: Cell;
		row: number;
		col: number;
		isSelected: boolean;
		isHighlightedRegion: boolean;
		isSameNumber: boolean;
		hasConflict: boolean;
		isIncorrect: boolean;
		onclick: () => void;
	}

	let {
		cell,
		row,
		col,
		isSelected,
		isHighlightedRegion,
		isSameNumber,
		hasConflict,
		isIncorrect,
		onclick
	}: Props = $props();
</script>

<button
	class="cell"
	class:given={cell.given}
	class:selected={isSelected}
	class:highlighted={isHighlightedRegion}
	class:same-number={isSameNumber}
	class:conflict={hasConflict}
	class:incorrect={isIncorrect}
	class:border-right={col === 2 || col === 5}
	class:border-bottom={row === 2 || row === 5}
	{onclick}
>
	{#if cell.value !== 0}
		<span class="value">{cell.value}</span>
	{:else if cell.notes.length > 0}
		<div class="notes-grid">
			{#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as n}
				<span class="note">{cell.notes.includes(n) ? n : ''}</span>
			{/each}
		</div>
	{/if}
</button>

<style>
	.cell {
		width: var(--cell-size, 42px);
		height: var(--cell-size, 42px);
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 0;
		padding: 0;
		cursor: pointer;
		position: relative;
		transition: background 0.1s;
		color: var(--text-primary);
	}

	.cell:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	.cell.highlighted {
		background: rgba(0, 200, 255, 0.08);
	}

	.cell.same-number {
		background: rgba(0, 200, 255, 0.15);
	}

	.cell.selected {
		background: rgba(0, 200, 255, 0.25);
		box-shadow: inset 0 0 0 2px rgba(0, 229, 255, 0.7);
	}

	.cell.conflict .value,
	.cell.incorrect .value {
		color: #e94560;
	}

	.cell.given {
		font-weight: 800;
	}

	.cell.given .value {
		color: var(--text-primary);
	}

	.cell:not(.given) .value {
		color: #5be0f7;
	}

	.cell.conflict:not(.given) .value,
	.cell.incorrect:not(.given) .value {
		color: #e94560;
	}

	.cell.border-right {
		border-right: 2px solid rgba(255, 255, 255, 0.35);
	}

	.cell.border-bottom {
		border-bottom: 2px solid rgba(255, 255, 255, 0.35);
	}

	.value {
		font-size: var(--cell-font-size, 1.4rem);
		font-weight: 700;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.notes-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		grid-template-rows: repeat(3, 1fr);
		width: 100%;
		height: 100%;
		align-items: center;
		justify-items: center;
	}

	.note {
		font-size: var(--note-font-size, 0.5rem);
		color: var(--text-secondary);
		line-height: 1;
		font-weight: 600;
	}
</style>
