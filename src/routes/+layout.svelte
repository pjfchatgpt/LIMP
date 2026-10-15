<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';

	let { children } = $props();

	const nav = [
		{ href: '/', label: 'Dashboard' },
		{ href: '/samples', label: 'Samples' },
		{ href: '/receiving', label: 'Goods inward' }
	];

	function isActive(href: string): boolean {
		const path = page.url.pathname;
		if (href === '/') return path === '/';
		return path === href || path.startsWith(`${href}/`) || path.startsWith('/samples/');
	}
</script>

<header class="app-header">
	<div class="inner">
		<span class="brand"><a href="/">LIMS · Project Field</a></span>
		<nav>
			{#each nav as item (item.href)}
				<a href={item.href} aria-current={page.url.pathname === item.href ? 'page' : undefined}>
					{item.label}
				</a>
			{/each}
		</nav>
		<span class="env">Cloudflare Pages + D1</span>
	</div>
</header>

<main>
	{@render children()}
</main>
