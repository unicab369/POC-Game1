<script lang="ts">
	import { base } from '$app/paths';
	import { CardComponent, WinAnimation } from '$lib/cards';
	import type { SpiderCard } from './game';
	import { Pile } from '$lib/cards';
	import {
		newGame,
		dealFromStock,
		executeMove,
		validDescendingRun,
		canPlaceOnTableau,
		findCompletedRun,
		applyCompletedRunRemoval
	} from './game';
	import type { GameState } from './game';

	interface DragState {
		isDragging: boolean;
		sourceIndex: number;
		cardIndex: number;
		cards: SpiderCard[];
		startX: number;
		startY: number;
		currentX: number;
		currentY: number;
		offsetX: number;
		offsetY: number;
	}

	const STORAGE_KEY = 'game-hub:spider';

	function loadSaved(): { game: GameState; initialGame: GameState; history: GameState[]; elapsed: number } | null {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return null;
			return JSON.parse(raw);
		} catch { return null; }
	}

	const saved = loadSaved();
	let game: GameState = $state(saved?.game ?? newGame());
	let initialGame: GameState = $state(saved?.initialGame ?? structuredClone($state.snapshot(game)));
	let history: GameState[] = $state(saved?.history ?? []);
	let showPlayMenu = $state(false);
	let pendingAction: (() => void) | null = $state(null);
	let elapsed = $state(saved?.elapsed ?? 0);
	let timerInterval: ReturnType<typeof setInterval> | null = null;
	let drag: DragState | null = $state(null);
	let suppressNextClick = $state(false);
	let hint: { sourceIndex: number; cardIndex: number; destIndex: number } | null = $state(null);
	let showWinModal = $state(false);

	interface MoveAnim {
		cards: SpiderCard[];
		fromX: number;
		fromY: number;
		toX: number;
		toY: number;
		started: boolean;
	}
	let moveAnim: MoveAnim | null = $state(null);
	let pendingMoveState: GameState | null = null;
	let animSourceIndex: number | null = $state(null);
	let animCardIndex: number | null = $state(null);
	const MOVE_ANIM_MS = 200;

	interface SuitAnim {
		cards: SpiderCard[];
		fromX: number;
		fromY: number;
		toX: number;
		toY: number;
		started: boolean;
	}
	let suitAnim: SuitAnim | null = $state(null);
	const SUIT_ANIM_MS = 500;

	interface DealAnimCard {
		card: SpiderCard;
		toX: number;
		toY: number;
		started: boolean;
		done: boolean;
	}
	let dealAnim: { fromX: number; fromY: number; cards: DealAnimCard[] } | null = $state(null);
	let dealPendingState: GameState | null = null;
	const DEAL_ANIM_MS = 150;
	const DEAL_STAGGER_MS = 60;

	let shakeTarget: { col: number; cardIndex: number } | null = $state(null);

	function triggerShake(col: number, cardIndex: number) {
		shakeTarget = { col, cardIndex };
		setTimeout(() => { shakeTarget = null; }, 400);
	}

	function getCompactHeight(): number {
		const piles = document.querySelectorAll('[data-drop="tableau"]');
		for (const pile of piles) {
			const ws = pile.querySelectorAll('.card-wrapper');
			if (ws.length >= 2) {
				return ws[1].getBoundingClientRect().top - ws[0].getBoundingClientRect().top;
			}
		}
		return 24;
	}

	function getSourcePos(colIndex: number, cardIndex: number): { x: number; y: number } | null {
		const el = document.querySelector(`[data-drop="tableau"][data-drop-index="${colIndex}"]`);
		if (!el) return null;
		const ws = el.querySelectorAll('.card-wrapper');
		if (ws[cardIndex]) {
			const r = ws[cardIndex].getBoundingClientRect();
			return { x: r.left, y: r.top };
		}
		return null;
	}

	function getDestPos(colIndex: number): { x: number; y: number } | null {
		const el = document.querySelector(`[data-drop="tableau"][data-drop-index="${colIndex}"]`);
		if (!el) return null;
		const r = el.getBoundingClientRect();
		const ws = el.querySelectorAll('.card-wrapper');
		if (ws.length > 0) {
			const compactH = getCompactHeight();
			return { x: r.left, y: r.top + ws.length * compactH };
		}
		return { x: r.left, y: r.top };
	}

	function findAutoTarget(sourceIndex: number, cardIndex: number): { destIndex: number; cards: SpiderCard[] } | null {
		const col = game.tableau[sourceIndex];
		if (col.length === 0) return null;
		const cards = col.slice(cardIndex);
		if (!validDescendingRun(cards)) return null;
		const top = cards[0];

		// Same-suit match
		for (let i = 0; i < 10; i++) {
			if (i === sourceIndex) continue;
			const dest = game.tableau[i];
			if (dest.length === 0) continue;
			const dTop = dest[dest.length - 1];
			if (top.rank === dTop.rank - 1 && top.suit === dTop.suit)
				return { destIndex: i, cards };
		}
		// Any rank match
		for (let i = 0; i < 10; i++) {
			if (i === sourceIndex) continue;
			if (game.tableau[i].length === 0) continue;
			if (canPlaceOnTableau(top, game.tableau[i]))
				return { destIndex: i, cards };
		}
		// Empty column
		for (let i = 0; i < 10; i++) {
			if (i === sourceIndex) continue;
			if (game.tableau[i].length === 0)
				return { destIndex: i, cards };
		}
		return null;
	}

	function findHint(): void {
		hint = null;
		for (let col = 0; col < 10; col++) {
			const pile = game.tableau[col];
			if (pile.length === 0) continue;
			// Find the top of the valid run from the bottom
			for (let ci = pile.length - 1; ci >= 0; ci--) {
				if (!pile[ci].faceUp) break;
				const cards = pile.slice(ci);
				if (!validDescendingRun(cards)) break;
				const found = findAutoTarget(col, ci);
				if (found) {
					hint = { sourceIndex: col, cardIndex: ci, destIndex: found.destIndex };
					setTimeout(() => { hint = null; }, 3000);
					return;
				}
			}
		}
	}

	function getCompletedSuitPos(): { x: number; y: number } | null {
		const markers = document.querySelectorAll('.suit-marker:not(.filled)');
		if (markers.length === 0) return null;
		const r = markers[0].getBoundingClientRect();
		return { x: r.left, y: r.top };
	}

	function checkAndAnimateCompletedRun() {
		const run = findCompletedRun(game);
		if (!run) return;

		const from = getSourcePos(run.colIndex, run.runStart);
		const to = getCompletedSuitPos();

		if (!from || !to) {
			game = applyCompletedRunRemoval(game);
			return;
		}

		animSourceIndex = run.colIndex;
		animCardIndex = run.runStart;

		suitAnim = {
			cards: run.cards,
			fromX: from.x,
			fromY: from.y,
			toX: to.x,
			toY: to.y,
			started: false
		};

		requestAnimationFrame(() => {
			if (suitAnim) suitAnim.started = true;
			setTimeout(() => {
				game = applyCompletedRunRemoval(game);
				suitAnim = null;
				animSourceIndex = null;
				animCardIndex = null;
			}, SUIT_ANIM_MS);
		});
	}

	function startTimer() {
		stopTimer();
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

	$effect(() => {
		const snapshot = {
			game: $state.snapshot(game),
			initialGame: $state.snapshot(initialGame),
			history: $state.snapshot(history),
			elapsed
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
	});

	$effect(() => {
		if (!game.won) {
			showWinModal = false;
			return;
		}
		const t = setTimeout(() => { showWinModal = true; }, 1500);
		return () => clearTimeout(t);
	});

	function formatTime(s: number): string {
		const m = Math.floor(s / 60);
		const sec = s % 60;
		return `${m}:${sec.toString().padStart(2, '0')}`;
	}

	const hasEmptyColumn = $derived(game.tableau.some((col) => col.length === 0));
	const dealsRemaining = $derived(Math.floor(game.stock.length / 10));

	function pushHistory() {
		history = [...history, structuredClone($state.snapshot(game))];
	}

	function onTableauClick(columnIndex: number, cardIndex: number) {
		hint = null;
		if (moveAnim || suitAnim) return;
		if (suppressNextClick) {
			suppressNextClick = false;
			return;
		}
		if (cardIndex < 0) return;

		const found = findAutoTarget(columnIndex, cardIndex);
		if (!found) { triggerShake(columnIndex, cardIndex); return; }

		const result = executeMove(game, columnIndex, cardIndex, found.destIndex, true);
		if (!result) { triggerShake(columnIndex, cardIndex); return; }

		const from = getSourcePos(columnIndex, cardIndex);
		const to = getDestPos(found.destIndex);

		if (!from || !to) {
			pushHistory();
			game = result;
			requestAnimationFrame(() => checkAndAnimateCompletedRun());
			return;
		}

		pendingMoveState = result;
		animSourceIndex = columnIndex;
		animCardIndex = cardIndex;
		moveAnim = { cards: found.cards, fromX: from.x, fromY: from.y, toX: to.x, toY: to.y, started: false };

		requestAnimationFrame(() => {
			if (moveAnim) moveAnim.started = true;
			setTimeout(() => {
				if (pendingMoveState) {
					pushHistory();
					game = pendingMoveState;
					pendingMoveState = null;
				}
				moveAnim = null;
				animSourceIndex = null;
				animCardIndex = null;
				requestAnimationFrame(() => checkAndAnimateCompletedRun());
			}, MOVE_ANIM_MS);
		});
	}

	function getStockPos(): { x: number; y: number } | null {
		const el = document.querySelector('.stock-fan');
		if (!el) return null;
		const r = el.getBoundingClientRect();
		return { x: r.left, y: r.top };
	}

	function onStockClick() {
		if (suitAnim || dealAnim || moveAnim) return;
		if (game.stock.length === 0) return;
		if (game.tableau.some((col) => col.length === 0)) return;

		// Capture the 10 cards about to be dealt and target positions before state change
		const stockFrom = getStockPos();
		if (!stockFrom) {
			pushHistory();
			game = dealFromStock(game, true);
			requestAnimationFrame(() => checkAndAnimateCompletedRun());
			return;
		}

		const targets: { x: number; y: number }[] = [];
		for (let col = 0; col < 10; col++) {
			const pos = getDestPos(col);
			targets.push(pos ?? stockFrom);
		}

		// Get the cards that will be dealt (last 10 from stock, reversed since stock pops)
		const dealCards: SpiderCard[] = [];
		for (let i = 0; i < 10; i++) {
			const card = game.stock[game.stock.length - 1 - i];
			dealCards.push({ ...card, faceUp: true });
		}

		// Compute and save new state but don't apply yet
		pushHistory();
		dealPendingState = dealFromStock(game, true);

		dealAnim = {
			fromX: stockFrom.x,
			fromY: stockFrom.y,
			cards: dealCards.map((card, i) => ({
				card,
				toX: targets[i].x,
				toY: targets[i].y,
				started: false,
				done: false
			}))
		};

		// Stagger the animations
		for (let i = 0; i < 10; i++) {
			setTimeout(() => {
				if (!dealAnim) return;
				requestAnimationFrame(() => {
					if (!dealAnim) return;
					dealAnim.cards[i].started = true;
				});
			}, i * DEAL_STAGGER_MS);
		}

		// After all animations complete, apply the state
		setTimeout(() => {
			if (dealPendingState) {
				game = dealPendingState;
				dealPendingState = null;
			}
			dealAnim = null;
			requestAnimationFrame(() => checkAndAnimateCompletedRun());
		}, 9 * DEAL_STAGGER_MS + DEAL_ANIM_MS + 50);
	}

	function onNewGame() {
		hint = null;
		game = newGame();
		initialGame = structuredClone($state.snapshot(game));
		history = [];
		showPlayMenu = false;
		elapsed = 0;
		startTimer();
	}

	function onReset() {
		hint = null;
		game = structuredClone($state.snapshot(initialGame));
		history = [];
		showPlayMenu = false;
		elapsed = 0;
		startTimer();
	}

	function onUndo() {
		hint = null;
		suitAnim = null;
		animSourceIndex = null;
		animCardIndex = null;
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
		}
	}

	// --- Drag and Drop ---

	function onDragStart(columnIndex: number, cardIndex: number, e: PointerEvent) {
		if (game.won) return;
		if (e.button !== 0) return;

		const col = game.tableau[columnIndex];
		if (col.length === 0) return;
		if (!col[cardIndex].faceUp) return;

		const cards = col.slice(cardIndex);
		if (!validDescendingRun(cards)) return;

		const el = e.currentTarget as HTMLElement;
		if (el.hasPointerCapture(e.pointerId)) {
			el.releasePointerCapture(e.pointerId);
		}
		e.preventDefault();

		const rect = el.getBoundingClientRect();

		drag = {
			isDragging: false,
			sourceIndex: columnIndex,
			cardIndex,
			cards,
			startX: e.clientX,
			startY: e.clientY,
			currentX: e.clientX,
			currentY: e.clientY,
			offsetX: e.clientX - rect.left,
			offsetY: e.clientY - rect.top
		};
	}

	function onPointerMove(e: PointerEvent) {
		if (!drag) return;

		const dx = e.clientX - drag.startX;
		const dy = e.clientY - drag.startY;

		if (!drag.isDragging) {
			if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
				drag.isDragging = true;
				} else {
				return;
			}
		}

		drag.currentX = e.clientX;
		drag.currentY = e.clientY;
	}

	function findDropTarget(x: number, y: number): number | null {
		const elements = document.elementsFromPoint(x, y);
		for (const el of elements) {
			const dropEl = (el as HTMLElement).closest('[data-drop]') as HTMLElement | null;
			if (dropEl && dropEl.dataset.drop === 'tableau') {
				return parseInt(dropEl.dataset.dropIndex ?? '0', 10);
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

		const destIndex = findDropTarget(e.clientX, e.clientY);
		if (destIndex !== null) {
			const result = executeMove(game, drag.sourceIndex, drag.cardIndex, destIndex, true);
			if (result) {
				pushHistory();
				game = result;
				drag = null;
				requestAnimationFrame(() => checkAndAnimateCompletedRun());
				return;
			}
		}

		drag = null;
	}

	// Compute valid drop targets during drag
	const dropTargets = $derived.by(() => {
		if (!drag || !drag.isDragging) return new Set<number>();

		const targets = new Set<number>();
		const topCard = drag.cards[0];

		for (let i = 0; i < 10; i++) {
			if (i === drag.sourceIndex) continue;
			if (canPlaceOnTableau(topCard, game.tableau[i])) {
				targets.add(i);
			}
		}

		return targets;
	});

	const runStartIndices = $derived.by(() => {
		return game.tableau.map((col) => {
			if (col.length <= 1) return 0;
			let start = col.length - 1;
			while (start > 0 && validDescendingRun(col.slice(start - 1))) {
				start--;
			}
			return start;
		});
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

<div class="board" role="application" aria-label="Spider Solitaire Game">
	<div class="header">
		<h1 class="game-title"><span class="title-spi">Spi</span><span class="title-der">der</span></h1>
		<div class="stats">
			<span class="stat">{formatTime(elapsed)}</span>
			<span class="stat-divider"></span>
			<span class="stat">Moves: {game.moves}</span>
		</div>
	</div>

	<!-- Info Bar -->
	<div class="info-bar">
		<!-- Completed suits indicator -->
		<div class="completed">
			{#each Array(8) as _, i}
				<span class="suit-marker" class:filled={i < game.completedSuits}>&#9824;</span>
			{/each}
		</div>

		<!-- Stock -->
		{#if game.stock.length > 0}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="stock-fan" class:stock-disabled={hasEmptyColumn} onclick={hasEmptyColumn ? undefined : onStockClick}>
				{#each Array(dealsRemaining) as _, i}
					<div class="stock-card" style="left: calc({i} * var(--stock-fan-offset, 6px))">
						<CardComponent
							card={game.stock[i * 10]}
							faceDown={true}
						/>
					</div>
				{/each}
			</div>
		{:else}
			<div class="slot"></div>
		{/if}
	</div>

	<!-- Tableau -->
	<div class="tableau">
		{#each game.tableau as column, i}
			<Pile
				cards={column}
				columnIndex={i}
				selected={game.selected}
				onCardClick={onTableauClick}
				onDragStart={onDragStart}
				isDropTarget={dropTargets.has(i)}
				dragSourceIndex={(drag?.isDragging ? drag.sourceIndex : null) ?? animSourceIndex}
				dragCardIndex={(drag?.isDragging && drag.sourceIndex === i ? drag.cardIndex : null) ?? (animSourceIndex === i ? animCardIndex : null)}
				shakeCardIndex={shakeTarget?.col === i ? shakeTarget.cardIndex : null}
				hintCardIndex={hint && hint.sourceIndex === i ? hint.cardIndex : null}
				runStartIndex={runStartIndices[i]}
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
				<div class="drag-card" style="top: calc({i} * var(--card-compact-h, 24px));">
					<CardComponent {card} compact={i < drag.cards.length - 1} />
				</div>
			{/each}
		</div>
	{/if}

	<!-- Deal Animation Overlay -->
	{#if dealAnim}
		{#each dealAnim.cards as da, i}
			{#if !da.done}
				<div
					class="deal-anim"
					class:deal-animating={da.started}
					style="left: {dealAnim.fromX}px; top: {dealAnim.fromY}px; --deal-tx: {da.toX - dealAnim.fromX}px; --deal-ty: {da.toY - dealAnim.fromY}px;"
				>
					<CardComponent card={da.card} />
				</div>
			{/if}
		{/each}
	{/if}

	<!-- Move Animation Overlay -->
	{#if moveAnim}
		<div
			class="move-anim"
			class:animating={moveAnim.started}
			style="left: {moveAnim.fromX}px; top: {moveAnim.fromY}px; --move-tx: {moveAnim.toX - moveAnim.fromX}px; --move-ty: {moveAnim.toY - moveAnim.fromY}px;"
		>
			{#each moveAnim.cards as card, i}
				<div class="drag-card" style="top: calc({i} * var(--card-compact-h, 24px));">
					<CardComponent {card} compact={i < moveAnim.cards.length - 1} />
				</div>
			{/each}
		</div>
	{/if}

	<!-- Suit Completion Animation Overlay -->
	{#if suitAnim}
		<div
			class="suit-anim"
			class:animating={suitAnim.started}
			style="left: {suitAnim.fromX}px; top: {suitAnim.fromY}px; --suit-tx: {suitAnim.toX - suitAnim.fromX}px; --suit-ty: {suitAnim.toY - suitAnim.fromY}px;"
		>
			{#each suitAnim.cards as card, i}
				<div class="drag-card" style="top: calc({i} * var(--card-compact-h, 24px));">
					<CardComponent {card} compact={i < suitAnim.cards.length - 1} />
				</div>
			{/each}
		</div>
	{/if}

	<!-- Win animation + overlay -->
	<WinAnimation active={game.won} />
	{#if showWinModal}
		<div class="win-overlay">
			<div class="win-box">
				<h2>You Win!</h2>
				<button class="btn" onclick={onNewGame}>New Game</button>
			</div>
		</div>
	{/if}
</div>

<!-- Controls -->
{#if !game.won}
<div class="controls">
	<button class="btn btn-secondary" onclick={findHint} disabled={game.won}><span class="btn-icon">💡</span> Hint</button>
	<button class="btn btn-secondary" onclick={onUndo} disabled={history.length === 0}><span class="btn-icon">&#8634;</span> Undo</button>
	<div class="play-menu-wrapper">
		<button class="btn" onclick={() => { showPlayMenu = !showPlayMenu; pendingAction = null; }}><span class="btn-icon">&#9654;&#65039;</span> Play</button>
		{#if showPlayMenu}
			<div class="play-backdrop" onclick={() => { showPlayMenu = false; pendingAction = null; }}></div>
			<div class="play-menu">
				{#if pendingAction}
					<span class="confirm-label">Are you sure?</span>
					<div class="confirm-buttons">
						<button class="confirm-btn yes" onclick={onConfirm}>Yes</button>
						<button class="confirm-btn no" onclick={onCancelConfirm}>No</button>
					</div>
				{:else}
					<button class="menu-item" onclick={() => history.length === 0 ? onNewGame() : confirmAction(onNewGame)}><span class="menu-icon">&#9654;</span> New Game</button>
					<button class="menu-item" onclick={() => history.length === 0 ? onReset() : confirmAction(onReset)}><span class="menu-icon">&#8634;</span> Reset</button>
					<button class="menu-item" onclick={() => confirmAction(() => { window.location.href = base || '/'; })}><span class="menu-icon">&#10005;</span> Quit</button>
					<button class="menu-item cancel" onclick={() => { showPlayMenu = false; }}>Cancel</button>
				{/if}
			</div>
		{/if}
	</div>
</div>
{/if}

<style>
	.board {
		--card-w: 60px;
		--card-h: 86px;
		--card-compact-h: 24px;
		--card-gap: 4px;
		--card-rank-fs: 24px;
		--card-suit-fs: 20px;
		--card-big-suit-fs: 40px;
		--card-face-fs: 52px;

		position: relative;
		max-width: 750px;
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

	.title-spi {
		color: #e94560;
	}

	.title-der {
		color: #ff8a65;
	}

	.stats {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.stat {
		color: var(--text-primary);
		font-size: 1.45rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.stat-divider {
		width: 1px;
		height: 1.2rem;
		background: var(--text-muted);
	}

	.info-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		gap: 1rem;
	}

	.completed {
		display: flex;
		gap: 4px;
		font-size: 1.3rem;
	}

	.suit-marker {
		opacity: 0.2;
		color: #888;
	}

	.suit-marker.filled {
		opacity: 1;
		color: var(--gold, #f1c40f);
	}

	.slot {
		width: var(--card-w, 60px);
		height: var(--card-h, 86px);
		border: 2px dashed #445;
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.03);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		padding: 0;
		color: #556;
		position: relative;
	}

	.slot:hover:not(:disabled) {
		border-color: #667;
	}

	.slot:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.stock-fan {
		--stock-fan-offset: 6px;
		position: relative;
		width: calc(var(--card-w, 60px) + 4 * var(--stock-fan-offset));
		height: var(--card-h, 86px);
		cursor: pointer;
		flex-shrink: 0;
	}

	.stock-fan.stock-disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.stock-card {
		position: absolute;
		top: 0;
	}

	.stock-card:not(:last-child) {
		width: var(--stock-fan-offset, 6px);
		overflow: hidden;
	}

	.tableau {
		display: flex;
		gap: var(--card-gap, 4px);
		justify-content: center;
	}

	/* Drag overlay */
	.drag-overlay {
		position: fixed;
		pointer-events: none;
		z-index: 1000;
		width: var(--card-w, 60px);
	}

	.drag-card {
		position: absolute;
		left: 0;
	}

	/* Move animation */
	.move-anim {
		position: fixed;
		pointer-events: none;
		z-index: 999;
		width: var(--card-w, 60px);
		transform: translate(0, 0);
		transition: none;
	}

	.move-anim.animating {
		transform: translate(var(--move-tx), var(--move-ty));
		transition: transform 200ms ease-out;
	}

	/* Deal animation */
	.deal-anim {
		position: fixed;
		pointer-events: none;
		z-index: 998;
		width: var(--card-w, 60px);
		transform: translate(0, 0);
		transition: none;
	}

	.deal-anim.deal-animating {
		transform: translate(var(--deal-tx), var(--deal-ty));
		transition: transform 150ms ease-out;
	}

	/* Suit completion animation */
	.suit-anim {
		position: fixed;
		pointer-events: none;
		z-index: 999;
		width: var(--card-w, 60px);
		transform: translate(0, 0) scale(1);
		opacity: 1;
		transition: none;
	}

	.suit-anim.animating {
		transform: translate(var(--suit-tx), var(--suit-ty)) scale(0.2);
		opacity: 0;
		transition: transform 500ms ease-in-out, opacity 400ms ease-in 100ms;
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
		gap: 0.35rem;
	}

	.btn-icon {
		font-size: 1.1rem;
		line-height: 1;
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

	.play-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 50;
	}

	.play-menu {
		position: fixed;
		bottom: 50%;
		left: 50%;
		transform: translate(-50%, 50%);
		background: var(--bg-card);
		border-radius: 12px;
		box-shadow: var(--shadow);
		border: 1.5px solid rgba(255, 255, 255, 0.7);
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
		text-align: left;
		cursor: pointer;
		text-decoration: none;
		transition: background 0.15s;
	}

	.menu-icon {
		display: inline-block;
		width: 1.5rem;
		text-align: center;
		margin-right: 0.5rem;
	}

	.menu-item:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	.menu-item.cancel {
		color: var(--text-primary);
		text-align: center;
		border-top: 1px solid rgba(255, 255, 255, 0.5);
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
		background: transparent;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.win-box {
		background: var(--bg-card);
		padding: 3rem;
		border-radius: var(--radius);
		text-align: center;
		box-shadow: var(--shadow);
		border: 1.5px solid rgba(255, 255, 255, 0.7);
	}

	.win-box h2 {
		font-size: 2.5rem;
		margin-bottom: 1.5rem;
		color: var(--gold);
	}

	@media (max-width: 600px) {
		.board {
			--card-w: calc((100vw - 0.5rem - 9 * 3px) / 10);
			--card-h: calc(var(--card-w) * 86 / 60);
			--card-compact-h: calc(var(--card-w) * 0.4);
			--card-gap: 3px;
			--card-rank-fs: calc(var(--card-w) * 0.38);
			--card-suit-fs: calc(var(--card-w) * 0.32);
			--card-big-suit-fs: calc(var(--card-w) * 0.65);
			--card-face-fs: calc(var(--card-w) * 0.85);

			max-width: 100%;
			padding: 0.25rem;
		}

		.info-bar {
			margin-bottom: 0.5rem;
			gap: 0.5rem;
		}

		.completed {
			font-size: 1rem;
			gap: 2px;
		}

		.stock-fan {
			--stock-fan-offset: 4px;
			width: calc(var(--card-w) + 4 * var(--stock-fan-offset));
		}
	}
</style>
