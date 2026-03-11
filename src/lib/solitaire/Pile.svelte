<script lang="ts">
	import { CardComponent } from '$lib/cards';
	import type { SolitaireCard, Selection } from './game';

	interface Props {
		cards: SolitaireCard[];
		columnIndex: number;
		selected: Selection | null;
		onCardClick: (columnIndex: number, cardIndex: number) => void;
	}

	let { cards, columnIndex, selected, onCardClick }: Props = $props();

	function isSelected(cardIdx: number): boolean {
		if (!selected) return false;
		if (selected.source !== 'tableau' || selected.index !== columnIndex) return false;
		return cardIdx >= cards.length - selected.cardCount;
	}
</script>

<div class="pile" role="list">
	{#if cards.length === 0}
		<button class="empty-slot" onclick={() => onCardClick(columnIndex, -1)}>
			<span class="empty-label"></span>
		</button>
	{:else}
		{#each cards as card, i (card.id)}
			<div class="card-wrapper" style="top: calc({i} * var(--card-compact-h, 28px))">
				<CardComponent
					{card}
					faceDown={!card.faceUp}
					selected={isSelected(i)}
					compact={i < cards.length - 1}
					onclick={() => {
						if (card.faceUp) onCardClick(columnIndex, i);
					}}
				/>
			</div>
		{/each}
	{/if}
</div>

<style>
	.pile {
		position: relative;
		width: var(--card-w, 70px);
		min-height: var(--card-h, 100px);
		flex-shrink: 0;
	}

	.card-wrapper {
		position: absolute;
		left: 0;
	}

	.empty-slot {
		width: var(--card-w, 70px);
		height: var(--card-h, 100px);
		border: 2px dashed #445;
		border-radius: 6px;
		background: transparent;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #445;
		padding: 0;
	}

	.empty-slot:hover {
		border-color: #667;
	}

	.empty-label {
		font-size: 0.75rem;
	}
</style>
