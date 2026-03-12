<script lang="ts">
	import { CardComponent, suitSymbol } from '$lib/cards';
	import type { Card } from '$lib/cards';
	import Pile from './Pile.svelte';
	import {
		newGame,
		handleClick,
		clearSelection,
		executeMove,
		autoMoveFrom,
		validRun,
		canPlaceOnTableau,
		canPlaceOnFoundation,
		maxMovable
	} from './game';
	import type { GameState } from './game';

	interface DragState {
		isDragging: boolean;
		source: { type: 'tableau' | 'freecell'; index: number; cardIndex?: number };
		cards: Card[];
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

	function handleDoubleTap(
		sourceType: 'tableau' | 'freecell',
		index: number,
		cardIndex?: number
	): boolean {
		const now = Date.now();
		const key = `${sourceType}-${index}-${cardIndex ?? -1}`;

		if (lastTap && lastTap.key === key && now - lastTap.time < DOUBLE_TAP_MS) {
			lastTap = null;

			// Undo the selection that the first tap caused
			if (history.length > 0) {
				game = history[history.length - 1];
				history = history.slice(0, -1);
			}

			const result = autoMoveFrom(game, { type: sourceType, index, cardIndex });
			if (result) {
				pushHistory();
				game = result;
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

	function onFreeCellClick(index: number) {
		if (suppressNextClick) {
			suppressNextClick = false;
			return;
		}
		if (handleDoubleTap('freecell', index)) return;
		pushHistory();
		game = handleClick(game, 'freecell', index);
	}

	function onFoundationClick(index: number) {
		if (suppressNextClick) {
			suppressNextClick = false;
			return;
		}
		pushHistory();
		game = handleClick(game, 'foundation', index);
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

	// --- Drag and Drop ---

	function getDragCards(
		source: DragState['source']
	): Card[] {
		if (source.type === 'freecell') {
			const card = game.freeCells[source.index];
			return card ? [card] : [];
		}
		const col = game.tableau[source.index];
		const ci = source.cardIndex ?? col.length - 1;
		return col.slice(ci);
	}

	function onDragStart(
		sourceType: 'tableau' | 'freecell',
		index: number,
		e: PointerEvent,
		cardIndex?: number
	) {
		if (game.won) return;
		if (e.button !== 0) return; // left click only

		const source: DragState['source'] = { type: sourceType, index, cardIndex };

		// Validate draggable
		if (sourceType === 'tableau') {
			const col = game.tableau[index];
			if (col.length === 0) return;
			const ci = cardIndex ?? col.length - 1;
			const cards = col.slice(ci);
			if (cards.length > 1 && !validRun(cards)) return;
		} else {
			if (!game.freeCells[index]) return;
		}

		const cards = getDragCards(source);
		if (cards.length === 0) return;

		// Release implicit pointer capture from the button so pointermove
		// fires on the window instead of only on the button element
		const el = e.currentTarget as HTMLElement;
		if (el.hasPointerCapture(e.pointerId)) {
			el.releasePointerCapture(e.pointerId);
		}
		e.preventDefault();

		// Get the card element's position for offset calculation
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

	function onFreeCellDragStart(index: number, e: PointerEvent) {
		onDragStart('freecell', index, e);
	}

	function onPointerMove(e: PointerEvent) {
		if (!drag) return;

		const dx = e.clientX - drag.startX;
		const dy = e.clientY - drag.startY;

		if (!drag.isDragging) {
			if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
				drag.isDragging = true;
				// Clear any selection when starting a drag
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

	function findDropTarget(x: number, y: number): { type: 'tableau' | 'freecell' | 'foundation'; index: number } | null {
		const elements = document.elementsFromPoint(x, y);
		for (const el of elements) {
			const dropEl = (el as HTMLElement).closest('[data-drop]') as HTMLElement | null;
			if (dropEl) {
				const dropType = dropEl.dataset.drop as 'tableau' | 'freecell' | 'foundation';
				const dropIndex = parseInt(dropEl.dataset.dropIndex ?? '0', 10);
				return { type: dropType, index: dropIndex };
			}
		}
		return null;
	}

	function onPointerUp(e: PointerEvent) {
		if (!drag) return;

		if (!drag.isDragging) {
			// It was a click, not a drag — let the click handler fire
			drag = null;
			return;
		}

		// It was a drag — suppress the click that follows pointerup
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
		for (let i = 0; i < 8; i++) {
			if (drag.source.type === 'tableau' && drag.source.index === i) continue;
			const col = game.tableau[i];
			if (canPlaceOnTableau(topCard, col)) {
				const limit = maxMovable(game, col.length === 0);
				if (cards.length <= limit) {
					targets.add(`tableau-${i}`);
				}
			}
		}

		// Check free cells (single card only)
		if (cards.length === 1) {
			for (let i = 0; i < 4; i++) {
				if (game.freeCells[i] === null) {
					targets.add(`freecell-${i}`);
				}
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

	// Overlay position
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

<div class="board" role="application" aria-label="FreeCell Game">
	<div class="header">
		<h1 class="game-title"><span class="title-free">Free</span><span class="title-cell">Cell</span></h1>
		<div class="stats">
			<span class="stat">{formatTime(elapsed)}</span>
			<span class="stat-divider"></span>
			<span class="stat">Moves: {game.moves}</span>
		</div>
	</div>

	<!-- Top Bar -->
	<div class="top-bar">
		<!-- Free Cells -->
		<div class="cell-group">
			{#each game.freeCells as cell, i}
				<div
					class="slot-wrapper"
					class:drop-target={dropTargets.has(`freecell-${i}`)}
					data-drop="freecell"
					data-drop-index={i}
				>
					{#if cell}
						<CardComponent
							card={cell}
							selected={game.selected?.source === 'freecell' &&
								game.selected.index === i}
							onclick={() => onFreeCellClick(i)}
							onpointerdown={(e: PointerEvent) => onFreeCellDragStart(i, e)}
						/>
						{#if drag?.isDragging && drag.source.type === 'freecell' && drag.source.index === i}
							<div class="drag-source-overlay"></div>
						{/if}
					{:else}
						<button class="slot" onclick={() => onFreeCellClick(i)}>
							<span class="slot-label">Free</span>
						</button>
					{/if}
				</div>
			{/each}
		</div>

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
						<CardComponent
							card={pile[pile.length - 1]}
							onclick={() => onFoundationClick(i)}
						/>
					{:else}
						<button class="slot foundation" onclick={() => onFoundationClick(i)}>
							<span class="slot-label foundation-label">{suitSymbol(foundationSuits[i])}</span>
						</button>
					{/if}
				</div>
			{/each}
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
				<div class="drag-card" style="top: calc({i} * var(--card-compact-h, 38px));">
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
					<button class="menu-item" onclick={() => confirmAction(() => { window.location.href = '/'; })}>Close</button>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.board {
		--card-w: 78px;
		--card-h: 110px;
		--card-compact-h: 38px;
		--card-gap: 4px;
		--card-rank-fs: 28px;
		--card-suit-fs: 24px;
		--card-big-suit-fs: 58px;
		--card-face-fs: 76px;

		position: relative;
		max-width: 700px;
		margin: 0 auto;
		padding: 0.5rem;
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
		margin-bottom: 0;
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

	.title-free {
		color: #5be0f7;
	}

	.title-cell {
		color: #f7c948;
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
		margin-bottom: 0.75rem;
		gap: 0.5rem;
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

	.foundation-label {
		font-size: 1.5rem;
		opacity: 0.3;
	}

	.drag-source-overlay {
		position: absolute;
		inset: 0;
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
		width: var(--card-w, 78px);
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

	.btn:hover {
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
			--card-w: calc((100vw - 0.5rem - 7 * 3px) / 8);
			--card-h: calc(var(--card-w) * 1.4);
			--card-compact-h: calc(var(--card-w) * 0.5);
			--card-gap: 3px;
			--card-rank-fs: calc(var(--card-w) * 0.38);
			--card-suit-fs: calc(var(--card-w) * 0.32);
			--card-big-suit-fs: calc(var(--card-w) * 0.8);
			--card-face-fs: calc(var(--card-w) * 1.05);

			max-width: 100%;
			padding: 0.25rem;
		}

		.top-bar {
			margin-bottom: 0.5rem;
			gap: 0.25rem;
		}
	}
</style>
