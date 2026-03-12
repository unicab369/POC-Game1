<script lang="ts">
	import type { Cell } from './game';

	interface Props {
		cell: Cell;
		row: number;
		col: number;
		lost: boolean;
		won: boolean;
		onclick: () => void;
		oncontextmenu: (e: MouseEvent) => void;
		onpointerdown: (e: PointerEvent) => void;
		onpointerup: () => void;
	}

	let {
		cell,
		row,
		col,
		lost,
		won,
		onclick,
		oncontextmenu,
		onpointerdown,
		onpointerup
	}: Props = $props();

	const numberColors: Record<number, string> = {
		1: '#4a90d9',
		2: '#2ecc71',
		3: '#e74c3c',
		4: '#1a3a6b',
		5: '#8b1a1a',
		6: '#1abc9c',
		7: '#8e44ad',
		8: '#7f8c8d'
	};
</script>

<button
	class="cell"
	class:hidden={!cell.revealed}
	class:revealed={cell.revealed}
	class:flagged={cell.flagged}
	class:mine={cell.revealed && cell.isMine}
	class:exploded={cell.exploded}
	class:won
	{onclick}
	{oncontextmenu}
	{onpointerdown}
	{onpointerup}
>
	{#if cell.flagged && !cell.revealed}
		<span class="icon flag">🚩</span>
	{:else if cell.revealed && cell.isMine}
		<span class="icon">💣</span>
	{:else if cell.revealed && cell.adjacentMines > 0}
		<span class="number" style="color: {numberColors[cell.adjacentMines]}">{cell.adjacentMines}</span>
	{/if}
</button>

<style>
	.cell {
		width: var(--cell-size, 32px);
		height: var(--cell-size, 32px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: none;
		cursor: pointer;
		position: relative;
		transition: background 0.1s;
		font-size: calc(var(--cell-size, 32px) * 0.55);
		line-height: 1;
		user-select: none;
		-webkit-user-select: none;
	}

	.cell.hidden {
		background: var(--ms-hidden-bg, rgba(255, 255, 255, 0.12));
		border: 1px solid rgba(255, 255, 255, 0.08);
		box-shadow: inset 1px 1px 0 rgba(255, 255, 255, 0.15), inset -1px -1px 0 rgba(0, 0, 0, 0.2);
	}

	.cell.hidden:hover {
		background: var(--ms-hidden-hover, rgba(255, 255, 255, 0.18));
	}

	.cell.revealed {
		background: var(--ms-revealed-bg, rgba(255, 255, 255, 0.03));
		border: 1px solid rgba(255, 255, 255, 0.05);
	}

	.cell.exploded {
		background: rgba(231, 76, 60, 0.5);
	}

	.cell.mine:not(.exploded) {
		background: var(--ms-revealed-bg, rgba(255, 255, 255, 0.03));
	}

	.cell.won.hidden {
		background: rgba(46, 204, 113, 0.2);
		border-color: rgba(46, 204, 113, 0.3);
	}

	.icon {
		font-size: calc(var(--cell-size, 32px) * 0.5);
		line-height: 1;
	}

	.icon.flag {
		font-size: calc(var(--cell-size, 32px) * 0.45);
	}

	.number {
		font-weight: 800;
		font-size: calc(var(--cell-size, 32px) * 0.55);
		font-variant-numeric: tabular-nums;
	}
</style>
