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
		justSolved?: boolean;
		won?: boolean;
		highlightedNumber?: number;
		onclick: () => void;
		onlongpress?: () => void;
		onlongpressstart?: () => void;
		onlongpresscancel?: () => void;
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
		justSolved = false,
		won = false,
		highlightedNumber = 0,
		onclick,
		onlongpress,
		onlongpressstart,
		onlongpresscancel
	}: Props = $props();

	const winDelay = $derived(`${(row + col) * 40}ms`);

	let longPressTimer: ReturnType<typeof setTimeout> | null = null;
	let longPressTriggered = false;

	function onPointerDown() {
		longPressTriggered = false;
		onlongpressstart?.();
		longPressTimer = setTimeout(() => {
			longPressTriggered = true;
			onlongpress?.();
		}, 500);
	}

	function onPointerUp() {
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
			onlongpresscancel?.();
		}
	}

	function handleClick() {
		if (longPressTriggered) {
			longPressTriggered = false;
			return;
		}
		onclick();
	}
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
	class:just-solved={justSolved}
	class:won
	class:border-right={col === 2 || col === 5}
	class:border-bottom={row === 2 || row === 5}
	style:animation-delay={won ? winDelay : ''}
	onclick={handleClick}
	onpointerdown={onPointerDown}
	onpointerup={onPointerUp}
	onpointercancel={onPointerUp}
>
	{#if cell.value !== 0}
		<span class="value" class:solved={completedNumbers.has(cell.value)}>{cell.value}</span>
	{:else if cell.notes.length > 0}
		<div class="notes-grid" class:dim-notes={dimNotes}>
			{#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as n}
				<span class="note" class:dim={cell.notes.includes(n) && completedNumbers.has(n)} class:highlight={cell.notes.includes(n) && highlightedNumber === n}>{cell.notes.includes(n) ? n : ''}</span>
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
		background: var(--su-cell-bg, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--su-cell-border, rgba(255, 255, 255, 0.1));
		border-radius: 0;
		padding: 0;
		cursor: pointer;
		position: relative;
		transition: background 0.15s, box-shadow 0.15s;
		color: var(--text-primary);
	}

	.cell.has-value {
		background: var(--su-has-value-bg, rgba(255, 255, 255, 0.06));
	}

	.cell:hover {
		background: var(--su-hover-bg, rgba(255, 255, 255, 0.1));
	}

	.cell.highlighted {
		background: var(--su-highlight-bg);
	}

	.cell.same-number {
		background: var(--su-same-bg);
		box-shadow: inset 0 0 0 1px var(--su-same-border);
	}

	.cell.same-number .value {
		text-shadow: 0 0 6px var(--su-same-glow);
	}

	.cell.selected {
		background: var(--su-selected-bg);
		box-shadow: inset 0 0 0 2px var(--su-selected-border);
	}

	.cell.notes-mode.selected {
		background: var(--su-notes-selected-bg);
		box-shadow: inset 0 0 0 2px var(--su-notes-selected-border);
	}

	.cell.notes-mode.highlighted {
		background: var(--su-notes-highlight-bg);
	}

	.cell.notes-mode.same-number {
		background: var(--su-same-bg);
		box-shadow: inset 0 0 0 1px var(--su-same-border);
	}

	.cell.given {
		font-weight: 800;
	}

	.cell.given .value {
		color: var(--text-primary);
	}

	.cell:not(.given) .value {
		color: var(--su-user-color);
	}

	.cell.solved {
		box-shadow: inset 0 0 0 1.5px var(--su-solved-border, rgba(255,255,255,0.15));
	}

	.cell .value.solved {
		color: var(--su-solved-color, rgba(255,255,255,0.4));
	}

	.cell.just-solved .value {
		animation: solve-pop 0.5s ease-out;
	}

	@keyframes solve-pop {
		0% { transform: scale(1); opacity: 1; }
		30% { transform: scale(1.35); opacity: 0.7; }
		60% { transform: scale(0.9); }
		100% { transform: scale(1); opacity: 1; }
	}

	.cell.won {
		animation: win-wave 0.6s ease-in-out both;
	}

	.cell.won .value {
		animation: win-glow 0.6s ease-in-out both;
		animation-delay: inherit;
	}

	@keyframes win-wave {
		0% { transform: scale(1); background: var(--su-cell-bg); }
		40% { transform: scale(1.1); background: rgba(255, 215, 0, 0.3); }
		100% { transform: scale(1); background: var(--su-cell-bg); }
	}

	@keyframes win-glow {
		0% { color: var(--text-primary); text-shadow: none; }
		40% { color: #ffd700; text-shadow: 0 0 12px rgba(255, 215, 0, 0.8); }
		100% { color: var(--text-primary); text-shadow: none; }
	}

	.cell.conflict:not(.given) .value,
	.cell.incorrect:not(.given) .value {
		color: var(--su-error-color);
	}

	.cell.border-right {
		border-right: 2px solid rgba(255, 255, 255, 0.7);
	}

	.cell.border-bottom {
		border-bottom: 2px solid rgba(255, 255, 255, 0.7);
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
		color: var(--su-note-color, rgba(255, 200, 100, 0.7));
		line-height: 1;
		font-weight: 600;
		transition: opacity 0.15s;
	}

	.note.highlight {
		color: var(--su-note-color, rgba(255, 200, 100, 0.7));
		font-weight: 800;
		opacity: 1;
	}

	.note.dim {
		opacity: 0.25;
	}

	.dim-notes .note:not(.highlight) {
		opacity: 0.25;
	}
</style>
