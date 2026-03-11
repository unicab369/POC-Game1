<script lang="ts">
	import { CardComponent, suitSymbol } from '$lib/cards';
	import Pile from './Pile.svelte';
	import { newGame, handleClick, clearSelection } from './game';
	import type { GameState } from './game';

	let game: GameState = $state(newGame());
	let initialGame: GameState = $state(structuredClone($state.snapshot(game)));
	let history: GameState[] = $state([]);
	let showPlayMenu = $state(false);
	let elapsed = $state(0);
	let timerInterval: ReturnType<typeof setInterval> | null = null;

	function startTimer() {
		stopTimer();
		elapsed = 0;
		timerInterval = setInterval(() => {
			if (!game.won) elapsed++;
		}, 1000);
	}

	function stopTimer() {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
	}

	$effect(() => {
		startTimer();
		return () => stopTimer();
	});

	function formatTime(s: number): string {
		const m = Math.floor(s / 60);
		const sec = s % 60;
		return `${m}:${sec.toString().padStart(2, '0')}`;
	}

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

	function onFreeCellClick(index: number) {
		pushHistory();
		game = handleClick(game, 'freecell', index);
	}

	function onFoundationClick(index: number) {
		pushHistory();
		game = handleClick(game, 'foundation', index);
	}

	function onNewGame() {
		game = newGame();
		initialGame = structuredClone($state.snapshot(game));
		history = [];
		showPlayMenu = false;
		startTimer();
	}

	function onReset() {
		game = structuredClone($state.snapshot(initialGame));
		history = [];
		showPlayMenu = false;
		startTimer();
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

	const foundationSuits = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') onDeselect();
	}}
/>

<div class="board" role="application" aria-label="FreeCell Game">
	<a href="/" class="back-btn" aria-label="Back to main menu">&larr; Back</a>
	<div class="stats">
		<span class="stat">{formatTime(elapsed)}</span>
		<span class="stat-divider"></span>
		<span class="stat">Moves: {game.moves}</span>
	</div>

	<!-- Top Bar -->
	<div class="top-bar">
		<!-- Free Cells -->
		<div class="cell-group">
			{#each game.freeCells as cell, i}
				{#if cell}
					<CardComponent
						card={cell}
						selected={game.selected?.source === 'freecell' &&
							game.selected.index === i}
						onclick={() => onFreeCellClick(i)}
					/>
				{:else}
					<button class="slot" onclick={() => onFreeCellClick(i)}>
						<span class="slot-label">Free</span>
					</button>
				{/if}
			{/each}
		</div>

		<!-- Foundations -->
		<div class="cell-group">
			{#each game.foundations as pile, i}
				{#if pile.length > 0}
					<CardComponent
						card={pile[pile.length - 1]}
						onclick={() => onFoundationClick(i)}
					/>
				{:else}
					<button class="slot foundation" onclick={() => onFoundationClick(i)}>
						<span class="slot-label foundation-label">{suitSymbol(foundationSuits[i])}</span>
					</button>
				{/if}
			{/each}
		</div>
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
		--card-w: 70px;
		--card-h: 100px;
		--card-compact-h: 40px;
		--card-gap: 6px;
		--card-rank-fs: 28px;
		--card-suit-fs: 24px;
		--card-big-suit-fs: 58px;
		--card-face-fs: 76px;

		position: relative;
		max-width: 700px;
		margin: 0 auto;
		padding: 1rem;
		padding-bottom: 4rem;
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
		margin-bottom: 0.25rem;
		transition: color 0.2s, background 0.2s;
	}

	.back-btn:hover {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.08);
	}

	.stats {
		display: flex;
		justify-content: center;
		gap: 1.5rem;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.stat {
		color: var(--text-primary);
		font-size: 1.25rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.stat-divider {
		width: 1px;
		height: 1.2rem;
		background: var(--text-muted);
	}

	.top-bar {
		display: flex;
		justify-content: space-between;
		margin-bottom: 1.5rem;
		gap: 1rem;
	}

	.cell-group {
		display: flex;
		gap: var(--card-gap, 6px);
	}

	.slot {
		width: var(--card-w, 70px);
		height: var(--card-h, 100px);
		border: 2px dashed #445;
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.03);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		padding: 0;
		color: #556;
	}

	.slot:hover {
		border-color: #667;
	}

	.slot-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.foundation-label {
		font-size: 1.5rem;
		opacity: 0.3;
	}

	.tableau {
		display: flex;
		gap: var(--card-gap, 6px);
		justify-content: center;
	}

	.controls {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		justify-content: center;
		gap: 1rem;
		padding: 0.75rem 1rem;
		background: var(--bg-primary);
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		z-index: 10;
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

	.btn:hover {
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
			--card-w: calc((100vw - 1rem - 7 * 4px) / 8);
			--card-h: calc(var(--card-w) * 100 / 70);
			--card-compact-h: calc(var(--card-w) * 0.55);
			--card-gap: 4px;
			--card-rank-fs: calc(var(--card-w) * 0.38);
			--card-suit-fs: calc(var(--card-w) * 0.32);
			--card-big-suit-fs: calc(var(--card-w) * 0.8);
			--card-face-fs: calc(var(--card-w) * 1.05);

			max-width: 100%;
			padding: 0.5rem;
		}

		.top-bar {
			margin-bottom: 0.75rem;
			gap: 0.5rem;
		}
	}
</style>
