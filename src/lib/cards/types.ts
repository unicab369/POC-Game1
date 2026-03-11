export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Color = 'red' | 'black';

export interface Card {
	suit: Suit;
	rank: number; // 1=Ace, 2-10, 11=Jack, 12=Queen, 13=King
	id: string;
}
