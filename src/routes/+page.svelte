<script lang="ts">
	import { base } from '$app/paths';

	const games = [
		{ name: 'FreeCell', icon: '♠', href: `${base}/freecell`, available: true, color: '#e94560' },
		{ name: 'Solitaire', icon: '♦', href: `${base}/solitaire`, available: true, color: '#3498db' },
		{ name: 'Spider', icon: '♣', href: `${base}/spider`, available: true, color: '#2ecc71' },
		{ name: 'Sudoku', icon: '#', href: `${base}/sudoku`, available: true, color: '#f39c12' },
		{ name: 'Minesweeper', icon: '💣', href: `${base}/minesweeper`, available: true, color: '#9b59b6' }
	];
</script>

<div class="menu">
	<h1 class="title">Game Hub</h1>
	<p class="subtitle">Choose a game to play</p>

	<div class="grid">
		{#each games as game}
			{#if game.available}
				<a href={game.href} class="card">
					<span class="card-icon" style="color: {game.color}">{game.icon}</span>
					<span class="card-name">{game.name}</span>
				</a>
			{:else}
				<div class="card disabled">
					<span class="badge">Coming Soon</span>
					<span class="card-icon">{game.icon}</span>
					<span class="card-name">{game.name}</span>
				</div>
			{/if}
		{/each}
	</div>
</div>

<style>
	.menu {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: 2rem;
	}

	.title {
		font-size: 3rem;
		font-weight: 800;
		margin-bottom: 0.5rem;
	}

	.subtitle {
		color: var(--text-secondary);
		font-size: 1.1rem;
		margin-bottom: 3rem;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1.5rem;
		max-width: 500px;
		width: 100%;
	}

	@media (max-width: 500px) {
		.grid {
			gap: 1rem;
			max-width: 100%;
		}
	}

	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 2rem 1rem;
		background: var(--bg-secondary);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		transition: transform 0.2s, box-shadow 0.2s;
		position: relative;
	}

	.card:not(.disabled):hover {
		transform: translateY(-4px);
		box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
	}

	.card.disabled {
		opacity: 0.4;
		cursor: default;
	}

	.card-icon {
		font-size: 3rem;
	}

	.card-name {
		font-size: 1.2rem;
		font-weight: 600;
	}

	.badge {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		background: var(--text-muted);
		color: var(--text-primary);
		font-size: 0.65rem;
		padding: 0.2rem 0.5rem;
		border-radius: 999px;
		text-transform: uppercase;
		font-weight: 700;
		letter-spacing: 0.05em;
	}
</style>
