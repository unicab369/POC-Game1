<script lang="ts">
	import { CardComponent, suitSymbol } from '$lib/cards';
	import type { Card } from '$lib/cards';
	import Pile from './Pile.svelte';
	import {
		newGame,
		handleClick,
		drawCard,
		clearSelection,
		executeMove,
		autoMoveFrom,
		validDescendingRun,
		canPlaceOnTableau,
		canPlaceOnFoundation
	} from './game';
	import type { GameState, SolitaireCard } from './game';

	interface DragState {
		isDragging: boolean;
		source: { type: 'tableau' | 'waste'; index: number; cardIndex?: number };
		cards: SolitaireCard[];
		startX: number;
		startY: number;
		currentX: number;
		currentY: number;
		offsetX: number;
		offsetY: number;
	}

	let game: GameState = $state(newGame());
	let initialGame: GameState = $state(structuredClone($state.snapshot(game)));
	let history: GameState[] = $state([]);
	let showPlayMenu = $state(false);
	let pendingAction: (() => void) | null = $state(null);
	let elapsed = $state(0);
	let timerInterval: ReturnType<typeof setInterval> | null = null;
	let drag: DragState | null = $state(null);
	let suppressNextClick = $state(false);
	let lastTap: { key: string; time: number } | null = null;
	const DOUBLE_TAP_MS = 400;

	let lastDrawnId: string | null = $state(null);

	let shakeTarget: { type: 'tableau' | 'waste'; index: number; cardIndex?: number } | null = $state(null);

	function triggerShake(type: 'tableau' | 'waste', index: number, cardIndex?: number) {
		shakeTarget = { type, index, cardIndex };
		setTimeout(() => { shakeTarget = null; }, 400);
	}

	function handleDoubleTap(
		sourceType: 'tableau' | 'waste',
		index: number,
		cardIndex?: number
	): boolean {
		const now = Date.now();
		const key = `${sourceType}-${index}-${cardIndex ?? -1}`;

		if (lastTap && lastTap.key === key && now - lastTap.time < DOUBLE_TAP_MS) {
			lastTap = null;
			if (history.length === 0) return false;

			// Undo the selection that the first tap caused
			if (history.length > 0) {
				game = history[history.length - 1];
				history = history.slice(0, -1);
			}

			const result = autoMoveFrom(game, { type: sourceType, index, cardIndex });
			if (result) {
				pushHistory();
				game = result;
			} else {
				triggerShake(sourceType, index, cardIndex);
			}
			return true;
		}

		lastTap = { key, time: now };
		return false;
	}

	function startTimer() {
		stopTimer();
		elapsed = 0;
		timerInterval = setInterval(() => {
			if (!game.won) elapsed++;
		}, 1000);
	}

	function stopTimer() {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
	}

	$effect(() => {
		startTimer();
		return () => stopTimer();
	});

	function formatTime(s: number): string {
		const m = Math.floor(s / 60);
		const sec = s % 60;
		return `${m}:${sec.toString().padStart(2, '0')}`;
	}

	function pushHistory() {
		history = [...history, structuredClone($state.snapshot(game))];
	}

	function onTableauClick(columnIndex: number, cardIndex: number) {
		if (suppressNextClick) {
			suppressNextClick = false;
			return;
		}
		if (cardIndex >= 0 && handleDoubleTap('tableau', columnIndex, cardIndex)) return;
		pushHistory();
		if (cardIndex === -1) {
			game = handleClick(game, 'tableau', columnIndex);
		} else {
			game = handleClick(game, 'tableau', columnIndex, cardIndex);
		}
	}

	function onWasteClick() {
		if (suppressNextClick) {
			suppressNextClick = false;
			return;
		}
		if (handleDoubleTap('waste', 0)) return;
		pushHistory();
		game = handleClick(game, 'waste', 0);
	}

	function onFoundationClick(index: number) {
		if (suppressNextClick) {
			suppressNextClick = false;
			return;
		}
		pushHistory();
		game = handleClick(game, 'foundation', index);
	}

	function onStockClick() {
		if (game.stock.length === 0) {
			if (game.waste.length > 0) {
				pushHistory();
				game = drawCard(game);
			}
			return;
		}

		lastDrawnId = game.stock[game.stock.length - 1].id;
		pushHistory();
		game = drawCard(game);
	}

	function onNewGame() {
		game = newGame();
		initialGame = structuredClone($state.snapshot(game));
		history = [];
		showPlayMenu = false;
		startTimer();
	}

	function onReset() {
		game = structuredClone($state.snapshot(initialGame));
		history = [];
		showPlayMenu = false;
		startTimer();
	}

	function onUndo() {
		if (history.length === 0) return;
		game = history[history.length - 1];
		history = history.slice(0, -1);
	}

	function confirmAction(action: () => void) {
		pendingAction = action;
	}

	function onConfirm() {
		if (pendingAction) pendingAction();
		pendingAction = null;
		showPlayMenu = false;
	}

	function onCancelConfirm() {
		pendingAction = null;
	}

	function onDeselect() {
		if (showPlayMenu) {
			showPlayMenu = false;
			return;
		}
		if (game.selected) {
			game = clearSelection(game);
		}
	}

	const foundationSuits = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
	const visibleWaste = $derived(game.waste.slice(-3));

	// --- Drag and Drop ---

	function getDragCards(
		source: DragState['source']
	): SolitaireCard[] {
		if (source.type === 'waste') {
			if (game.waste.length === 0) return [];
			return [game.waste[game.waste.length - 1]];
		}
		const col = game.tableau[source.index];
		const ci = source.cardIndex ?? col.length - 1;
		return col.slice(ci);
	}

	function onDragStart(
		sourceType: 'tableau' | 'waste',
		index: number,
		e: PointerEvent,
		cardIndex?: number
	) {
		if (game.won) return;
		if (e.button !== 0) return;

		const source: DragState['source'] = { type: sourceType, index, cardIndex };

		// Validate draggable
		if (sourceType === 'tableau') {
			const col = game.tableau[index];
			if (col.length === 0) return;
			const ci = cardIndex ?? col.length - 1;
			const card = col[ci];
			if (!card.faceUp) return;
			const cards = col.slice(ci);
			if (cards.length > 1 && !validDescendingRun(cards)) return;
		} else {
			if (game.waste.length === 0) return;
		}

		const cards = getDragCards(source);
		if (cards.length === 0) return;

		const el = e.currentTarget as HTMLElement;
		if (el.hasPointerCapture(e.pointerId)) {
			el.releasePointerCapture(e.pointerId);
		}
		e.preventDefault();

		const rect = el.getBoundingClientRect();

		drag = {
			isDragging: false,
			source,
			cards,
			startX: e.clientX,
			startY: e.clientY,
			currentX: e.clientX,
			currentY: e.clientY,
			offsetX: e.clientX - rect.left,
			offsetY: e.clientY - rect.top
		};
	}

	function onTableauDragStart(columnIndex: number, cardIndex: number, e: PointerEvent) {
		onDragStart('tableau', columnIndex, e, cardIndex);
	}

	function onWasteDragStart(e: PointerEvent) {
		onDragStart('waste', 0, e);
	}

	function onPointerMove(e: PointerEvent) {
		if (!drag) return;

		const dx = e.clientX - drag.startX;
		const dy = e.clientY - drag.startY;

		if (!drag.isDragging) {
			if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
				drag.isDragging = true;
				if (game.selected) {
					game = clearSelection(game);
				}
			} else {
				return;
			}
		}

		drag.currentX = e.clientX;
		drag.currentY = e.clientY;
	}

	function findDropTarget(x: number, y: number): { type: 'tableau' | 'foundation'; index: number } | null {
		const elements = document.elementsFromPoint(x, y);
		for (const el of elements) {
			const dropEl = (el as HTMLElement).closest('[data-drop]') as HTMLElement | null;
			if (dropEl) {
				const dropType = dropEl.dataset.drop as 'tableau' | 'foundation';
				const dropIndex = parseInt(dropEl.dataset.dropIndex ?? '0', 10);
				return { type: dropType, index: dropIndex };
			}
		}
		return null;
	}

	function onPointerUp(e: PointerEvent) {
		if (!drag) return;

		if (!drag.isDragging) {
			drag = null;
			return;
		}

		suppressNextClick = true;

		const target = findDropTarget(e.clientX, e.clientY);
		if (target) {
			const result = executeMove(game, drag.source, target);
			if (result) {
				pushHistory();
				game = result;
			}
		}

		drag = null;
	}

	// Compute valid drop targets during drag
	const dropTargets = $derived.by(() => {
		if (!drag || !drag.isDragging) return new Set<string>();

		const targets = new Set<string>();
		const cards = drag.cards;
		const topCard = cards[0];

		// Check tableau columns
		for (let i = 0; i < 7; i++) {
			if (drag.source.type === 'tableau' && drag.source.index === i) continue;
			const col = game.tableau[i];
			if (canPlaceOnTableau(topCard, col)) {
				targets.add(`tableau-${i}`);
			}
		}

		// Check foundations (single card only)
		if (cards.length === 1) {
			const fi = canPlaceOnFoundation(topCard, game);
			if (fi !== -1) {
				targets.add(`foundation-${fi}`);
			}
		}

		return targets;
	});

	const overlayLeft = $derived(drag && drag.isDragging ? drag.currentX - drag.offsetX : 0);
	const overlayTop = $derived(drag && drag.isDragging ? drag.currentY - drag.offsetY : 0);
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') {
			if (drag) {
				drag = null;
			} else {
				onDeselect();
			}
		}
	}}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
/>

<div class="board" role="application" aria-label="Solitaire Game">
	<div class="header">
		<h1 class="game-title"><span class="title-sol">Soli</span><span class="title-taire">taire</span></h1>
		<div class="stats">
			<span class="stat">{formatTime(elapsed)}</span>
			<span class="stat-divider"></span>
			<span class="stat">Moves: {game.moves}</span>
		</div>
	</div>

	<!-- Top Bar -->
	<div class="top-bar">
		<!-- Foundations -->
		<div class="cell-group">
			{#each game.foundations as pile, i}
				<div
					class="slot-wrapper"
					class:drop-target={dropTargets.has(`foundation-${i}`)}
					data-drop="foundation"
					data-drop-index={i}
				>
					{#if pile.length > 0}
						<CardComponent card={pile[pile.length - 1]} onclick={() => onFoundationClick(i)} />
					{:else}
						<button class="slot foundation" onclick={() => onFoundationClick(i)}>
							<span class="slot-label foundation-label">{suitSymbol(foundationSuits[i])}</span>
						</button>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Stock + Waste -->
		<div class="cell-group">
			<!-- Waste (fanned, up to 3 visible) -->
			<div class="waste-fan">
				{#if visibleWaste.length > 0}
					{#each visibleWaste as card, i (card.id)}
						{@const isTop = i === visibleWaste.length - 1}
						<div
							class="waste-card"
							class:waste-card-enter={card.id === lastDrawnId}
							class:shake={isTop && shakeTarget?.type === 'waste'}
							style="left: calc({i} * var(--waste-fan-offset, 20px)); --slide-from: calc(var(--card-w) + var(--card-gap) + {2 - i} * var(--waste-fan-offset))"
							onanimationend={() => { if (card.id === lastDrawnId) lastDrawnId = null; }}
						>
							<CardComponent
								{card}
								selected={isTop && game.selected?.source === 'waste'}
								onclick={isTop ? onWasteClick : undefined}
								onpointerdown={isTop ? (e: PointerEvent) => onWasteDragStart(e) : undefined}
							/>
						</div>
					{/each}
					{#if drag?.isDragging && drag.source.type === 'waste'}
						<div class="drag-source-overlay" style="left: calc({(visibleWaste.length - 1)} * var(--waste-fan-offset, 20px))"></div>
					{/if}
				{:else}
					<div class="slot"></div>
				{/if}
			</div>
			<!-- Stock -->
			<div>
				{#if game.stock.length > 0}
					<CardComponent card={game.stock[game.stock.length - 1]} faceDown={true} onclick={onStockClick} />
				{:else}
					<button class="slot stock" onclick={onStockClick}>
						<span class="slot-label recycle">&#8635;</span>
					</button>
				{/if}
			</div>
		</div>
	</div>

	<!-- Tableau -->
	<div class="tableau">
		{#each game.tableau as column, i}
			<Pile
				cards={column}
				columnIndex={i}
				selected={game.selected}
				onCardClick={onTableauClick}
				onDragStart={onTableauDragStart}
				isDropTarget={dropTargets.has(`tableau-${i}`)}
				dragSourceIndex={drag?.isDragging && drag.source.type === 'tableau' ? drag.source.index : null}
				dragCardIndex={drag?.isDragging && drag.source.type === 'tableau' && drag.source.index === i ? (drag.source.cardIndex ?? null) : null}
				shakeCardIndex={shakeTarget?.type === 'tableau' && shakeTarget.index === i ? (shakeTarget.cardIndex ?? game.tableau[i].length - 1) : null}
			/>
		{/each}
	</div>

	<!-- Drag Overlay -->
	{#if drag && drag.isDragging}
		<div
			class="drag-overlay"
			style="left: {overlayLeft}px; top: {overlayTop}px;"
		>
			{#each drag.cards as card, i}
				<div class="drag-card" style="top: calc({i} * var(--card-compact-h, 28px));">
					<CardComponent {card} compact={i < drag.cards.length - 1} />
				</div>
			{/each}
		</div>
	{/if}

	<!-- Win overlay -->
	{#if game.won}
		<div class="win-overlay">
			<div class="win-box">
				<h2>You Win!</h2>
				<button class="btn" onclick={onNewGame}>New Game</button>
			</div>
		</div>
	{/if}
</div>

<!-- Controls -->
<div class="controls">
	<button class="btn btn-secondary" onclick={onUndo} disabled={history.length === 0}>Undo</button>
	<div class="play-menu-wrapper">
		<button class="btn" onclick={() => { showPlayMenu = !showPlayMenu; pendingAction = null; }}>Play &#9662;</button>
		{#if showPlayMenu}
			<div class="play-menu">
				{#if pendingAction}
					<span class="confirm-label">Are you sure?</span>
					<div class="confirm-buttons">
						<button class="confirm-btn yes" onclick={onConfirm}>Yes</button>
						<button class="confirm-btn no" onclick={onCancelConfirm}>No</button>
					</div>
				{:else}
					<button class="menu-item" onclick={() => confirmAction(onNewGame)}>New Game</button>
					<button class="menu-item" onclick={() => confirmAction(onReset)}>Reset</button>
					<button class="menu-item" onclick={() => confirmAction(() => { window.location.href = '/'; })}>Quit</button>
					<button class="menu-item cancel" onclick={() => { showPlayMenu = false; }}>Cancel</button>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.board {
		--card-w: 70px;
		--card-h: 100px;
		--card-compact-h: 28px;
		--card-gap: 6px;
		--card-rank-fs: 28px;
		--card-suit-fs: 24px;
		--card-big-suit-fs: 48px;
		--card-face-fs: 64px;
		--waste-fan-offset: 20px;

		position: relative;
		max-width: 700px;
		margin: 0 auto;
		padding: 1rem;
		padding-bottom: 4rem;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
	}

	.back-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		color: var(--text-secondary);
		text-decoration: none;
		font-size: 0.95rem;
		font-weight: 600;
		padding: 0.4rem 0.8rem;
		border-radius: 8px;
		margin-bottom: 0.75rem;
		transition: color 0.2s, background 0.2s;
	}

	.back-btn:hover {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.08);
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.game-title {
		font-size: 1.35rem;
		font-weight: 800;
		margin: 0;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.title-sol {
		color: #2ecc71;
	}

	.title-taire {
		color: #a8e6cf;
	}

	.stats {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.stat {
		color: var(--text-primary);
		font-size: 1.25rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.stat-divider {
		width: 1px;
		height: 1.2rem;
		background: var(--text-muted);
	}

	.top-bar {
		display: flex;
		justify-content: space-between;
		margin-bottom: 1.5rem;
		gap: 1rem;
	}

	.cell-group {
		display: flex;
		gap: var(--card-gap, 6px);
	}

	.slot-wrapper {
		position: relative;
		border-radius: 8px;
		transition: outline-color 0.15s;
		outline: 2px solid transparent;
		outline-offset: 1px;
	}

	.slot-wrapper.drop-target {
		outline-color: rgba(0, 229, 255, 0.6);
	}

	.slot {
		width: var(--card-w, 70px);
		height: var(--card-h, 100px);
		border: 2px dashed #445;
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.03);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		padding: 0;
		color: #556;
	}

	.slot:hover {
		border-color: #667;
	}

	.slot-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.recycle {
		font-size: 2rem;
		opacity: 0.5;
	}

	.foundation-label {
		font-size: 1.5rem;
		opacity: 0.3;
	}

	.waste-fan {
		position: relative;
		width: calc(var(--card-w, 70px) + 2 * var(--waste-fan-offset, 20px));
		height: var(--card-h, 100px);
		flex-shrink: 0;
	}

	.waste-card {
		position: absolute;
		top: 0;
	}

	.waste-card.shake {
		animation: shake 0.35s ease-out;
	}

	@keyframes shake {
		0%, 100% { transform: translateX(0); }
		20% { transform: translateX(-5px); }
		40% { transform: translateX(5px); }
		60% { transform: translateX(-3px); }
		80% { transform: translateX(3px); }
	}

	/* Draw slide-in animation */
	.waste-card-enter {
		animation: waste-slide-in 0.2s ease-out;
	}

	@keyframes waste-slide-in {
		from {
			transform: translateX(var(--slide-from));
		}
		to {
			transform: translateX(0);
		}
	}

	.drag-source-overlay {
		position: absolute;
		top: 0;
		width: var(--card-w, 70px);
		height: var(--card-h, 100px);
		background: rgba(0, 0, 0, 0.5);
		border-radius: 6px;
		pointer-events: none;
	}

	.tableau {
		display: flex;
		gap: var(--card-gap, 6px);
		justify-content: center;
	}

	/* Drag overlay */
	.drag-overlay {
		position: fixed;
		pointer-events: none;
		z-index: 1000;
		width: var(--card-w, 70px);
	}

	.drag-card {
		position: absolute;
		left: 0;
	}

	.controls {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		justify-content: center;
		gap: 1rem;
		padding: 0.75rem 1rem;
		background: var(--bg-primary);
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		z-index: 10;
	}

	.btn {
		padding: 0.6rem 1.5rem;
		border-radius: 8px;
		border: none;
		font-size: 0.95rem;
		font-weight: 600;
		background: var(--accent);
		color: white;
		cursor: pointer;
		transition: background 0.2s;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
	}

	.btn:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	.btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.btn-secondary {
		background: var(--bg-secondary);
	}

	.btn-secondary:hover:not(:disabled) {
		background: var(--bg-card);
	}

	.play-menu-wrapper {
		position: relative;
	}

	.play-menu {
		position: fixed;
		bottom: 50%;
		left: 50%;
		transform: translate(-50%, 50%);
		background: var(--bg-secondary);
		border-radius: 12px;
		box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);
		overflow: hidden;
		min-width: 220px;
		z-index: 60;
	}

	.menu-item {
		display: block;
		width: 100%;
		padding: 1rem 1.5rem;
		border: none;
		background: none;
		color: var(--text-primary);
		font-size: 1.15rem;
		font-weight: 600;
		text-align: center;
		cursor: pointer;
		text-decoration: none;
		transition: background 0.15s;
	}

	.menu-item:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	.menu-item.cancel {
		color: var(--text-muted);
		font-size: 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}

	.confirm-label {
		display: block;
		padding: 1rem 1.5rem 0.5rem;
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--text-secondary);
		text-align: center;
	}

	.confirm-buttons {
		display: flex;
		gap: 0.75rem;
		padding: 0.5rem 1.5rem 1rem;
		justify-content: center;
	}

	.confirm-btn {
		padding: 0.5rem 1.5rem;
		border: none;
		border-radius: 8px;
		font-size: 1.05rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s;
	}

	.confirm-btn.yes {
		background: var(--accent);
		color: white;
	}

	.confirm-btn.yes:hover {
		background: var(--accent-hover);
	}

	.confirm-btn.no {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-primary);
	}

	.confirm-btn.no:hover {
		background: rgba(255, 255, 255, 0.18);
	}

	.win-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.win-box {
		background: var(--bg-secondary);
		padding: 3rem;
		border-radius: var(--radius);
		text-align: center;
		box-shadow: var(--shadow);
	}

	.win-box h2 {
		font-size: 2.5rem;
		margin-bottom: 1.5rem;
		color: var(--gold);
	}

	@media (max-width: 600px) {
		.board {
			--card-w: calc((100vw - 1rem - 6 * 4px) / 7);
			--card-h: calc(var(--card-w) * 100 / 70);
			--card-compact-h: calc(var(--card-w) * 0.4);
			--card-gap: 4px;
			--card-rank-fs: calc(var(--card-w) * 0.38);
			--card-suit-fs: calc(var(--card-w) * 0.32);
			--card-big-suit-fs: calc(var(--card-w) * 0.65);
			--card-face-fs: calc(var(--card-w) * 0.9);
			--waste-fan-offset: calc(var(--card-w) * 0.28);

			max-width: 100%;
			padding: 0.5rem;
		}

		.top-bar {
			margin-bottom: 0.75rem;
			gap: 0.5rem;
		}
	}
</style>
