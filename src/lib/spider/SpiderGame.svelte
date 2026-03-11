<script lang="ts">
	import { CardComponent } from '$lib/cards';
	import Pile from './Pile.svelte';
	import { newGame, handleClick, dealFromStock, clearSelection } from './game';
	import type { GameState } from './game';

	let game: GameState = $state(newGame());
	let initialGame: GameState = $state(structuredClone($state.snapshot(game)));
	let history: GameState[] = $state([]);
	let showPlayMenu = $state(false);

	const hasEmptyColumn = $derived(game.tableau.some((col) => col.length === 0));
	const dealsRemaining = $derived(Math.floor(game.stock.length / 10));

	function pushHistory() {
		history = [...history, structuredClone($state.snapshot(game))];
	}

	function onTableauClick(columnIndex: number, cardIndex: number) {
		pushHistory();
		if (cardIndex === -1) {
			game = handleClick(game, 'tableau', columnIndex);
		} else {
			game = handleClick(game, 'tableau', columnIndex, cardIndex);
		}
	}

	function onStockClick() {
		pushHistory();
		game = dealFromStock(game);
	}

	function onNewGame() {
		game = newGame();
		initialGame = structuredClone($state.snapshot(game));
		history = [];
		showPlayMenu = false;
	}

	function onReset() {
		game = structuredClone($state.snapshot(initialGame));
		history = [];
		showPlayMenu = false;
	}

	function onUndo() {
		if (history.length === 0) return;
		game = history[history.length - 1];
		history = history.slice(0, -1);
	}

	function onDeselect() {
		if (showPlayMenu) {
			showPlayMenu = false;
			return;
		}
		if (game.selected) {
			game = clearSelection(game);
		}
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') onDeselect();
	}}
/>

<div class="board" role="application" aria-label="Spider Solitaire Game">
	<a href="/" class="back-btn" aria-label="Back to main menu">&larr; Back</a>

	<!-- Info Bar -->
	<div class="info-bar">
		<!-- Completed suits indicator -->
		<div class="completed">
			{#each Array(8) as _, i}
				<span class="suit-marker" class:filled={i < game.completedSuits}>&#9824;</span>
			{/each}
		</div>

		<!-- Stock -->
		{#if game.stock.length > 0}
			<div class="stock-wrapper" class:stock-disabled={hasEmptyColumn}>
				<CardComponent
					card={game.stock[game.stock.length - 1]}
					faceDown={true}
					onclick={hasEmptyColumn ? undefined : onStockClick}
				/>
				<span class="deal-badge">{dealsRemaining}</span>
			</div>
		{:else}
			<div class="slot"></div>
		{/if}
	</div>

	<!-- Tableau -->
	<div class="tableau">
		{#each game.tableau as column, i}
			<Pile
				cards={column}
				columnIndex={i}
				selected={game.selected}
				onCardClick={onTableauClick}
			/>
		{/each}
	</div>

	<!-- Win overlay -->
	{#if game.won}
		<div class="win-overlay">
			<div class="win-box">
				<h2>You Win!</h2>
				<button class="btn" onclick={onNewGame}>New Game</button>
			</div>
		</div>
	{/if}
</div>

<!-- Controls -->
<div class="controls">
	<button class="btn btn-secondary" onclick={onUndo} disabled={history.length === 0}>Undo</button>
	<div class="play-menu-wrapper">
		<button class="btn" onclick={() => (showPlayMenu = !showPlayMenu)}>Play &#9662;</button>
		{#if showPlayMenu}
			<div class="play-menu">
				<button class="menu-item" onclick={onNewGame}>New Game</button>
				<button class="menu-item" onclick={onReset}>Reset</button>
				<a class="menu-item" href="/">Close</a>
			</div>
		{/if}
	</div>
</div>

<style>
	.board {
		--card-w: 60px;
		--card-h: 86px;
		--card-compact-h: 24px;
		--card-gap: 4px;
		--card-rank-fs: 24px;
		--card-suit-fs: 20px;
		--card-big-suit-fs: 40px;

		position: relative;
		max-width: 750px;
		margin: 0 auto;
		padding: 1rem;
	}

	.back-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		color: var(--text-secondary);
		text-decoration: none;
		font-size: 0.95rem;
		font-weight: 600;
		padding: 0.4rem 0.8rem;
		border-radius: 8px;
		margin-bottom: 0.75rem;
		transition: color 0.2s, background 0.2s;
	}

	.back-btn:hover {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.08);
	}

	.info-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		gap: 1rem;
	}

	.completed {
		display: flex;
		gap: 4px;
		font-size: 1.3rem;
	}

	.suit-marker {
		opacity: 0.2;
		color: #888;
	}

	.suit-marker.filled {
		opacity: 1;
		color: var(--gold, #f1c40f);
	}

	.slot {
		width: var(--card-w, 60px);
		height: var(--card-h, 86px);
		border: 2px dashed #445;
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.03);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		padding: 0;
		color: #556;
		position: relative;
	}

	.slot:hover:not(:disabled) {
		border-color: #667;
	}

	.slot:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.stock-wrapper {
		position: relative;
		cursor: pointer;
	}

	.stock-wrapper.stock-disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.slot-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.deal-badge {
		position: absolute;
		bottom: -6px;
		right: -6px;
		background: var(--accent, #e94560);
		color: white;
		font-size: 0.7rem;
		font-weight: 700;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.tableau {
		display: flex;
		gap: var(--card-gap, 4px);
		justify-content: center;
	}

	.controls {
		display: flex;
		justify-content: center;
		gap: 1rem;
		padding: 1rem;
	}

	.btn {
		padding: 0.6rem 1.5rem;
		border-radius: 8px;
		border: none;
		font-size: 0.95rem;
		font-weight: 600;
		background: var(--accent);
		color: white;
		cursor: pointer;
		transition: background 0.2s;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
	}

	.btn:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	.btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.btn-secondary {
		background: var(--bg-secondary);
	}

	.btn-secondary:hover:not(:disabled) {
		background: var(--bg-card);
	}

	.play-menu-wrapper {
		position: relative;
	}

	.play-menu {
		position: absolute;
		bottom: 100%;
		left: 50%;
		transform: translateX(-50%);
		margin-bottom: 0.5rem;
		background: var(--bg-secondary);
		border-radius: 8px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
		overflow: hidden;
		min-width: 140px;
		z-index: 50;
	}

	.menu-item {
		display: block;
		width: 100%;
		padding: 0.7rem 1rem;
		border: none;
		background: none;
		color: var(--text-primary);
		font-size: 0.9rem;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
		text-decoration: none;
		transition: background 0.15s;
	}

	.menu-item:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	.win-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.win-box {
		background: var(--bg-secondary);
		padding: 3rem;
		border-radius: var(--radius);
		text-align: center;
		box-shadow: var(--shadow);
	}

	.win-box h2 {
		font-size: 2.5rem;
		margin-bottom: 1.5rem;
		color: var(--gold);
	}

	@media (max-width: 600px) {
		.board {
			--card-w: calc((100vw - 0.5rem - 9 * 3px) / 10);
			--card-h: calc(var(--card-w) * 86 / 60);
			--card-compact-h: calc(var(--card-w) * 0.4);
			--card-gap: 3px;
			--card-rank-fs: calc(var(--card-w) * 0.38);
			--card-suit-fs: calc(var(--card-w) * 0.32);
			--card-big-suit-fs: calc(var(--card-w) * 0.65);

			max-width: 100%;
			padding: 0.25rem;
		}

		.info-bar {
			margin-bottom: 0.5rem;
			gap: 0.5rem;
		}

		.completed {
			font-size: 1rem;
			gap: 2px;
		}
	}
</style>
