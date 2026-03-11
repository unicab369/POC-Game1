<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>Game Hub</title>
</svelte:head>

{@render children()}
