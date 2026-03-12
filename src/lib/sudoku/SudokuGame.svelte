<script lang="ts">
	import CellComponent from './Cell.svelte';
	import {
		newGame,
		selectCell,
		clearSelection,
		handleNumberInput,
		handleErase,
		toggleNotesMode,
		toggleShowErrors,
		hasConflict,
		isIncorrect
	} from './game';
	import type { GameState, Difficulty } from './game';

	let game: GameState = $state(newGame('easy'));
	let initialGame: GameState = $state(structuredClone($state.snapshot(game)));
	let history: GameState[] = $state([]);
	let showPlayMenu = $state(false);
	let pendingAction: (() => void) | null = $state(null);
	let elapsed = $state(0);
	let timerInterval: ReturnType<typeof setInterval> | null = null;
	let pickingDifficulty = $state(false);

	// Timer
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

	// History / Undo
	function pushHistory() {
		history = [...history, structuredClone($state.snapshot(game))];
	}

	function onUndo() {
		if (history.length === 0) return;
		game = history[history.length - 1];
		history = history.slice(0, -1);
	}

	// Cell interaction
	let lastCellTap: { row: number; col: number; time: number } | null = null;
	const DOUBLE_TAP_MS = 350;

	function onCellClick(row: number, col: number) {
		if (game.won) return;
		const now = Date.now();
		const cell = game.grid[row][col];

		// Double-tap on empty non-given cell → toggle notes mode
		if (lastCellTap && lastCellTap.row === row && lastCellTap.col === col &&
			now - lastCellTap.time < DOUBLE_TAP_MS && cell.value === 0 && !cell.given) {
			lastCellTap = null;
			if (!game.notesMode) game = toggleNotesMode(game);
			game = selectCell(game, row, col);
			return;
		}

		lastCellTap = { row, col, time: now };
		game = selectCell(game, row, col);
	}

	function onNumberPad(num: number) {
		if (game.won || !game.selected) return;
		pushHistory();
		game = handleNumberInput(game, num);
	}

	function onErase() {
		if (game.won || !game.selected) return;
		pushHistory();
		game = handleErase(game);
	}

	function onToggleNotes() {
		game = toggleNotesMode(game);
	}

	function onToggleErrors() {
		game = toggleShowErrors(game);
	}

	// Highlighting helpers
	function isSameRegion(r1: number, c1: number, r2: number, c2: number): boolean {
		if (r1 === r2) return true;
		if (c1 === c2) return true;
		if (Math.floor(r1 / 3) === Math.floor(r2 / 3) && Math.floor(c1 / 3) === Math.floor(c2 / 3))
			return true;
		return false;
	}

	// Track the last non-zero number selected for persistent highlighting
	let highlightedNumber = $state(0);

	$effect(() => {
		if (game.selected) {
			const v = game.grid[game.selected.row][game.selected.col].value;
			if (v !== 0) highlightedNumber = v;
		}
	});

	// Number completion check
	const completedNumbers = $derived.by(() => {
		const counts = new Array(10).fill(0);
		for (let r = 0; r < 9; r++) {
			for (let c = 0; c < 9; c++) {
				const v = game.grid[r][c].value;
				if (v > 0) counts[v]++;
			}
		}
		const set = new Set<number>();
		for (let n = 1; n <= 9; n++) {
			if (counts[n] >= 9) set.add(n);
		}
		return set;
	});

	// New game / Reset / Play menu
	function onNewGame(difficulty: Difficulty) {
		game = newGame(difficulty);
		initialGame = structuredClone($state.snapshot(game));
		history = [];
		showPlayMenu = false;
		pickingDifficulty = false;
		pendingAction = null;
		startTimer();
	}

	function onReset() {
		game = structuredClone($state.snapshot(initialGame));
		history = [];
		showPlayMenu = false;
		startTimer();
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
			} else if (game.selected) {
				game = clearSelection(game);
			}
			return;
		}

		if (game.won) return;

		// Arrow keys
		if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
			e.preventDefault();
			const sel = game.selected ?? { row: 0, col: 0 };
			let { row, col } = sel;
			if (e.key === 'ArrowUp') row = Math.max(0, row - 1);
			if (e.key === 'ArrowDown') row = Math.min(8, row + 1);
			if (e.key === 'ArrowLeft') col = Math.max(0, col - 1);
			if (e.key === 'ArrowRight') col = Math.min(8, col + 1);
			game = selectCell(game, row, col);
			return;
		}

		// Number keys
		const num = parseInt(e.key);
		if (num >= 1 && num <= 9) {
			onNumberPad(num);
			return;
		}

		// Backspace / Delete
		if (e.key === 'Backspace' || e.key === 'Delete') {
			onErase();
			return;
		}

		// N for notes toggle
		if (e.key === 'n' || e.key === 'N') {
			onToggleNotes();
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

<div class="board" role="application" aria-label="Sudoku Game">
	<div class="header">
		<h1 class="game-title"><span class="title-su">Su</span><span class="title-doku">doku</span></h1>
		<div class="stats">
			<span class="stat">{formatTime(elapsed)}</span>
			<span class="stat-divider"></span>
			<span class="stat">Moves: {game.moves}</span>
		</div>
	</div>

	<div class="difficulty-badge" style="background: {difficultyColor[game.difficulty]}">
		{difficultyLabel[game.difficulty]}
	</div>

	<!-- 9x9 Grid -->
	<div class="grid-wrapper">
		<div class="grid">
			{#each game.grid as gridRow, r}
				{#each gridRow as cell, c}
					<CellComponent
						{cell}
						row={r}
						col={c}
						isSelected={game.selected?.row === r && game.selected?.col === c}
						isHighlightedRegion={game.selected !== null &&
							!(game.selected.row === r && game.selected.col === c) &&
							isSameRegion(game.selected.row, game.selected.col, r, c)}
						isSameNumber={highlightedNumber !== 0 &&
							!(game.selected?.row === r && game.selected?.col === c) &&
							cell.value === highlightedNumber}
						hasConflict={game.showErrors && hasConflict(game.grid, r, c)}
						isIncorrect={game.showErrors && isIncorrect(game, r, c)}
						{completedNumbers}
						dimNotes={game.selected !== null && game.grid[game.selected.row][game.selected.col].value !== 0}
						notesMode={game.notesMode}
						onclick={() => onCellClick(r, c)}
					/>
				{/each}
			{/each}
		</div>
	</div>

	<!-- Number Pad -->
	<div class="number-pad">
		{#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as num}
			<button
				class="num-btn"
				class:dim={completedNumbers.has(num)}
				onclick={() => onNumberPad(num)}
				disabled={game.won}
			>
				{num}
			</button>
		{/each}
	</div>

	<!-- Action Bar -->
	<div class="action-bar">
		<button
			class="action-btn"
			onclick={onErase}
			disabled={game.won}
		>
			Erase
		</button>
		<button
			class="action-btn"
			class:active={game.notesMode}
			onclick={onToggleNotes}
			disabled={game.won || (game.selected !== null && game.grid[game.selected.row][game.selected.col].value !== 0)}
		>
			Notes
		</button>
		<button
			class="action-btn"
			class:active={game.showErrors}
			onclick={onToggleErrors}
		>
			Errors
		</button>
	</div>

	<!-- Win overlay -->
	{#if game.won}
		<div class="win-overlay">
			<div class="win-box">
				<h2>You Win!</h2>
				<p class="win-stats">{formatTime(elapsed)} &bull; {game.moves} moves</p>
				<button class="btn" onclick={() => onNewGame(game.difficulty)}>New Game</button>
			</div>
		</div>
	{/if}
</div>

<!-- Controls -->
<div class="controls">
	<button class="btn btn-secondary" onclick={onUndo} disabled={history.length === 0}>Undo</button>
	<div class="play-menu-wrapper">
		<button class="btn" onclick={() => { showPlayMenu = !showPlayMenu; pendingAction = null; pickingDifficulty = false; }}>Play &#9662;</button>
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
					<button class="menu-item" onclick={() => history.length === 0 ? onNewGame('easy') : confirmAction(() => onNewGame('easy'))}>Easy</button>
					<button class="menu-item" onclick={() => history.length === 0 ? onNewGame('medium') : confirmAction(() => onNewGame('medium'))}>Medium</button>
					<button class="menu-item" onclick={() => history.length === 0 ? onNewGame('hard') : confirmAction(() => onNewGame('hard'))}>Hard</button>
					<button class="menu-item back-item" onclick={() => { pickingDifficulty = false; }}>Back</button>
				{:else}
					<button class="menu-item" onclick={() => { pickingDifficulty = true; }}><span class="menu-icon">&#9654;</span> New Game</button>
					<button class="menu-item" onclick={() => history.length === 0 ? onReset() : confirmAction(onReset)}><span class="menu-icon">&#8634;</span> Reset</button>
					<button class="menu-item" onclick={() => confirmAction(() => { window.location.href = '/'; })}><span class="menu-icon">&#10005;</span> Quit</button>
					<button class="menu-item cancel" onclick={() => { showPlayMenu = false; }}>Cancel</button>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.board {
		--cell-size: 42px;
		--cell-font-size: 1.4rem;
		--note-font-size: 0.5rem;

		position: relative;
		max-width: 440px;
		margin: 0 auto;
		padding: 0.5rem;
		padding-bottom: 4rem;
		user-select: none;
		-webkit-user-select: none;
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

	.title-su {
		color: #f39c12;
	}

	.title-doku {
		color: #f7c948;
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

	.difficulty-badge {
		display: inline-block;
		padding: 0.2rem 0.75rem;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 700;
		color: white;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.75rem;
		cursor: pointer;
		border: none;
		transition: filter 0.15s;
	}

	.difficulty-badge:hover {
		filter: brightness(1.2);
	}

	.grid-wrapper {
		display: flex;
		justify-content: center;
		margin-bottom: 1rem;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(9, var(--cell-size, 42px));
		grid-template-rows: repeat(9, var(--cell-size, 42px));
		border: 2px solid rgba(255, 255, 255, 0.35);
	}

	.number-pad {
		display: flex;
		justify-content: center;
		gap: 0.35rem;
		margin-bottom: 0.75rem;
	}

	.num-btn {
		width: var(--cell-size, 42px);
		height: calc(var(--cell-size, 42px) * 1.15);
		border: none;
		border-radius: 8px;
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-size: var(--cell-font-size, 1.4rem);
		font-weight: 700;
		cursor: pointer;
		transition: background 0.15s, opacity 0.15s;
	}

	.num-btn:hover:not(:disabled) {
		background: var(--bg-card);
	}

	.num-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.num-btn.dim {
		opacity: 0.25;
	}

	.action-bar {
		display: flex;
		justify-content: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.action-btn {
		padding: 0.45rem 1.1rem;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 8px;
		background: transparent;
		color: var(--text-secondary);
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s, color 0.15s, border-color 0.15s;
	}

	.action-btn:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-primary);
	}

	.action-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.action-btn.active {
		background: rgba(0, 200, 255, 0.15);
		color: #5be0f7;
		border-color: rgba(0, 200, 255, 0.3);
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
		text-align: left;
		cursor: pointer;
		text-decoration: none;
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
		margin-bottom: 0.5rem;
		color: var(--gold);
	}

	.win-stats {
		color: var(--text-secondary);
		font-size: 1.1rem;
		margin-bottom: 1.5rem;
	}

	@media (max-width: 600px) {
		.board {
			--cell-size: calc((100vw - 0.5rem - 4px) / 9);
			--cell-font-size: calc(var(--cell-size) * 0.55);
			--note-font-size: calc(var(--cell-size) * 0.2);
			max-width: 100%;
			padding: 0.25rem;
		}

		.num-btn {
			width: var(--cell-size);
			height: calc(var(--cell-size) * 1.15);
			font-size: var(--cell-font-size);
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
