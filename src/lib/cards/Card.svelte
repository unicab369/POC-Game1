<script lang="ts">
	import { suitSymbol, rankLabel, cardColor } from './utils';
	import type { Card } from './types';

	interface Props {
		card: Card;
		selected?: boolean;
		onclick?: () => void;
		onpointerdown?: (e: PointerEvent) => void;
		compact?: boolean;
		faceDown?: boolean;
	}

	let { card, selected = false, onclick, onpointerdown, compact = false, faceDown = false }: Props = $props();

	const color = $derived(cardColor(card.suit));
	const symbol = $derived(suitSymbol(card.suit));
	const label = $derived(rankLabel(card.rank));
	const isFace = $derived(card.rank >= 11 && card.rank <= 13);
	const faceSymbol = $derived(
		card.rank === 11 ? '♞' : card.rank === 12 ? '♛' : card.rank === 13 ? '♚' : ''
	);
</script>

<button
	class="card"
	class:red={!faceDown && color === 'red'}
	class:black={!faceDown && color === 'black'}
	class:selected
	class:compact
	class:face-down={faceDown}
	onclick={onclick}
	onpointerdown={onpointerdown}
>
	{#if faceDown}
		<div class="card-back"></div>
	{:else}
		<span class="top-row">
			<span class="rank">{label}</span>
			<span class="suit-small">{symbol}</span>
		</span>
		{#if isFace}
			<span class="face-figure">{faceSymbol}</span>
		{:else}
			<span class="suit-big">{symbol}</span>
		{/if}
	{/if}
</button>

<style>
	.card {
		width: var(--card-w, 70px);
		height: var(--card-h, 100px);
		background: #fff;
		border-radius: 6px;
		border: 2px solid #ccc;
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		font-family: 'Segoe UI', system-ui, sans-serif;
		transition: border-color 0.15s, box-shadow 0.15s;
		flex-shrink: 0;
		padding: 2px 3px;
		line-height: 1;
		overflow: hidden;
		position: relative;
		touch-action: none;
	}

	.card.compact {
		height: var(--card-compact-h, 28px);
		overflow: hidden;
		border-radius: 6px 6px 0 0;
	}

	.card.compact .suit-big,
	.card.compact .face-figure {
		display: none;
	}

	.card.selected {
		border-color: #00e5ff;
		box-shadow: 0 0 12px rgba(0, 229, 255, 0.7);
	}

	.card.face-down {
		cursor: default;
		background: #2c5a8c;
		border-color: #1e3d5f;
	}

	.card-back {
		position: absolute;
		inset: 3px;
		border-radius: 3px;
		background:
			repeating-linear-gradient(
				45deg,
				transparent,
				transparent 4px,
				rgba(255, 255, 255, 0.12) 4px,
				rgba(255, 255, 255, 0.12) 5px
			),
			repeating-linear-gradient(
				-45deg,
				transparent,
				transparent 4px,
				rgba(255, 255, 255, 0.12) 4px,
				rgba(255, 255, 255, 0.12) 5px
			);
		border: 1px solid rgba(255, 255, 255, 0.15);
	}

	.card:hover {
		border-color: #999;
	}

	.card.face-down:hover {
		border-color: #1e3d5f;
	}

	.card.selected:hover {
		border-color: #00e5ff;
	}

	.red {
		color: #d32f2f;
	}

	.black {
		color: #222;
	}

	.top-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.rank {
		font-size: var(--card-rank-fs, 28px);
		font-weight: 800;
	}

	.suit-small {
		font-size: var(--card-suit-fs, 24px);
	}

	.suit-big {
		align-self: center;
		font-size: var(--card-big-suit-fs, 64px);
		line-height: 1;
		margin-top: auto;
		margin-bottom: auto;
		opacity: 0.85;
	}

	.face-figure {
		position: absolute;
		left: 50%;
		top: 58%;
		transform: translate(-50%, -50%);
		font-size: var(--card-face-fs, 80px);
		line-height: 1;
		opacity: 0.9;
	}
</style>
