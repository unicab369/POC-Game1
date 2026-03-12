import { type Card, type Suit, createSingleSuitDeck, shuffle } from '$lib/cards';

export type { Card, Suit };

export interface SpiderCard extends Card {
	faceUp: boolean;
}

export interface GameState {
	tableau: SpiderCard[][]; // 10 columns
	stock: SpiderCard[];
	completedSuits: number; // win at 8
	selected: Selection | null;
	won: boolean;
	moves: number;
}

export interface Selection {
	source: 'tableau';
	index: number;
	cardCount: number;
}

export function newGame(): GameState {
	const deck = shuffle(createSingleSuitDeck('spades', 8)).map((c) => ({
		...c,
		faceUp: false
	}));

	const tableau: SpiderCard[][] = Array.from({ length: 10 }, () => []);

	let cardIdx = 0;
	for (let col = 0; col < 10; col++) {
		const count = col < 4 ? 6 : 5;
		for (let row = 0; row < count; row++) {
			const card = deck[cardIdx++];
			card.faceUp = row === count - 1; // only top card face-up
			tableau[col].push(card);
		}
	}

	const stock = deck.slice(cardIdx); // remaining 50 cards

	return {
		tableau,
		stock,
		completedSuits: 0,
		selected: null,
		won: false,
		moves: 0
	};
}

export function dealFromStock(state: GameState, skipRunCheck = false): GameState {
	const newState: GameState = JSON.parse(JSON.stringify(state));
	newState.selected = null;

	if (newState.stock.length === 0) return newState;

	// Blocked if any column is empty
	if (newState.tableau.some((col) => col.length === 0)) return newState;

	newState.moves++;

	// Deal 1 card face-up to each of 10 columns
	for (let col = 0; col < 10; col++) {
		const card = newState.stock.pop()!;
		card.faceUp = true;
		newState.tableau[col].push(card);
	}

	if (!skipRunCheck) {
		checkAndRemoveCompletedRuns(newState);
	}
	return newState;
}

export function validDescendingRun(cards: SpiderCard[]): boolean {
	if (cards.length === 0) return false;
	if (!cards[0].faceUp) return false;
	for (let i = 1; i < cards.length; i++) {
		if (!cards[i].faceUp) return false;
		if (cards[i].rank !== cards[i - 1].rank - 1) return false;
		if (cards[i].suit !== cards[i - 1].suit) return false;
	}
	return true;
}

export function canPlaceOnTableau(card: SpiderCard, column: SpiderCard[]): boolean {
	if (column.length === 0) return true; // any card on empty
	const top = column[column.length - 1];
	return card.rank === top.rank - 1; // descending, any suit
}

function flipTopCards(state: GameState): void {
	for (const col of state.tableau) {
		if (col.length > 0 && !col[col.length - 1].faceUp) {
			col[col.length - 1].faceUp = true;
		}
	}
}

function checkAndRemoveCompletedRuns(state: GameState): void {
	for (let col = 0; col < 10; col++) {
		const pile = state.tableau[col];
		if (pile.length < 13) continue;

		// Check if the bottom 13 cards form a complete K→A same-suit run
		const runStart = pile.length - 13;
		const run = pile.slice(runStart);

		if (
			run[0].rank === 13 &&
			run[12].rank === 1 &&
			run.every((c) => c.faceUp && c.suit === run[0].suit) &&
			validDescendingRun(run)
		) {
			pile.splice(runStart);
			state.completedSuits++;
			flipTopCards(state);

			if (state.completedSuits === 8) {
				state.won = true;
			}
		}
	}
}

export function handleClick(
	state: GameState,
	target: 'tableau',
	index: number,
	cardIndex?: number
): GameState {
	const newState: GameState = JSON.parse(JSON.stringify(state));

	if (newState.won) return newState;

	if (newState.selected) {
		const result = attemptMove(newState, index);
		newState.selected = null;
		if (result) {
			newState.moves++;
			flipTopCards(newState);
			checkAndRemoveCompletedRuns(newState);
		}
		return newState;
	}

	// Select a card
	const col = newState.tableau[index];
	if (col.length === 0) return newState;

	if (cardIndex === undefined) cardIndex = col.length - 1;

	const card = col[cardIndex];
	if (!card.faceUp) return newState;

	const count = col.length - cardIndex;
	const cards = col.slice(cardIndex);

	if (validDescendingRun(cards)) {
		newState.selected = { source: 'tableau', index, cardCount: count };
	}

	return newState;
}

function attemptMove(state: GameState, destIndex: number): boolean {
	const sel = state.selected!;
	const col = state.tableau[sel.index];
	const cards = col.slice(col.length - sel.cardCount);
	const topCard = cards[0];
	const destCol = state.tableau[destIndex];

	if (sel.index === destIndex) return false;

	if (!canPlaceOnTableau(topCard, destCol)) return false;

	state.tableau[sel.index].splice(state.tableau[sel.index].length - sel.cardCount);
	destCol.push(...cards);
	return true;
}

/** Execute a move from source to destination column for drag-and-drop. */
export function executeMove(
	state: GameState,
	sourceIndex: number,
	sourceCardIndex: number,
	destIndex: number,
	skipRunCheck = false
): GameState | null {
	const newState: GameState = JSON.parse(JSON.stringify(state));
	if (newState.won) return null;
	if (sourceIndex === destIndex) return null;

	const col = newState.tableau[sourceIndex];
	if (col.length === 0) return null;

	const cards = col.slice(sourceCardIndex);
	if (!validDescendingRun(cards)) return null;

	const topCard = cards[0];
	const destCol = newState.tableau[destIndex];
	if (!canPlaceOnTableau(topCard, destCol)) return null;

	col.splice(sourceCardIndex);
	destCol.push(...cards);
	newState.moves++;
	newState.selected = null;
	flipTopCards(newState);
	if (!skipRunCheck) {
		checkAndRemoveCompletedRuns(newState);
	}
	return newState;
}

export function findCompletedRun(
	state: GameState
): { colIndex: number; runStart: number; cards: SpiderCard[] } | null {
	for (let col = 0; col < 10; col++) {
		const pile = state.tableau[col];
		if (pile.length < 13) continue;
		const runStart = pile.length - 13;
		const run = pile.slice(runStart);
		if (
			run[0].rank === 13 &&
			run[12].rank === 1 &&
			run.every((c) => c.faceUp && c.suit === run[0].suit) &&
			validDescendingRun(run)
		) {
			return { colIndex: col, runStart, cards: run };
		}
	}
	return null;
}

export function applyCompletedRunRemoval(state: GameState): GameState {
	const newState: GameState = JSON.parse(JSON.stringify(state));
	checkAndRemoveCompletedRuns(newState);
	return newState;
}

/** Auto-move a card run to the best available column.
 *  Priority: same-suit non-empty > any non-empty > empty column. */
export function autoMoveFrom(
	state: GameState,
	sourceIndex: number,
	sourceCardIndex: number
): GameState | null {
	const col = state.tableau[sourceIndex];
	if (col.length === 0) return null;

	const cards = col.slice(sourceCardIndex);
	if (!validDescendingRun(cards)) return null;

	const topCard = cards[0];

	// 1. Try non-empty columns with same-suit match (best move)
	for (let i = 0; i < 10; i++) {
		if (i === sourceIndex) continue;
		const dest = state.tableau[i];
		if (dest.length === 0) continue;
		const destTop = dest[dest.length - 1];
		if (topCard.rank === destTop.rank - 1 && topCard.suit === destTop.suit) {
			return executeMove(state, sourceIndex, sourceCardIndex, i);
		}
	}

	// 2. Try non-empty columns with any rank match
	for (let i = 0; i < 10; i++) {
		if (i === sourceIndex) continue;
		const dest = state.tableau[i];
		if (dest.length === 0) continue;
		if (canPlaceOnTableau(topCard, dest)) {
			return executeMove(state, sourceIndex, sourceCardIndex, i);
		}
	}

	// 3. Try empty columns
	for (let i = 0; i < 10; i++) {
		if (i === sourceIndex) continue;
		if (state.tableau[i].length === 0) {
			return executeMove(state, sourceIndex, sourceCardIndex, i);
		}
	}

	return null;
}

export function clearSelection(state: GameState): GameState {
	return { ...state, selected: null };
}
