<script lang="ts">
	import { SUIT_SYMBOLS, RANK_NAMES, createDeck, shuffle, cardColor } from './utils';
	import type { Card } from './types';

	interface Props {
		active: boolean;
	}

	let { active }: Props = $props();

	let canvas: HTMLCanvasElement | undefined = $state();

	interface BouncingCard {
		x: number;
		y: number;
		vx: number;
		vy: number;
		rotation: number;
		vr: number;
		card: Card;
		w: number;
		h: number;
	}

	const GRAVITY = 0.6;
	const BOUNCE_DAMPEN = 0.75;
	const SIDE_DAMPEN = 0.8;
	const CARD_W = 70;
	const CARD_H = 100;
	const LAUNCH_INTERVAL = 200;
	const TOTAL_CARDS = 52;
	const BG_COLOR = '#1a1a2e';

	$effect(() => {
		if (!active || !canvas) return;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// Size canvas to window
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;

		// Fill background once — trail effect means we never clear
		ctx.fillStyle = BG_COLOR;
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		const deck = shuffle(createDeck());
		const cards: BouncingCard[] = [];
		let launched = 0;
		let animId: number;
		let launchTimer: ReturnType<typeof setInterval>;

		function launchCard() {
			if (launched >= TOTAL_CARDS) {
				clearInterval(launchTimer);
				return;
			}
			const card = deck[launched];
			launched++;
			cards.push({
				x: Math.random() * (canvas!.width - CARD_W),
				y: -CARD_H,
				vx: (Math.random() - 0.5) * 10,
				vy: Math.random() * 2 + 1,
				rotation: (Math.random() - 0.5) * 0.3,
				vr: (Math.random() - 0.5) * 0.08,
				card,
				w: CARD_W,
				h: CARD_H
			});
		}

		function drawCard(ctx: CanvasRenderingContext2D, bc: BouncingCard) {
			ctx.save();
			ctx.translate(bc.x + bc.w / 2, bc.y + bc.h / 2);
			ctx.rotate(bc.rotation);

			// Card body
			const r = 6;
			const x = -bc.w / 2;
			const y = -bc.h / 2;
			ctx.beginPath();
			ctx.roundRect(x, y, bc.w, bc.h, r);
			ctx.fillStyle = '#fff';
			ctx.fill();
			ctx.strokeStyle = '#999';
			ctx.lineWidth = 1;
			ctx.stroke();

			const color = cardColor(bc.card.suit) === 'red' ? '#d32f2f' : '#222';
			const rankStr = RANK_NAMES[bc.card.rank] ?? String(bc.card.rank);
			const suitStr = SUIT_SYMBOLS[bc.card.suit];

			// Rank top-left
			ctx.fillStyle = color;
			ctx.font = 'bold 16px sans-serif';
			ctx.textAlign = 'left';
			ctx.textBaseline = 'top';
			ctx.fillText(rankStr, x + 5, y + 4);

			// Suit below rank
			ctx.font = '14px sans-serif';
			ctx.fillText(suitStr, x + 5, y + 22);

			// Large center suit
			ctx.font = '36px sans-serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(suitStr, 0, 4);

			ctx.restore();
		}

		function step() {
			const W = canvas!.width;
			const H = canvas!.height;

			for (const bc of cards) {
				// Physics
				bc.vy += GRAVITY;
				bc.x += bc.vx;
				bc.y += bc.vy;
				bc.rotation += bc.vr;

				// Bounce bottom
				if (bc.y + bc.h > H) {
					bc.y = H - bc.h;
					bc.vy = -Math.abs(bc.vy) * BOUNCE_DAMPEN;
					bc.vr *= 0.9;
				}

				// Bounce sides
				if (bc.x < 0) {
					bc.x = 0;
					bc.vx = Math.abs(bc.vx) * SIDE_DAMPEN;
				} else if (bc.x + bc.w > W) {
					bc.x = W - bc.w;
					bc.vx = -Math.abs(bc.vx) * SIDE_DAMPEN;
				}

				// Draw (trail — no clearing)
				drawCard(ctx!, bc);
			}

			animId = requestAnimationFrame(step);
		}

		// Start launching cards
		launchCard();
		launchTimer = setInterval(launchCard, LAUNCH_INTERVAL);

		// Start animation loop
		animId = requestAnimationFrame(step);

		return () => {
			cancelAnimationFrame(animId);
			clearInterval(launchTimer);
		};
	});
</script>

{#if active}
	<canvas bind:this={canvas} class="win-canvas"></canvas>
{/if}

<style>
	.win-canvas {
		position: fixed;
		inset: 0;
		z-index: 90;
		pointer-events: none;
	}
</style>
