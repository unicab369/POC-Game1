import { type Card, type Suit, cardColor, createDeck, shuffle } from '$lib/cards';

export type { Card, Suit };

export interface GameState {
	tableau: Card[][];    // 8 columns
	freeCells: (Card | null)[];  // 4 slots
	foundations: Card[][]; // 4 piles (one per suit)
	selected: Selection | null;
	won: boolean;
	moves: number;
}

export interface Selection {
	source: 'tableau' | 'freecell';
	index: number;       // column or freecell index
	cardCount: number;   // number of cards selected (from bottom of selection)
}

export function newGame(): GameState {
	const deck = shuffle(createDeck());
	const tableau: Card[][] = Array.from({ length: 8 }, () => []);

	for (let i = 0; i < 52; i++) {
		tableau[i % 8].push(deck[i]);
	}

	const state: GameState = {
		tableau,
		freeCells: [null, null, null, null],
		foundations: [[], [], [], []],
		selected: null,
		won: false,
		moves: 0
	};

	autoFoundation(state);
	return state;
}

function foundationIndex(state: GameState, suit: Suit): number {
	const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
	// Find existing foundation for suit, or first empty one
	for (let i = 0; i < 4; i++) {
		const pile = state.foundations[i];
		if (pile.length > 0 && pile[0].suit === suit) return i;
	}
	for (let i = 0; i < 4; i++) {
		if (state.foundations[i].length === 0) return i;
	}
	return -1;
}

function canAutoFoundation(state: GameState, card: Card): boolean {
	const fi = foundationIndex(state, card.suit);
	if (fi === -1) return false;
	const pile = state.foundations[fi];
	const needed = pile.length === 0 ? 1 : pile[pile.length - 1].rank + 1;
	if (card.rank !== needed) return false;

	// Only auto-move if it's safe: both opposite-color foundations have rank >= card.rank - 1
	// This prevents auto-moving cards that are still needed for tableau building
	if (card.rank <= 2) return true;

	const oppositeColor = cardColor(card.suit) === 'red' ? 'black' : 'red';
	let minOpposite = 14;
	for (const f of state.foundations) {
		if (f.length > 0 && cardColor(f[0].suit) === oppositeColor) {
			minOpposite = Math.min(minOpposite, f[f.length - 1].rank);
		} else if (f.length === 0) {
			// Check if any unassigned foundation could be opposite color
		}
	}
	// Count how many opposite-color suits have foundations started
	let oppositeStarted = 0;
	for (const f of state.foundations) {
		if (f.length > 0 && cardColor(f[0].suit) === oppositeColor) {
			oppositeStarted++;
		}
	}
	if (oppositeStarted < 2) minOpposite = 0;

	return card.rank <= minOpposite + 1;
}

function autoFoundation(state: GameState): void {
	let moved = true;
	while (moved) {
		moved = false;

		// Check tableau tops
		for (let col = 0; col < 8; col++) {
			const pile = state.tableau[col];
			if (pile.length === 0) continue;
			const card = pile[pile.length - 1];
			if (canAutoFoundation(state, card)) {
				const fi = foundationIndex(state, card.suit);
				state.foundations[fi].push(pile.pop()!);
				moved = true;
			}
		}

		// Check free cells
		for (let i = 0; i < 4; i++) {
			const card = state.freeCells[i];
			if (!card) continue;
			if (canAutoFoundation(state, card)) {
				const fi = foundationIndex(state, card.suit);
				state.foundations[fi].push(card);
				state.freeCells[i] = null;
				moved = true;
			}
		}
	}

	// Check win
	const totalOnFoundations = state.foundations.reduce((sum, f) => sum + f.length, 0);
	if (totalOnFoundations === 52) {
		state.won = true;
	}
}

function emptyFreeCellCount(state: GameState): number {
	return state.freeCells.filter((c) => c === null).length;
}

function emptyTableauCount(state: GameState): number {
	return state.tableau.filter((col) => col.length === 0).length;
}

/** Max cards that can be moved as a group (supermove) */
function maxMovable(state: GameState, destIsEmpty: boolean): number {
	const freeCells = emptyFreeCellCount(state);
	const emptyCols = emptyTableauCount(state) - (destIsEmpty ? 1 : 0);
	return (1 + freeCells) * Math.pow(2, emptyCols);
}

/** Check if a sequence of cards at the bottom of a column is a valid descending alternating-color run */
function validRun(cards: Card[]): boolean {
	for (let i = 1; i < cards.length; i++) {
		if (cards[i].rank !== cards[i - 1].rank - 1) return false;
		if (cardColor(cards[i].suit) === cardColor(cards[i - 1].suit)) return false;
	}
	return true;
}

function canPlaceOnTableau(card: Card, column: Card[]): boolean {
	if (column.length === 0) return true;
	const top = column[column.length - 1];
	return card.rank === top.rank - 1 && cardColor(card.suit) !== cardColor(top.suit);
}

function canPlaceOnFoundation(card: Card, state: GameState): number {
	// Returns foundation index or -1
	for (let i = 0; i < 4; i++) {
		const pile = state.foundations[i];
		if (pile.length === 0) {
			if (card.rank === 1) {
				// Check no other foundation has this suit
				const suitUsed = state.foundations.some(
					(f) => f.length > 0 && f[0].suit === card.suit
				);
				if (!suitUsed) return i;
			}
		} else {
			if (pile[0].suit === card.suit && pile[pile.length - 1].rank === card.rank - 1) {
				return i;
			}
		}
	}
	return -1;
}

export function handleClick(
	state: GameState,
	target: 'tableau' | 'freecell' | 'foundation',
	index: number,
	cardIndex?: number // position within tableau column
): GameState {
	const newState = structuredClone(state);

	if (newState.won) return newState;

	if (newState.selected) {
		// Attempt to place
		const result = attemptMove(newState, target, index);
		newState.selected = null;
		if (result) {
			newState.moves++;
			autoFoundation(newState);
		}
		return newState;
	}

	// Select a card
	if (target === 'tableau') {
		const col = newState.tableau[index];
		if (col.length === 0) return newState;

		if (cardIndex === undefined) cardIndex = col.length - 1;

		const count = col.length - cardIndex;
		const cards = col.slice(cardIndex);

		if (count === 1 || (validRun(cards) && count <= maxMovable(newState, false))) {
			newState.selected = { source: 'tableau', index, cardCount: count };
		}
	} else if (target === 'freecell') {
		if (newState.freeCells[index]) {
			newState.selected = { source: 'freecell', index, cardCount: 1 };
		}
	} else if (target === 'foundation') {
		// Can't select from foundations
	}

	return newState;
}

function attemptMove(state: GameState, target: string, index: number): boolean {
	const sel = state.selected!;
	let cards: Card[];

	if (sel.source === 'tableau') {
		const col = state.tableau[sel.index];
		cards = col.slice(col.length - sel.cardCount);
	} else {
		cards = [state.freeCells[sel.index]!];
	}

	const topCard = cards[0];

	if (target === 'tableau') {
		const destCol = state.tableau[index];

		// Can't move to the same column
		if (sel.source === 'tableau' && sel.index === index) return false;

		// Check supermove limit
		const limit = maxMovable(state, destCol.length === 0);
		if (cards.length > limit) return false;

		if (!canPlaceOnTableau(topCard, destCol)) return false;

		// Execute move
		if (sel.source === 'tableau') {
			state.tableau[sel.index].splice(state.tableau[sel.index].length - sel.cardCount);
		} else {
			state.freeCells[sel.index] = null;
		}
		destCol.push(...cards);
		return true;
	}

	if (target === 'freecell') {
		if (cards.length > 1) return false;
		if (state.freeCells[index] !== null) return false;

		if (sel.source === 'tableau') {
			state.tableau[sel.index].pop();
		} else {
			state.freeCells[sel.index] = null;
		}
		state.freeCells[index] = topCard;
		return true;
	}

	if (target === 'foundation') {
		if (cards.length > 1) return false;
		const fi = canPlaceOnFoundation(topCard, state);
		if (fi === -1) return false;

		if (sel.source === 'tableau') {
			state.tableau[sel.index].pop();
		} else {
			state.freeCells[sel.index] = null;
		}
		state.foundations[fi].push(topCard);
		return true;
	}

	return false;
}

export function clearSelection(state: GameState): GameState {
	return { ...state, selected: null };
}
