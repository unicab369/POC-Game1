export type Difficulty = 'flash' | 'easy' | 'medium' | 'hard';

export interface Cell {
	value: number; // 0 = empty
	given: boolean;
	notes: number[];
}

export interface GameState {
	grid: Cell[][];
	solution: number[][];
	selected: { row: number; col: number } | null;
	won: boolean;
	moves: number;
	notesMode: boolean;
	showErrors: boolean;
	difficulty: Difficulty;
}

const GIVENS: Record<Difficulty, number> = { flash: 45, easy: 38, medium: 30, hard: 25 };

// --- Internal puzzle generation ---

function shuffleArray<T>(arr: T[]): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

function isValidPlacement(grid: number[][], row: number, col: number, num: number): boolean {
	for (let c = 0; c < 9; c++) {
		if (grid[row][c] === num) return false;
	}
	for (let r = 0; r < 9; r++) {
		if (grid[r][col] === num) return false;
	}
	const br = Math.floor(row / 3) * 3;
	const bc = Math.floor(col / 3) * 3;
	for (let r = br; r < br + 3; r++) {
		for (let c = bc; c < bc + 3; c++) {
			if (grid[r][c] === num) return false;
		}
	}
	return true;
}

function fillGrid(grid: number[][]): boolean {
	for (let r = 0; r < 9; r++) {
		for (let c = 0; c < 9; c++) {
			if (grid[r][c] === 0) {
				const digits = shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);
				for (const d of digits) {
					if (isValidPlacement(grid, r, c, d)) {
						grid[r][c] = d;
						if (fillGrid(grid)) return true;
						grid[r][c] = 0;
					}
				}
				return false;
			}
		}
	}
	return true;
}

function countSolutions(grid: number[][], limit: number = 2): number {
	let count = 0;

	function solve(): boolean {
		for (let r = 0; r < 9; r++) {
			for (let c = 0; c < 9; c++) {
				if (grid[r][c] === 0) {
					for (let d = 1; d <= 9; d++) {
						if (isValidPlacement(grid, r, c, d)) {
							grid[r][c] = d;
							if (solve()) return true;
							grid[r][c] = 0;
						}
					}
					return false;
				}
			}
		}
		count++;
		return count >= limit;
	}

	solve();
	return count;
}

function generatePuzzle(solution: number[][], difficulty: Difficulty): number[][] {
	const puzzle = solution.map((row) => [...row]);
	const target = 81 - GIVENS[difficulty];

	// Create shuffled list of all cell positions
	const positions: [number, number][] = [];
	for (let r = 0; r < 9; r++) {
		for (let c = 0; c < 9; c++) {
			positions.push([r, c]);
		}
	}
	const shuffled = shuffleArray(positions);

	let removed = 0;
	for (const [r, c] of shuffled) {
		if (removed >= target) break;
		const backup = puzzle[r][c];
		puzzle[r][c] = 0;

		const copy = puzzle.map((row) => [...row]);
		if (countSolutions(copy, 2) !== 1) {
			puzzle[r][c] = backup;
		} else {
			removed++;
		}
	}

	return puzzle;
}

// --- Exported functions ---

export function newGame(difficulty: Difficulty = 'easy'): GameState {
	const solution = Array.from({ length: 9 }, () => Array(9).fill(0));
	fillGrid(solution);

	const puzzle = generatePuzzle(solution, difficulty);

	const grid: Cell[][] = puzzle.map((row) =>
		row.map((val) => ({
			value: val,
			given: val !== 0,
			notes: []
		}))
	);

	return {
		grid,
		solution,
		selected: null,
		won: false,
		moves: 0,
		notesMode: false,
		showErrors: false,
		difficulty
	};
}

export function selectCell(state: GameState, row: number, col: number): GameState {
	return { ...state, selected: { row, col } };
}

export function clearSelection(state: GameState): GameState {
	return { ...state, selected: null };
}

export function setCellValue(state: GameState, row: number, col: number, num: number): GameState {
	const newState: GameState = JSON.parse(JSON.stringify(state));
	const cell = newState.grid[row][col];
	if (cell.given) return state;
	cell.value = num;
	cell.notes = [];
	// Clear notes with this number from same row, column, and box
	for (let c = 0; c < 9; c++) {
		if (c !== col) {
			const n = newState.grid[row][c].notes;
			const idx = n.indexOf(num);
			if (idx !== -1) n.splice(idx, 1);
		}
	}
	for (let r = 0; r < 9; r++) {
		if (r !== row) {
			const n = newState.grid[r][col].notes;
			const idx = n.indexOf(num);
			if (idx !== -1) n.splice(idx, 1);
		}
	}
	const br = Math.floor(row / 3) * 3;
	const bc = Math.floor(col / 3) * 3;
	for (let r = br; r < br + 3; r++) {
		for (let c = bc; c < bc + 3; c++) {
			if (r !== row || c !== col) {
				const n = newState.grid[r][c].notes;
				const idx = n.indexOf(num);
				if (idx !== -1) n.splice(idx, 1);
			}
		}
	}
	newState.moves++;
	if (checkWin(newState)) newState.won = true;
	return newState;
}

export function toggleNote(state: GameState, row: number, col: number, num: number): GameState {
	const newState: GameState = JSON.parse(JSON.stringify(state));
	const cell = newState.grid[row][col];
	if (cell.given || cell.value !== 0) return state;
	const idx = cell.notes.indexOf(num);
	if (idx === -1) {
		cell.notes.push(num);
	} else {
		cell.notes.splice(idx, 1);
	}
	newState.moves++;
	return newState;
}

export function clearCell(state: GameState, row: number, col: number): GameState {
	const newState: GameState = JSON.parse(JSON.stringify(state));
	const cell = newState.grid[row][col];
	if (cell.given) return state;
	if (cell.value === 0 && cell.notes.length === 0) return state;
	cell.value = 0;
	cell.notes = [];
	newState.moves++;
	return newState;
}

export function handleNumberInput(state: GameState, num: number): GameState {
	if (!state.selected) return state;
	const { row, col } = state.selected;
	if (state.grid[row][col].given) return state;

	if (state.notesMode) {
		return toggleNote(state, row, col, num);
	} else {
		return setCellValue(state, row, col, num);
	}
}

export function handleErase(state: GameState): GameState {
	if (!state.selected) return state;
	const { row, col } = state.selected;
	return clearCell(state, row, col);
}

export function toggleNotesMode(state: GameState): GameState {
	return { ...state, notesMode: !state.notesMode };
}

export function toggleShowErrors(state: GameState): GameState {
	return { ...state, showErrors: !state.showErrors };
}

export function hasConflict(grid: Cell[][], row: number, col: number): boolean {
	const val = grid[row][col].value;
	if (val === 0) return false;

	// Check row
	for (let c = 0; c < 9; c++) {
		if (c !== col && grid[row][c].value === val) return true;
	}
	// Check col
	for (let r = 0; r < 9; r++) {
		if (r !== row && grid[r][col].value === val) return true;
	}
	// Check box
	const br = Math.floor(row / 3) * 3;
	const bc = Math.floor(col / 3) * 3;
	for (let r = br; r < br + 3; r++) {
		for (let c = bc; c < bc + 3; c++) {
			if ((r !== row || c !== col) && grid[r][c].value === val) return true;
		}
	}
	return false;
}

export function isIncorrect(state: GameState, row: number, col: number): boolean {
	const cell = state.grid[row][col];
	if (cell.value === 0 || cell.given) return false;
	return cell.value !== state.solution[row][col];
}

export function checkWin(state: GameState): boolean {
	for (let r = 0; r < 9; r++) {
		for (let c = 0; c < 9; c++) {
			if (state.grid[r][c].value !== state.solution[r][c]) return false;
		}
	}
	return true;
}
