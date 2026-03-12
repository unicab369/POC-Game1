<script lang="ts">
	import { CardComponent } from '$lib/cards';
	import Pile from './Pile.svelte';
	import { newGame, handleClick, dealFromStock, clearSelection } from './game';
	import type { GameState } from './game';

	let game: GameState = $state(newGame());
	let initialGame: GameState = $state(structuredClone($state.snapshot(game)));
	let history: GameState[] = $state([]);
	let showPlayMenu = $state(false);
	let pendingAction: (() => void) | null = $state(null);
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

	function confirmAction(action: () => void) {
		pendingAction = action;
	}

	function onConfirm() {
		if (pendingAction) pendingAction();
		pendingAction = null;
		showPlayMenu = false;
	}

	function onCancelConfirm() {
		pendingAction = null;
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
	<h1 class="game-title">Spider</h1>
	<div class="stats">
		<span class="stat">{formatTime(elapsed)}</span>
		<span class="stat-divider"></span>
		<span class="stat">Moves: {game.moves}</span>
	</div>

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
		<button class="btn" onclick={() => { showPlayMenu = !showPlayMenu; pendingAction = null; }}>Play &#9662;</button>
		{#if showPlayMenu}
			<div class="play-menu">
				{#if pendingAction}
					<span class="confirm-label">Are you sure?</span>
					<div class="confirm-buttons">
						<button class="confirm-btn yes" onclick={onConfirm}>Yes</button>
						<button class="confirm-btn no" onclick={onCancelConfirm}>No</button>
					</div>
				{:else}
					<button class="menu-item" onclick={() => confirmAction(onNewGame)}>New Game</button>
					<button class="menu-item" onclick={() => confirmAction(onReset)}>Reset</button>
					<button class="menu-item" onclick={() => confirmAction(() => { window.location.href = '/'; })}>Close</button>
				{/if}
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
		margin-bottom: 0.75rem;
		transition: color 0.2s, background 0.2s;
	}

	.back-btn:hover {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.08);
	}

	.game-title {
		text-align: center;
		font-size: 1.4rem;
		font-weight: 800;
		margin: 0 0 0.25rem;
		color: var(--text-primary);
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
		position: fixed;
		bottom: 50%;
		left: 50%;
		transform: translate(-50%, 50%);
		background: var(--bg-secondary);
		border-radius: 12px;
		box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);
		overflow: hidden;
		min-width: 220px;
		z-index: 60;
	}

	.menu-item {
		display: block;
		width: 100%;
		padding: 1rem 1.5rem;
		border: none;
		background: none;
		color: var(--text-primary);
		font-size: 1.15rem;
		font-weight: 600;
		text-align: center;
		cursor: pointer;
		text-decoration: none;
		transition: background 0.15s;
	}

	.menu-item:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	.confirm-label {
		display: block;
		padding: 1rem 1.5rem 0.5rem;
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--text-secondary);
		text-align: center;
	}

	.confirm-buttons {
		display: flex;
		gap: 0.75rem;
		padding: 0.5rem 1.5rem 1rem;
		justify-content: center;
	}

	.confirm-btn {
		padding: 0.5rem 1.5rem;
		border: none;
		border-radius: 8px;
		font-size: 1.05rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s;
	}

	.confirm-btn.yes {
		background: var(--accent);
		color: white;
	}

	.confirm-btn.yes:hover {
		background: var(--accent-hover);
	}

	.confirm-btn.no {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-primary);
	}

	.confirm-btn.no:hover {
		background: rgba(255, 255, 255, 0.18);
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
