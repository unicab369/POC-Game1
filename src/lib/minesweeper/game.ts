export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Cell {
	revealed: boolean;
	flagged: boolean;
	isMine: boolean;
	adjacentMines: number;
	exploded?: boolean;
}

export interface GameState {
	grid: Cell[][];
	rows: number;
	cols: number;
	mines: number;
	flagsUsed: number;
	won: boolean;
	lost: boolean;
	moves: number;
	difficulty: Difficulty;
	started: boolean;
}

const CONFIG: Record<Difficulty, { rows: number; cols: number; mines: number }> = {
	easy: { rows: 9, cols: 9, mines: 10 },
	medium: { rows: 16, cols: 16, mines: 40 },
	hard: { rows: 30, cols: 16, mines: 99 }
};

function createEmptyGrid(rows: number, cols: number): Cell[][] {
	return Array.from({ length: rows }, () =>
		Array.from({ length: cols }, () => ({
			revealed: false,
			flagged: false,
			isMine: false,
			adjacentMines: 0
		}))
	);
}

function getNeighbors(rows: number, cols: number, row: number, col: number): [number, number][] {
	const neighbors: [number, number][] = [];
	for (let dr = -1; dr <= 1; dr++) {
		for (let dc = -1; dc <= 1; dc++) {
			if (dr === 0 && dc === 0) continue;
			const nr = row + dr;
			const nc = col + dc;
			if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
				neighbors.push([nr, nc]);
			}
		}
	}
	return neighbors;
}

export function newGame(difficulty: Difficulty = 'easy'): GameState {
	const { rows, cols, mines } = CONFIG[difficulty];
	return {
		grid: createEmptyGrid(rows, cols),
		rows,
		cols,
		mines,
		flagsUsed: 0,
		won: false,
		lost: false,
		moves: 0,
		difficulty,
		started: false
	};
}

export function placeMines(state: GameState, safeRow: number, safeCol: number): GameState {
	const newState: GameState = JSON.parse(JSON.stringify(state));
	const { rows, cols, mines } = newState;

	// Build set of safe positions (clicked cell + neighbors)
	const safeSet = new Set<string>();
	safeSet.add(`${safeRow},${safeCol}`);
	for (const [nr, nc] of getNeighbors(rows, cols, safeRow, safeCol)) {
		safeSet.add(`${nr},${nc}`);
	}

	// Collect all candidate positions
	const candidates: [number, number][] = [];
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			if (!safeSet.has(`${r},${c}`)) {
				candidates.push([r, c]);
			}
		}
	}

	// Shuffle and pick first N
	for (let i = candidates.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[candidates[i], candidates[j]] = [candidates[j], candidates[i]];
	}

	for (let i = 0; i < mines; i++) {
		const [r, c] = candidates[i];
		newState.grid[r][c].isMine = true;
	}

	// Calculate adjacent mines
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			if (newState.grid[r][c].isMine) continue;
			let count = 0;
			for (const [nr, nc] of getNeighbors(rows, cols, r, c)) {
				if (newState.grid[nr][nc].isMine) count++;
			}
			newState.grid[r][c].adjacentMines = count;
		}
	}

	newState.started = true;
	return newState;
}

export function revealCell(state: GameState, row: number, col: number): GameState {
	if (state.won || state.lost) return state;

	let newState: GameState = JSON.parse(JSON.stringify(state));
	const cell = newState.grid[row][col];

	if (cell.revealed || cell.flagged) return state;

	// First click: place mines
	if (!newState.started) {
		newState = placeMines(newState, row, col);
	}

	const target = newState.grid[row][col];

	if (target.isMine) {
		target.revealed = true;
		target.exploded = true;
		newState.lost = true;
		newState.moves++;
		newState = revealAllMines(newState);
		return newState;
	}

	// Flood-fill reveal
	floodReveal(newState, row, col);
	newState.moves++;

	if (checkWin(newState)) {
		newState.won = true;
	}

	return newState;
}

function floodReveal(state: GameState, row: number, col: number): void {
	const stack: [number, number][] = [[row, col]];

	while (stack.length > 0) {
		const [r, c] = stack.pop()!;
		const cell = state.grid[r][c];

		if (cell.revealed || cell.flagged || cell.isMine) continue;

		cell.revealed = true;

		if (cell.adjacentMines === 0) {
			for (const [nr, nc] of getNeighbors(state.rows, state.cols, r, c)) {
				if (!state.grid[nr][nc].revealed) {
					stack.push([nr, nc]);
				}
			}
		}
	}
}

export function toggleFlag(state: GameState, row: number, col: number): GameState {
	if (state.won || state.lost) return state;

	const cell = state.grid[row][col];
	if (cell.revealed) return state;

	const newState: GameState = JSON.parse(JSON.stringify(state));
	const target = newState.grid[row][col];
	target.flagged = !target.flagged;
	newState.flagsUsed += target.flagged ? 1 : -1;
	newState.moves++;

	return newState;
}

export function checkWin(state: GameState): boolean {
	for (let r = 0; r < state.rows; r++) {
		for (let c = 0; c < state.cols; c++) {
			const cell = state.grid[r][c];
			if (!cell.isMine && !cell.revealed) return false;
		}
	}
	return true;
}

export function revealAllMines(state: GameState): GameState {
	for (let r = 0; r < state.rows; r++) {
		for (let c = 0; c < state.cols; c++) {
			const cell = state.grid[r][c];
			if (cell.isMine && !cell.revealed) {
				cell.revealed = true;
			}
		}
	}
	return state;
}
