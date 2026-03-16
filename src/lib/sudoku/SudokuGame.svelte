<script lang="ts">
	import { base } from '$app/paths';
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

	// Color schemes
	interface ColorScheme {
		name: string;
		preview: string; // main accent color for swatch
		vars: Record<string, string>;
	}

	const colorSchemes: ColorScheme[] = [
		{
			name: 'Ocean',
			preview: '#5090ff',
			vars: {
				'--su-highlight-bg': 'rgba(80,144,255,0.18)',
				'--su-same-bg': 'rgba(80,144,255,0.32)',
				'--su-same-border': 'rgba(80,144,255,0.55)',
				'--su-same-glow': 'rgba(80,144,255,0.6)',
				'--su-selected-bg': 'rgba(80,144,255,0.4)',
				'--su-selected-border': 'rgba(90,160,255,0.9)',
				'--su-notes-selected-bg': 'rgba(255,200,100,0.25)',
				'--su-notes-selected-border': 'rgba(255,200,100,0.65)',
				'--su-notes-highlight-bg': 'rgba(255,200,100,0.08)',
				'--su-user-color': '#6cc8ff',
				'--su-note-color': 'rgba(255,200,100,0.7)',
				'--su-error-color': '#ff5070'
			}
		},
		{
			name: 'Amber',
			preview: '#ffa030',
			vars: {
				'--su-highlight-bg': 'rgba(255,160,48,0.18)',
				'--su-same-bg': 'rgba(255,160,48,0.32)',
				'--su-same-border': 'rgba(255,160,48,0.55)',
				'--su-same-glow': 'rgba(255,160,48,0.6)',
				'--su-selected-bg': 'rgba(255,160,48,0.38)',
				'--su-selected-border': 'rgba(255,175,70,0.9)',
				'--su-notes-selected-bg': 'rgba(100,200,255,0.25)',
				'--su-notes-selected-border': 'rgba(100,200,255,0.65)',
				'--su-notes-highlight-bg': 'rgba(100,200,255,0.08)',
				'--su-user-color': '#ffd060',
				'--su-note-color': 'rgba(100,200,255,0.7)',
				'--su-error-color': '#ff5070'
			}
		},
		{
			name: 'Emerald',
			preview: '#30d888',
			vars: {
				'--su-highlight-bg': 'rgba(48,216,136,0.18)',
				'--su-same-bg': 'rgba(48,216,136,0.3)',
				'--su-same-border': 'rgba(48,216,136,0.5)',
				'--su-same-glow': 'rgba(48,216,136,0.6)',
				'--su-selected-bg': 'rgba(48,216,136,0.36)',
				'--su-selected-border': 'rgba(60,230,150,0.85)',
				'--su-notes-selected-bg': 'rgba(255,180,100,0.25)',
				'--su-notes-selected-border': 'rgba(255,180,100,0.65)',
				'--su-notes-highlight-bg': 'rgba(255,180,100,0.08)',
				'--su-user-color': '#60f0b8',
				'--su-note-color': 'rgba(255,180,100,0.7)',
				'--su-error-color': '#ff5070'
			}
		},
		{
			name: 'Rose',
			preview: '#ff70a0',
			vars: {
				'--su-highlight-bg': 'rgba(255,112,160,0.18)',
				'--su-same-bg': 'rgba(255,112,160,0.3)',
				'--su-same-border': 'rgba(255,112,160,0.5)',
				'--su-same-glow': 'rgba(255,112,160,0.6)',
				'--su-selected-bg': 'rgba(255,112,160,0.36)',
				'--su-selected-border': 'rgba(255,140,180,0.9)',
				'--su-notes-selected-bg': 'rgba(100,230,190,0.25)',
				'--su-notes-selected-border': 'rgba(100,230,190,0.65)',
				'--su-notes-highlight-bg': 'rgba(100,230,190,0.08)',
				'--su-user-color': '#ffc0d8',
				'--su-note-color': 'rgba(100,230,190,0.7)',
				'--su-error-color': '#e03030'
			}
		},
		{
			name: 'Violet',
			preview: '#a060ff',
			vars: {
				'--su-highlight-bg': 'rgba(160,96,255,0.18)',
				'--su-same-bg': 'rgba(160,96,255,0.32)',
				'--su-same-border': 'rgba(160,96,255,0.5)',
				'--su-same-glow': 'rgba(160,96,255,0.6)',
				'--su-selected-bg': 'rgba(160,96,255,0.38)',
				'--su-selected-border': 'rgba(175,120,255,0.88)',
				'--su-notes-selected-bg': 'rgba(255,200,100,0.25)',
				'--su-notes-selected-border': 'rgba(255,200,100,0.65)',
				'--su-notes-highlight-bg': 'rgba(255,200,100,0.08)',
				'--su-user-color': '#c8a8ff',
				'--su-note-color': 'rgba(255,200,100,0.7)',
				'--su-error-color': '#ff5070'
			}
		}
	];

	const SETTINGS_KEY = 'game-hub:sudoku:settings';

	function loadSettings(): { activeScheme: number } | null {
		try {
			const raw = localStorage.getItem(SETTINGS_KEY);
			if (!raw) return null;
			return JSON.parse(raw);
		} catch { return null; }
	}

	const savedSettings = loadSettings();
	let activeScheme = $state(savedSettings?.activeScheme ?? 0);
	let showSettings = $state(false);

	// Build inline style string from active scheme
	const schemeStyle = $derived(
		Object.entries(colorSchemes[activeScheme].vars)
			.map(([k, v]) => `${k}:${v}`)
			.join(';')
	);

	$effect(() => {
		localStorage.setItem(SETTINGS_KEY, JSON.stringify({ activeScheme }));
	});

	const tips = [
		{ text: 'Double-tap an empty cell to switch between Notes and Regular mode.', key: 'tip_doubletap' },
		{ text: 'In Regular mode, tap a number on the bottom row to cycle through cells with that number.', key: 'tip_numcycle' }
	];
	let tipIndex = $state(0);
	let tipVersion = $state(0);

	const isBrowser = typeof window !== 'undefined';

	function getTipCount(key: string): number {
		if (!isBrowser) return 0;
		return parseInt(localStorage.getItem(key) || '0', 10);
	}

	function incrementTip(key: string) {
		if (!isBrowser) return;
		const count = getTipCount(key) + 1;
		localStorage.setItem(key, String(count));
		tipVersion++;
	}

	const visibleTip = $derived.by(() => {
		void tipVersion;
		for (let i = 0; i < tips.length; i++) {
			const idx = (tipIndex + i) % tips.length;
			if (getTipCount(tips[idx].key) < 3) return tips[idx];
		}
		return null;
	});

	const STORAGE_KEY = 'game-hub:sudoku';

	function loadSaved(): { game: GameState; initialGame: GameState; history: GameState[]; elapsed: number } | null {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return null;
			return JSON.parse(raw);
		} catch { return null; }
	}

	const saved = loadSaved();
	let game: GameState = $state(saved?.game ?? newGame('easy'));
	let initialGame: GameState = $state(saved?.initialGame ?? structuredClone($state.snapshot(game)));
	let history: GameState[] = $state(saved?.history ?? []);
	let showPlayMenu = $state(false);
	let pendingAction: (() => void) | null = $state(null);
	let elapsed = $state(saved?.elapsed ?? 0);
	let timerInterval: ReturnType<typeof setInterval> | null = null;
	let pickingDifficulty = $state(false);
	let snackbar = $state('');
	let snackbarTimer: ReturnType<typeof setTimeout> | null = null;
	let snackbarLoading = $state(false);

	function showSnackbar(msg: string) {
		if (snackbarTimer) clearTimeout(snackbarTimer);
		snackbarLoading = false;
		snackbar = msg;
		snackbarTimer = setTimeout(() => { snackbar = ''; }, 3000);
	}

	function showLoadingSnackbar(msg: string) {
		if (snackbarTimer) clearTimeout(snackbarTimer);
		snackbar = msg;
		snackbarLoading = true;
	}

	function hideSnackbar() {
		if (snackbarTimer) clearTimeout(snackbarTimer);
		snackbar = '';
		snackbarLoading = false;
	}

	// Timer
	function startTimer() {
		stopTimer();
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

	$effect(() => {
		const snapshot = {
			game: $state.snapshot(game),
			initialGame: $state.snapshot(initialGame),
			history: $state.snapshot(history),
			elapsed
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
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
		const { selected, notesMode, showErrors } = game;
		game = history[history.length - 1];
		game.selected = selected;
		game.notesMode = notesMode;
		game.showErrors = showErrors;
		history = history.slice(0, -1);
	}

	// Cell interaction
	let lastCellTap: { row: number; col: number; time: number } | null = null;
	const DOUBLE_TAP_MS = 350;

	function onCellClick(row: number, col: number) {
		if (game.won) return;
		const now = Date.now();
		const cell = game.grid[row][col];

		// Double-tap → toggle notes mode (enter on empty cell, exit on any cell)
		if (lastCellTap && lastCellTap.row === row && lastCellTap.col === col &&
			now - lastCellTap.time < DOUBLE_TAP_MS) {
			lastCellTap = null;
			if (game.notesMode) {
				game = toggleNotesMode(game);
				incrementTip('tip_doubletap');
				showSnackbar('Normal mode');
			} else if (cell.value === 0 && !cell.given) {
				game = toggleNotesMode(game);
				incrementTip('tip_doubletap');
				showSnackbar('Notes mode');
			}
			game = selectCell(game, row, col);
			return;
		}

		lastCellTap = { row, col, time: now };
		if (game.notesMode && cell.value !== 0) {
			game = toggleNotesMode(game);
			showSnackbar('Normal mode');
		}
		game = selectCell(game, row, col);
	}

	function selectFirstCellWithNumber(num: number) {
		for (let r = 0; r < 9; r++) {
			for (let c = 0; c < 9; c++) {
				if (game.grid[r][c].value === num) {
					game = selectCell(game, r, c);
					highlightedNumber = num;
					return;
				}
			}
		}
	}

	function onNumberPad(num: number) {
		if (game.won) return;

		// If no cell selected, or selected cell has a value, switch highlight
		if (!game.selected || game.grid[game.selected.row][game.selected.col].value !== 0) {
			selectFirstCellWithNumber(num);
			incrementTip('tip_numcycle');
			return;
		}

		pushHistory();
		const wasNotes = game.notesMode;
		game = handleNumberInput(game, num);
		if (!wasNotes) {
			showSnackbar(`Filled ${num}`);
		}
	}

	const canErase = $derived.by(() => {
		if (game.won || !game.selected) return false;
		const cell = game.grid[game.selected.row][game.selected.col];
		if (cell.given) return false;
		return cell.value !== 0 || cell.notes.length > 0;
	});

	function onErase() {
		if (game.won) return;
		if (!game.selected) {
			showSnackbar('Select a cell first');
			return;
		}
		const cell = game.grid[game.selected.row][game.selected.col];
		if (cell.given) {
			showSnackbar('Cannot erase a given number');
			return;
		}
		if (cell.value === 0 && cell.notes.length === 0) {
			showSnackbar('Nothing to erase');
			return;
		}
		pushHistory();
		game = handleErase(game);
		showSnackbar('Erased');
	}

	let eraseSnackbarDelay: ReturnType<typeof setTimeout> | null = null;

	function onCellLongPressStart(row: number, col: number) {
		if (game.won) return;
		const cell = game.grid[row][col];
		if (cell.given || (cell.value === 0 && cell.notes.length === 0)) return;
		eraseSnackbarDelay = setTimeout(() => {
			showLoadingSnackbar('Erasing…');
			eraseSnackbarDelay = null;
		}, 100);
	}

	function onCellLongPressCancel() {
		if (eraseSnackbarDelay) {
			clearTimeout(eraseSnackbarDelay);
			eraseSnackbarDelay = null;
		}
		if (snackbarLoading) hideSnackbar();
	}

	function onCellLongPress(row: number, col: number) {
		if (game.won) return;
		const cell = game.grid[row][col];
		if (cell.given) return;
		if (cell.value === 0 && cell.notes.length === 0) return;
		game = selectCell(game, row, col);
		pushHistory();
		game = handleErase(game);
		showSnackbar('Erased');
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

	const remainingCounts = $derived.by(() => {
		const counts = new Array(10).fill(0);
		for (let r = 0; r < 9; r++) {
			for (let c = 0; c < 9; c++) {
				const v = game.grid[r][c].value;
				if (v > 0) counts[v]++;
			}
		}
		const remaining: Record<number, number> = {};
		for (let n = 1; n <= 9; n++) {
			remaining[n] = 9 - counts[n];
		}
		return remaining;
	});

	const selectedNotes = $derived.by(() => {
		if (!game.selected) return new Set<number>();
		const cell = game.grid[game.selected.row][game.selected.col];
		if (cell.value !== 0) return new Set<number>();
		return new Set(cell.notes);
	});

	// Track newly solved numbers for animation
	let justSolvedNumber = $state(0);
	let prevCompleted = new Set<number>();

	$effect(() => {
		const current = completedNumbers;
		for (const n of current) {
			if (!prevCompleted.has(n)) {
				justSolvedNumber = n;
				setTimeout(() => { justSolvedNumber = 0; }, 600);
			}
		}
		prevCompleted = new Set(current);
	});

	// New game / Reset / Play menu
	function onNewGame(difficulty: Difficulty) {
		game = newGame(difficulty);
		initialGame = structuredClone($state.snapshot(game));
		history = [];
		showPlayMenu = false;
		pickingDifficulty = false;
		pendingAction = null;
		tipIndex = (tipIndex + 1) % tips.length;
		elapsed = 0;
		startTimer();
	}

	function onReset() {
		game = structuredClone($state.snapshot(initialGame));
		history = [];
		showPlayMenu = false;
		tipIndex = (tipIndex + 1) % tips.length;
		elapsed = 0;
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
			game = toggleNotesMode(game);
			showSnackbar(game.notesMode ? 'Notes mode' : 'Normal mode');
			return;
		}
	}

	// Auto-select a numbered cell for theme preview
	function selectPreviewCell() {
		// If already selecting a numbered cell, keep it
		if (game.selected) {
			const v = game.grid[game.selected.row][game.selected.col].value;
			if (v !== 0) return;
		}
		// Find a non-given user-entered number first, then fall back to any numbered cell
		for (const given of [false, true]) {
			for (let r = 0; r < 9; r++) {
				for (let c = 0; c < 9; c++) {
					const cell = game.grid[r][c];
					if (cell.value !== 0 && cell.given === given) {
						game = selectCell(game, r, c);
						return;
					}
				}
			}
		}
	}

	const difficultyLabel: Record<Difficulty, string> = {
		flash: 'Flash',
		easy: 'Easy',
		medium: 'Medium',
		hard: 'Hard'
	};

	const difficultyColor: Record<Difficulty, string> = {
		flash: '#5be0f7',
		easy: '#2ecc71',
		medium: '#f39c12',
		hard: '#e94560'
	};
</script>

<svelte:window onkeydown={onKeyDown} />

<div class="board" role="application" aria-label="Sudoku Game" style={schemeStyle}>
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

	<div class="snackbar-slot">
		{#if snackbar}
			<div class="snackbar" class:loading={snackbarLoading}>
				{#if snackbarLoading}<span class="snackbar-fill"></span>{/if}
				<span class="snackbar-text">{snackbar}</span>
			</div>
		{/if}
	</div>

	<div class="tip" class:tip-hidden={!visibleTip}>
		{#if visibleTip}&#128161; {visibleTip.text}{/if}
	</div>

	<div class="game-content">
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
							(game.selected.row === r || game.selected.col === c)}
						isSameNumber={highlightedNumber !== 0 &&
							!(game.selected?.row === r && game.selected?.col === c) &&
							cell.value === highlightedNumber}
						hasConflict={game.showErrors && hasConflict(game.grid, r, c)}
						isIncorrect={game.showErrors && isIncorrect(game, r, c)}
						{completedNumbers}
						dimNotes={game.selected !== null && game.grid[game.selected.row][game.selected.col].value !== 0}
						notesMode={game.notesMode}
						justSolved={justSolvedNumber !== 0 && cell.value === justSolvedNumber}
						won={game.won}
						{highlightedNumber}
						onclick={() => onCellClick(r, c)}
						onlongpressstart={() => onCellLongPressStart(r, c)}
						onlongpresscancel={onCellLongPressCancel}
						onlongpress={() => onCellLongPress(r, c)}
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
				class:notes-mode={game.notesMode}
				class:normal-mode={!game.notesMode}
				class:note-active={game.notesMode && selectedNotes.has(num)}
				onclick={() => onNumberPad(num)}
				disabled={game.won}
			>
				{num}
				{#if remainingCounts[num] > 0 && remainingCounts[num] < 5}
					<span class="num-badge">{remainingCounts[num]}</span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Action Bar -->
	<div class="action-bar">
		<button
			class="action-btn"
			class:disabled-look={!canErase}
			onclick={onErase}
			disabled={game.won}
		>
			Erase
		</button>
		<button
			class="action-btn"
			class:notes-active={game.notesMode}
			onclick={() => { game = toggleNotesMode(game); showSnackbar(game.notesMode ? 'Notes mode' : 'Normal mode'); }}
			disabled={game.won || (game.selected !== null && game.grid[game.selected.row][game.selected.col].value !== 0)}
		>
			Notes
		</button>
	</div>


	<!-- Settings popup -->
	{#if showSettings}
		<div class="settings-backdrop" onclick={() => { showSettings = false; }}></div>
		<div class="settings-popup">
			<span class="settings-section-title">Theme</span>
			<div class="scheme-list">
				{#each colorSchemes as scheme, i}
					<button
						class="scheme-option"
						class:active={activeScheme === i}
						onclick={() => { activeScheme = i; }}
					>
						<span class="scheme-swatch" style="background: {scheme.preview}"></span>
						<span class="scheme-name">{scheme.name}</span>
						{#if activeScheme === i}
							<span class="scheme-check">&#10003;</span>
						{/if}
					</button>
				{/each}
			</div>
			<span class="settings-section-title">Options</span>
			<label class="settings-checkbox">
				<span>Show Errors</span>
				<input type="checkbox" checked={game.showErrors} onchange={() => { game = toggleShowErrors(game); }} />
			</label>
			<button class="settings-option" style="border-bottom: none; margin-bottom: 0.75rem;" onclick={() => { tips.forEach(t => { if (isBrowser) localStorage.removeItem(t.key); }); tipVersion++; }}>Reset Tips</button>
			<button class="settings-close-btn" onclick={() => { showSettings = false; }}>Close</button>
		</div>
	{/if}
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
	<button class="btn btn-secondary" onclick={() => { showSettings = !showSettings; if (showSettings) selectPreviewCell(); }}><span class="btn-icon">&#9881;&#65039;</span> Settings</button>
	<button class="btn btn-secondary" onclick={onUndo} disabled={history.length === 0}><span class="btn-icon">&#8634;</span> Undo</button>
	<div class="play-menu-wrapper">
		<button class="btn" onclick={() => { showPlayMenu = !showPlayMenu; pendingAction = null; pickingDifficulty = false; }}><span class="btn-icon">&#9654;&#65039;</span> Play</button>
		{#if showPlayMenu}
			<div class="play-backdrop" onclick={() => { showPlayMenu = false; pendingAction = null; pickingDifficulty = false; }}></div>
			<div class="play-menu">
				{#if pendingAction}
					<span class="confirm-label">Are you sure?</span>
					<div class="confirm-buttons">
						<button class="confirm-btn yes" onclick={onConfirm}>Yes</button>
						<button class="confirm-btn no" onclick={onCancelConfirm}>No</button>
					</div>
				{:else if pickingDifficulty}
					<span class="confirm-label">Select Difficulty</span>
					<button class="menu-item" onclick={() => history.length === 0 ? onNewGame('flash') : confirmAction(() => onNewGame('flash'))}>Flash</button>
					<button class="menu-item" onclick={() => history.length === 0 ? onNewGame('easy') : confirmAction(() => onNewGame('easy'))}>Easy</button>
					<button class="menu-item" onclick={() => history.length === 0 ? onNewGame('medium') : confirmAction(() => onNewGame('medium'))}>Medium</button>
					<button class="menu-item" onclick={() => history.length === 0 ? onNewGame('hard') : confirmAction(() => onNewGame('hard'))}>Hard</button>
					<button class="menu-item back-item" onclick={() => { pickingDifficulty = false; }}>Back</button>
				{:else}
					<button class="menu-item" onclick={() => { pickingDifficulty = true; }}><span class="menu-icon">&#9654;</span> New Game</button>
					<button class="menu-item" onclick={() => history.length === 0 ? onReset() : confirmAction(onReset)}><span class="menu-icon">&#8634;</span> Reset</button>
					<button class="menu-item" onclick={() => confirmAction(() => { window.location.href = base || '/'; })}><span class="menu-icon">&#10005;</span> Quit</button>
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
		--note-font-size: 0.6rem;

		position: relative;
		max-width: 440px;
		margin: 0 auto;
		padding: 0;
		padding-bottom: 4rem;
		height: 100dvh;
		display: flex;
		flex-direction: column;
		user-select: none;
		-webkit-user-select: none;
		overflow: hidden;
	}

	.game-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
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
		font-size: 1.45rem;
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

	.tip {
		font-size: 1.1rem;
		color: var(--text-muted);
		margin-bottom: 0.5rem;
		min-height: 4.2rem;
		line-height: 1.4;
		text-align: center;
	}

	.tip.tip-hidden {
		visibility: hidden;
	}

	.grid-wrapper {
		display: flex;
		justify-content: center;
		margin-bottom: 1rem;
		width: 100%;
	}

	.grid {
		display: grid;
		width: 100%;
		grid-template-columns: repeat(9, 1fr);
		grid-template-rows: repeat(9, auto);
		aspect-ratio: 1;
		border: 2px solid rgba(255, 255, 255, 0.7);
	}

	.number-pad {
		display: flex;
		justify-content: center;
		gap: 0.35rem;
		margin-bottom: 1.25rem;
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

	.num-btn {
		position: relative;
	}

	.num-badge {
		position: absolute;
		bottom: -3px;
		right: -3px;
		min-width: 14px;
		height: 14px;
		border-radius: 999px;
		background: #888;
		color: #1a1a2e;
		font-size: 0.55rem;
		font-weight: 800;
		line-height: 14px;
		text-align: center;
		padding: 0 2px;
	}

	.num-btn.dim {
		opacity: 0.15;
	}

	.num-btn.normal-mode {
		background: var(--su-selected-bg);
		color: var(--su-selected-border);
		border: 1px solid var(--su-selected-border);
	}

	.num-btn.notes-mode {
		background: var(--su-notes-selected-bg);
		color: var(--su-notes-selected-border);
		border: 1px solid var(--su-notes-selected-border);
	}

	.num-btn.note-active {
		background: var(--su-note-color);
		color: var(--bg-primary);
		border-color: var(--su-note-color);
		transition: none;
	}

	.action-bar {
		display: flex;
		justify-content: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.action-btn {
		padding: 0.6rem 1.5rem;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 8px;
		background: transparent;
		color: var(--text-secondary);
		font-size: 1.05rem;
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

	.action-btn.disabled-look {
		opacity: 0.4;
	}

	.snackbar-slot {
		height: 0;
		display: flex;
		justify-content: center;
		position: relative;
		z-index: 200;
	}

	.snackbar {
		position: absolute;
		top: 0;
		padding: 0.45rem 1.25rem;
		background: rgba(255, 255, 255, 0.95);
		color: #111;
		font-size: 0.9rem;
		font-weight: 700;
		border-radius: 999px;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
		white-space: nowrap;
		animation: snackbar-in 0.2s ease-out;
		overflow: hidden;
		min-width: 6.5rem;
		text-align: center;
	}

	.snackbar.loading {
		background: rgba(255, 255, 255, 0.25);
		color: #fff;
	}

	.snackbar-text {
		position: relative;
		z-index: 1;
	}

	.snackbar-fill {
		position: absolute;
		top: 0;
		left: 0;
		bottom: 0;
		width: 0;
		background: rgba(255, 255, 255, 0.95);
		border-radius: 999px;
		animation: snackbar-load 500ms linear forwards;
	}

	.snackbar.loading .snackbar-text {
		mix-blend-mode: difference;
	}

	@keyframes snackbar-load {
		from { width: 0; }
		to { width: 100%; }
	}

	@keyframes snackbar-in {
		from { opacity: 0; transform: scale(0.9); }
		to { opacity: 1; transform: scale(1); }
	}

	.action-btn.notes-active {
		background: var(--su-notes-selected-bg);
		color: var(--su-notes-selected-border);
		border-color: var(--su-notes-selected-border);
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
		border: 1.5px solid rgba(255, 255, 255, 0.7);
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
		color: var(--text-primary);
		text-align: center;
		border-top: 1px solid rgba(255, 255, 255, 0.5);
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
		background: var(--bg-card);
		padding: 3rem;
		border-radius: var(--radius);
		text-align: center;
		box-shadow: var(--shadow);
		border: 1.5px solid rgba(255, 255, 255, 0.7);
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

	.play-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 50;
	}

	.settings-backdrop {
		position: fixed;
		inset: 0;
		z-index: 50;
	}

	.settings-popup {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: var(--bg-secondary);
		border-radius: 12px 12px 0 0;
		box-shadow: 0 -4px 40px rgba(0, 0, 0, 0.6);
		border-top: 1.5px solid rgba(255, 255, 255, 0.7);
		padding: 1.25rem;
		padding-bottom: 0;
		z-index: 60;
	}

	.settings-section-title {
		display: block;
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.5rem;
		margin-top: 0.75rem;
	}

	.settings-section-title:first-child {
		margin-top: 0;
	}

	.settings-option {
		display: block;
		width: 100%;
		padding: 0.6rem 0.65rem;
		border: none;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		background: none;
		color: var(--text-primary);
		font-size: 1.05rem;
		font-weight: 600;
		text-align: left;
		cursor: pointer;
		transition: background 0.15s;
	}

	.settings-option:hover {
		background: rgba(255, 255, 255, 0.06);
	}

	.settings-checkbox {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.6rem 0.65rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		cursor:
		font-size: 1.05rem;
		font-weight: 600;
		color: var(--text-primary);
		transition: background 0.15s;
	}

	.settings-checkbox:hover {
		background: rgba(255, 255, 255, 0.06);
	}

	.settings-checkbox input[type="checkbox"] {
		width: 24px;
		height: 24px;
		accent-color: #4a9eff;
		cursor: pointer;
	}

	.settings-close-btn {
		display: block;
		width: 100%;
		margin-top: 0.75rem;
		margin-bottom: calc(0.75rem + 10px);
		padding: 0.7rem;
		border: none;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.08);
		color: var(--text-secondary);
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s;
	}

	.settings-close-btn:hover {
		background: rgba(255, 255, 255, 0.14);
		color: var(--text-primary);
	}

	.scheme-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.scheme-option {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.55rem 0.65rem;
		border: 1px solid transparent;
		border-radius: 8px;
		background: none;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s;
		width: 100%;
		text-align: left;
	}

	.scheme-option:hover {
		background: rgba(255, 255, 255, 0.06);
	}

	.scheme-option.active {
		background: rgba(255, 255, 255, 0.08);
		border-color: rgba(255, 255, 255, 0.15);
	}

	.scheme-swatch {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.scheme-name {
		font-size: 1.05rem;
		font-weight: 600;
		color: var(--text-primary);
		flex: 1;
	}

	.scheme-check {
		color: var(--text-secondary);
		font-size: 0.85rem;
	}

	@media (max-width: 600px) {
		.board {
			--cell-size: calc(100vw / 9);
			--cell-font-size: calc(var(--cell-size) * 0.55);
			--note-font-size: calc(var(--cell-size) * 0.24);
			max-width: 100%;
			padding: 0;
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
			font-size: 1.15rem;
		}
	}
</style>
