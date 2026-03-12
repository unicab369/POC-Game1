<script lang="ts">
	import { CardComponent } from '$lib/cards';
	import type { SolitaireCard, Selection } from './game';

	interface Props {
		cards: SolitaireCard[];
		columnIndex: number;
		selected: Selection | null;
		onCardClick: (columnIndex: number, cardIndex: number) => void;
		onDragStart?: (columnIndex: number, cardIndex: number, e: PointerEvent) => void;
		isDropTarget?: boolean;
		dragSourceIndex?: number | null;
		dragCardIndex?: number | null;
	}

	let {
		cards,
		columnIndex,
		selected,
		onCardClick,
		onDragStart,
		isDropTarget = false,
		dragSourceIndex = null,
		dragCardIndex = null
	}: Props = $props();

	function isSelected(cardIdx: number): boolean {
		if (!selected) return false;
		if (selected.source !== 'tableau' || selected.index !== columnIndex) return false;
		return cardIdx >= cards.length - selected.cardCount;
	}

	function isDragSource(cardIdx: number): boolean {
		if (dragSourceIndex !== columnIndex || dragCardIndex === null) return false;
		return cardIdx >= dragCardIndex;
	}
</script>

<div
	class="pile"
	class:drop-target={isDropTarget}
	role="list"
	data-drop="tableau"
	data-drop-index={columnIndex}
>
	{#if cards.length === 0}
		<button class="empty-slot" onclick={() => onCardClick(columnIndex, -1)}>
			<span class="empty-label"></span>
		</button>
	{:else}
		{#each cards as card, i (card.id)}
			<div
				class="card-wrapper"
				class:drag-source={isDragSource(i)}
				style="top: calc({i} * var(--card-compact-h, 28px))"
			>
				<CardComponent
					{card}
					faceDown={!card.faceUp}
					selected={isSelected(i)}
					compact={i < cards.length - 1}
					onclick={() => {
						if (card.faceUp) onCardClick(columnIndex, i);
					}}
					onpointerdown={onDragStart && card.faceUp
						? (e: PointerEvent) => onDragStart!(columnIndex, i, e)
						: undefined}
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

	.pile.drop-target {
		outline: 2px solid rgba(0, 229, 255, 0.6);
		outline-offset: 2px;
		border-radius: 6px;
	}

	.card-wrapper {
		position: absolute;
		left: 0;
	}

	.card-wrapper.drag-source {
		opacity: 0.3;
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
