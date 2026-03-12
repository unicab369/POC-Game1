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
		completedNumbers: Set<number>;
		dimNotes: boolean;
		notesMode?: boolean;
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
		completedNumbers,
		dimNotes,
		notesMode = false,
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
	class:notes-mode={notesMode}
	class:has-value={cell.value !== 0}
	class:solved={cell.value !== 0 && completedNumbers.has(cell.value)}
	class:border-right={col === 2 || col === 5}
	class:border-bottom={row === 2 || row === 5}
	{onclick}
>
	{#if cell.value !== 0}
		<span class="value" class:solved={completedNumbers.has(cell.value)}>{cell.value}</span>
	{:else if cell.notes.length > 0}
		<div class="notes-grid" class:dim-notes={dimNotes}>
			{#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as n}
				<span class="note" class:dim={cell.notes.includes(n) && completedNumbers.has(n)}>{cell.notes.includes(n) ? n : ''}</span>
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

	.cell.has-value {
		background: rgba(255, 255, 255, 0.13);
	}

	.cell:hover {
		background: rgba(255, 255, 255, 0.12);
	}

	.cell.highlighted {
		background: rgba(255, 210, 60, 0.12);
	}

	.cell.same-number {
		background: rgba(255, 210, 60, 0.28);
		box-shadow: inset 0 0 0 1px rgba(255, 210, 60, 0.5);
	}

	.cell.same-number .value {
		text-shadow: 0 0 8px rgba(255, 210, 60, 0.6);
	}

	.cell.selected {
		background: rgba(255, 200, 60, 0.35);
		box-shadow: inset 0 0 0 2px rgba(255, 210, 60, 0.85);
	}

	.cell.notes-mode.selected {
		background: rgba(0, 200, 255, 0.25);
		box-shadow: inset 0 0 0 2px rgba(0, 229, 255, 0.7);
	}

	.cell.notes-mode.highlighted {
		background: rgba(0, 200, 255, 0.1);
	}

	.cell.notes-mode.same-number {
		background: rgba(255, 210, 60, 0.28);
		box-shadow: inset 0 0 0 1px rgba(255, 210, 60, 0.5);
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
		color: var(--text-primary);
	}

	.cell.solved {
		box-shadow: inset 0 0 0 1.5px rgba(243, 156, 18, 0.5);
	}

	.cell .value.solved {
		color: #f39c12;
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
		transition: opacity 0.15s;
	}

	.note.dim {
		opacity: 0.25;
	}

	.dim-notes .note {
		opacity: 0.25;
	}
</style>
