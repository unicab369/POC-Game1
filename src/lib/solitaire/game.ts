import { type Card, type Suit, cardColor, createDeck, shuffle } from '$lib/cards';

export type { Card, Suit };

export interface SolitaireCard extends Card {
	faceUp: boolean;
}

export interface GameState {
	tableau: SolitaireCard[][]; // 7 columns
	stock: SolitaireCard[];
	waste: SolitaireCard[];
	foundations: SolitaireCard[][]; // 4 piles (one per suit)
	selected: Selection | null;
	won: boolean;
}

export interface Selection {
	source: 'tableau' | 'waste';
	index: number; // column index (for tableau) or 0 (for waste)
	cardCount: number;
}

export function newGame(): GameState {
	const deck = shuffle(createDeck()).map((c) => ({ ...c, faceUp: false }));
	const tableau: SolitaireCard[][] = Array.from({ length: 7 }, () => []);

	let cardIdx = 0;
	for (let col = 0; col < 7; col++) {
		for (let row = 0; row <= col; row++) {
			const card = deck[cardIdx++];
			card.faceUp = row === col; // only top card face-up
			tableau[col].push(card);
		}
	}

	const stock = deck.slice(cardIdx); // remaining 24 cards

	const state: GameState = {
		tableau,
		stock,
		waste: [],
		foundations: [[], [], [], []],
		selected: null,
		won: false
	};

	autoFoundation(state);
	return state;
}

export function drawCard(state: GameState): GameState {
	const newState = structuredClone(state);
	newState.selected = null;

	if (newState.stock.length > 0) {
		const card = newState.stock.pop()!;
		card.faceUp = true;
		newState.waste.push(card);
	} else if (newState.waste.length > 0) {
		// Recycle waste back to stock (reversed, face-down)
		newState.stock = newState.waste.reverse().map((c) => ({ ...c, faceUp: false }));
		newState.waste = [];
	}

	return newState;
}

function foundationIndex(state: GameState, suit: Suit): number {
	for (let i = 0; i < 4; i++) {
		const pile = state.foundations[i];
		if (pile.length > 0 && pile[0].suit === suit) return i;
	}
	for (let i = 0; i < 4; i++) {
		if (state.foundations[i].length === 0) return i;
	}
	return -1;
}

function canAutoFoundation(state: GameState, card: SolitaireCard): boolean {
	const fi = foundationIndex(state, card.suit);
	if (fi === -1) return false;
	const pile = state.foundations[fi];
	const needed = pile.length === 0 ? 1 : pile[pile.length - 1].rank + 1;
	if (card.rank !== needed) return false;

	if (card.rank <= 2) return true;

	const oppositeColor = cardColor(card.suit) === 'red' ? 'black' : 'red';
	let minOpposite = 14;
	let oppositeStarted = 0;
	for (const f of state.foundations) {
		if (f.length > 0 && cardColor(f[0].suit) === oppositeColor) {
			minOpposite = Math.min(minOpposite, f[f.length - 1].rank);
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
		for (let col = 0; col < 7; col++) {
			const pile = state.tableau[col];
			if (pile.length === 0) continue;
			const card = pile[pile.length - 1];
			if (card.faceUp && canAutoFoundation(state, card)) {
				const fi = foundationIndex(state, card.suit);
				state.foundations[fi].push(pile.pop()!);
				flipTopCards(state);
				moved = true;
			}
		}

		// Check waste top
		if (state.waste.length > 0) {
			const card = state.waste[state.waste.length - 1];
			if (canAutoFoundation(state, card)) {
				const fi = foundationIndex(state, card.suit);
				state.foundations[fi].push(state.waste.pop()!);
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

function flipTopCards(state: GameState): void {
	for (const col of state.tableau) {
		if (col.length > 0 && !col[col.length - 1].faceUp) {
			col[col.length - 1].faceUp = true;
		}
	}
}

function validDescendingRun(cards: SolitaireCard[]): boolean {
	for (let i = 1; i < cards.length; i++) {
		if (cards[i].rank !== cards[i - 1].rank - 1) return false;
		if (cardColor(cards[i].suit) === cardColor(cards[i - 1].suit)) return false;
		if (!cards[i].faceUp) return false;
	}
	return cards.length > 0 && cards[0].faceUp;
}

function canPlaceOnTableau(card: SolitaireCard, column: SolitaireCard[]): boolean {
	if (column.length === 0) return card.rank === 13; // Only Kings on empty
	const top = column[column.length - 1];
	return card.rank === top.rank - 1 && cardColor(card.suit) !== cardColor(top.suit);
}

function canPlaceOnFoundation(card: SolitaireCard, state: GameState): number {
	for (let i = 0; i < 4; i++) {
		const pile = state.foundations[i];
		if (pile.length === 0) {
			if (card.rank === 1) {
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
	target: 'tableau' | 'waste' | 'foundation',
	index: number,
	cardIndex?: number
): GameState {
	const newState = structuredClone(state);

	if (newState.won) return newState;

	if (newState.selected) {
		const result = attemptMove(newState, target, index);
		newState.selected = null;
		if (result) {
			flipTopCards(newState);
			autoFoundation(newState);
		}
		return newState;
	}

	// Select a card
	if (target === 'tableau') {
		const col = newState.tableau[index];
		if (col.length === 0) return newState;

		if (cardIndex === undefined) cardIndex = col.length - 1;

		const card = col[cardIndex];
		if (!card.faceUp) return newState; // Can't select face-down cards

		const count = col.length - cardIndex;
		const cards = col.slice(cardIndex);

		if (validDescendingRun(cards)) {
			newState.selected = { source: 'tableau', index, cardCount: count };
		}
	} else if (target === 'waste') {
		if (newState.waste.length > 0) {
			newState.selected = { source: 'waste', index: 0, cardCount: 1 };
		}
	}

	return newState;
}

function attemptMove(state: GameState, target: string, index: number): boolean {
	const sel = state.selected!;
	let cards: SolitaireCard[];

	if (sel.source === 'tableau') {
		const col = state.tableau[sel.index];
		cards = col.slice(col.length - sel.cardCount);
	} else {
		cards = [state.waste[state.waste.length - 1]];
	}

	const topCard = cards[0];

	if (target === 'tableau') {
		const destCol = state.tableau[index];

		if (sel.source === 'tableau' && sel.index === index) return false;

		if (!canPlaceOnTableau(topCard, destCol)) return false;

		if (sel.source === 'tableau') {
			state.tableau[sel.index].splice(state.tableau[sel.index].length - sel.cardCount);
		} else {
			state.waste.pop();
		}
		destCol.push(...cards);
		return true;
	}

	if (target === 'foundation') {
		if (cards.length > 1) return false;
		const fi = canPlaceOnFoundation(topCard, state);
		if (fi === -1) return false;

		if (sel.source === 'tableau') {
			state.tableau[sel.index].pop();
		} else {
			state.waste.pop();
		}
		state.foundations[fi].push(topCard);
		return true;
	}

	return false;
}

export function clearSelection(state: GameState): GameState {
	return { ...state, selected: null };
}
