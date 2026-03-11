import type { Suit, Color, Card } from './types';

export const SUIT_SYMBOLS: Record<Suit, string> = {
	spades: '♠',
	hearts: '♥',
	diamonds: '♦',
	clubs: '♣'
};

export const RANK_NAMES: Record<number, string> = {
	1: 'A',
	11: 'J',
	12: 'Q',
	13: 'K'
};

export function suitSymbol(suit: Suit): string {
	return SUIT_SYMBOLS[suit];
}

export function rankLabel(rank: number): string {
	return RANK_NAMES[rank] ?? String(rank);
}

export function cardColor(suit: Suit): Color {
	return suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black';
}

export function createDeck(): Card[] {
	const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
	const deck: Card[] = [];
	for (const suit of suits) {
		for (let rank = 1; rank <= 13; rank++) {
			deck.push({ suit, rank, id: `${suit}-${rank}` });
		}
	}
	return deck;
}

export function createSingleSuitDeck(suit: Suit, deckCount: number): Card[] {
	const deck: Card[] = [];
	for (let d = 0; d < deckCount; d++) {
		for (let rank = 1; rank <= 13; rank++) {
			deck.push({ suit, rank, id: `${suit}-${rank}-${d}` });
		}
	}
	return deck;
}

export function shuffle<T>(arr: T[]): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}
