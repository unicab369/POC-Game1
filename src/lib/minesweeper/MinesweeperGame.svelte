<script lang="ts">
	import { base } from '$app/paths';
	import CellComponent from './Cell.svelte';
	import { newGame, revealCell, toggleFlag } from './game';
	import type { GameState, Difficulty } from './game';

	let game: GameState = $state(newGame('easy'));
	let initialGame: GameState = $state(structuredClone($state.snapshot(game)));
	let history: GameState[] = $state([]);
	let showPlayMenu = $state(false);
	let pendingAction: (() => void) | null = $state(null);
	let elapsed = $state(0);
	let timerInterval: ReturnType<typeof setInterval> | null = null;
	let pickingDifficulty = $state(false);
	let selectedCell: { row: number; col: number } = $state({ row: 0, col: 0 });

	// Long-press for mobile flagging
	let longPressTimer: ReturnType<typeof setTimeout> | null = null;
	let longPressTriggered = $state(false);

	// Timer
	function startTimer() {
		stopTimer();
		elapsed = 0;
	}

	function stopTimer() {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
	}

	function ensureTimerRunning() {
		if (!timerInterval) {
			timerInterval = setInterval(() => {
				if (!game.won && !game.lost) elapsed++;
			}, 1000);
		}
	}

	$effect(() => {
		return () => stopTimer();
	});

	function formatTime(s: number): string {
		const m = Math.floor(s / 60);
		const sec = s % 60;
		return `${m}:${sec.toString().padStart(2, '0')}`;
	}

	// History / Undo
	function pushHistory() {
		history = [...history, structuredClone($state.snapshot(game))];
	}

	function onUndo() {
		if (history.length === 0) return;
		game = history[history.length - 1];
		history = history.slice(0, -1);
	}

	// Cell interactions
	function onCellClick(row: number, col: number) {
		if (game.won || game.lost) return;
		if (longPressTriggered) {
			longPressTriggered = false;
			return;
		}
		pushHistory();
		const prev = game;
		game = revealCell(game, row, col);
		if (game !== prev && game.started) {
			ensureTimerRunning();
		}
	}

	function onCellContextMenu(e: MouseEvent, row: number, col: number) {
		e.preventDefault();
		if (game.won || game.lost) return;
		pushHistory();
		game = toggleFlag(game, row, col);
	}

	function onCellPointerDown(e: PointerEvent, row: number, col: number) {
		longPressTriggered = false;
		if (e.pointerType === 'touch') {
			longPressTimer = setTimeout(() => {
				longPressTriggered = true;
				if (game.won || game.lost) return;
				pushHistory();
				game = toggleFlag(game, row, col);
			}, 500);
		}
	}

	function onCellPointerUp() {
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
	}

	// Mine counter
	const mineCount = $derived(game.mines - game.flagsUsed);

	// Grid sizing
	const maxWidth = $derived.by(() => {
		const base = game.cols * 32 + 16;
		return `${Math.min(base, 1000)}px`;
	});

	// New game / Reset / Play menu
	function onNewGame(difficulty: Difficulty) {
		stopTimer();
		game = newGame(difficulty);
		initialGame = structuredClone($state.snapshot(game));
		history = [];
		showPlayMenu = false;
		pickingDifficulty = false;
		pendingAction = null;
		elapsed = 0;
	}

	function onReset() {
		stopTimer();
		game = structuredClone($state.snapshot(initialGame));
		history = [];
		showPlayMenu = false;
		elapsed = 0;
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

	// Keyboard
	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (showPlayMenu) {
				showPlayMenu = false;
				pickingDifficulty = false;
				pendingAction = null;
			}
			return;
		}

		if (game.won || game.lost) return;

		if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
			e.preventDefault();
			let { row, col } = selectedCell;
			if (e.key === 'ArrowUp') row = Math.max(0, row - 1);
			if (e.key === 'ArrowDown') row = Math.min(game.rows - 1, row + 1);
			if (e.key === 'ArrowLeft') col = Math.max(0, col - 1);
			if (e.key === 'ArrowRight') col = Math.min(game.cols - 1, col + 1);
			selectedCell = { row, col };
			return;
		}

		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			onCellClick(selectedCell.row, selectedCell.col);
			return;
		}

		if (e.key === 'f' || e.key === 'F') {
			pushHistory();
			game = toggleFlag(game, selectedCell.row, selectedCell.col);
			return;
		}
	}

	const difficultyLabel: Record<Difficulty, string> = {
		easy: 'Easy',
		medium: 'Medium',
		hard: 'Hard'
	};

	const difficultyColor: Record<Difficulty, string> = {
		easy: '#2ecc71',
		medium: '#f39c12',
		hard: '#e94560'
	};
</script>

<svelte:window onkeydown={onKeyDown} />

<div class="board" role="application" aria-label="Minesweeper Game" style="--grid-cols: {game.cols}; --max-board-width: {maxWidth}">
	<div class="header">
		<h1 class="game-title"><span class="title-mine">Mine</span><span class="title-sweeper">sweeper</span></h1>
		<div class="stats">
			<span class="stat">{formatTime(elapsed)}</span>
			<span class="stat-divider"></span>
			<span class="stat">Moves: {game.moves}</span>
		</div>
	</div>

	<div class="sub-header">
		<span class="difficulty-badge" style="background: {difficultyColor[game.difficulty]}">
			{difficultyLabel[game.difficulty]}
		</span>
		<span class="mine-counter">💣 {mineCount}</span>
	</div>

	<div class="game-content">
		<!-- Grid -->
		<div class="grid-wrapper">
			<div class="grid">
				{#each game.grid as gridRow, r}
					{#each gridRow as cell, c}
						<CellComponent
							{cell}
							row={r}
							col={c}
							lost={game.lost}
							won={game.won}
							onclick={() => onCellClick(r, c)}
							oncontextmenu={(e) => onCellContextMenu(e, r, c)}
							onpointerdown={(e) => onCellPointerDown(e, r, c)}
							onpointerup={onCellPointerUp}
						/>
					{/each}
				{/each}
			</div>
		</div>

		<!-- Win overlay -->
		{#if game.won}
			<div class="overlay">
				<div class="overlay-box win-box">
					<h2>You Win!</h2>
					<p class="overlay-stats">{formatTime(elapsed)} &bull; {game.moves} moves</p>
					<button class="btn" onclick={() => onNewGame(game.difficulty)}>New Game</button>
				</div>
			</div>
		{/if}

		<!-- Lose overlay -->
		{#if game.lost}
			<div class="overlay">
				<div class="overlay-box lose-box">
					<h2>Game Over</h2>
					<p class="overlay-stats">{formatTime(elapsed)} &bull; {game.moves} moves</p>
					<button class="btn" onclick={() => onNewGame(game.difficulty)}>Try Again</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Controls -->
<div class="controls">
	<button class="btn btn-secondary" onclick={onUndo} disabled={history.length === 0 || game.lost}><span class="btn-icon">&#8634;</span> Undo</button>
	<div class="play-menu-wrapper">
		<button class="btn" onclick={() => { showPlayMenu = !showPlayMenu; pendingAction = null; pickingDifficulty = false; }}><span class="btn-icon">&#9654;&#65039;</span> Play</button>
		{#if showPlayMenu}
			<div class="play-menu">
				{#if pendingAction}
					<span class="confirm-label">Are you sure?</span>
					<div class="confirm-buttons">
						<button class="confirm-btn yes" onclick={onConfirm}>Yes</button>
						<button class="confirm-btn no" onclick={onCancelConfirm}>No</button>
					</div>
				{:else if pickingDifficulty}
					<span class="confirm-label">Select Difficulty</span>
					<button class="menu-item" onclick={() => history.length === 0 ? onNewGame('easy') : confirmAction(() => onNewGame('easy'))}>Easy (9x9)</button>
					<button class="menu-item" onclick={() => history.length === 0 ? onNewGame('medium') : confirmAction(() => onNewGame('medium'))}>Medium (16x16)</button>
					<button class="menu-item" onclick={() => history.length === 0 ? onNewGame('hard') : confirmAction(() => onNewGame('hard'))}>Hard (30x16)</button>
					<button class="menu-item back-item" onclick={() => { pickingDifficulty = false; }}>Back</button>
				{:else}
					<button class="menu-item" onclick={() => { pickingDifficulty = true; }}><span class="menu-icon">&#9654;</span> New Game</button>
					<button class="menu-item" onclick={() => history.length === 0 ? onReset() : confirmAction(onReset)}><span class="menu-icon">&#8634;</span> Reset</button>
					<button class="menu-item" onclick={() => confirmAction(() => { window.location.href = base; })}><span class="menu-icon">&#10005;</span> Quit</button>
					<button class="menu-item cancel" onclick={() => { showPlayMenu = false; }}>Cancel</button>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.board {
		--cell-size: 32px;

		position: relative;
		max-width: var(--max-board-width, 440px);
		margin: 0 auto;
		padding: 0.5rem;
		padding-bottom: 4rem;
		min-height: calc(100dvh - 3.5rem);
		display: flex;
		flex-direction: column;
		user-select: none;
		-webkit-user-select: none;
	}

	.game-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.game-title {
		font-size: 1.35rem;
		font-weight: 800;
		margin: 0;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.title-mine {
		color: #e74c3c;
	}

	.title-sweeper {
		color: #f39c12;
	}

	.stats {
		display: flex;
		gap: 1rem;
		align-items: center;
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

	.sub-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}

	.difficulty-badge {
		display: inline-block;
		padding: 0.2rem 0.75rem;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 700;
		color: white;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.mine-counter {
		font-size: 1.1rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--text-primary);
	}

	.grid-wrapper {
		display: flex;
		justify-content: center;
		margin-bottom: 1rem;
		overflow-x: auto;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(var(--grid-cols), var(--cell-size, 32px));
		border: 2px solid rgba(255, 255, 255, 0.3);
		gap: 0;
	}

	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.overlay-box {
		background: var(--bg-card);
		padding: 3rem;
		border-radius: var(--radius);
		text-align: center;
		box-shadow: var(--shadow);
		border: 1.5px solid rgba(255, 255, 255, 0.3);
	}

	.win-box h2 {
		font-size: 2.5rem;
		margin-bottom: 0.5rem;
		color: var(--gold);
	}

	.lose-box h2 {
		font-size: 2.5rem;
		margin-bottom: 0.5rem;
		color: #e74c3c;
	}

	.overlay-stats {
		color: var(--text-secondary);
		font-size: 1.1rem;
		margin-bottom: 1.5rem;
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
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	.btn-icon {
		font-size: 1.1rem;
		line-height: 1;
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
		position: fixed;
		bottom: 50%;
		left: 50%;
		transform: translate(-50%, 50%);
		background: var(--bg-card);
		border-radius: 12px;
		box-shadow: var(--shadow);
		border: 1.5px solid rgba(255, 255, 255, 0.3);
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
		text-align: left;
		cursor: pointer;
		transition: background 0.15s;
	}

	.menu-icon {
		display: inline-block;
		width: 1.5rem;
		text-align: center;
		margin-right: 0.5rem;
	}

	.menu-item:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	.menu-item.cancel {
		color: var(--text-muted);
		font-size: 1rem;
		text-align: center;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}

	.back-item {
		color: var(--text-secondary);
		font-size: 0.95rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
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

	@media (max-width: 600px) {
		.board {
			--cell-size: calc((100vw - 0.5rem - 4px) / var(--grid-cols));
			max-width: 100%;
			padding: 0.25rem;
		}

		.header {
			flex-wrap: wrap;
			gap: 0.25rem;
		}

		.stat {
			font-size: 1rem;
		}
	}
</style>
