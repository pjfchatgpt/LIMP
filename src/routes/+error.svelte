<script lang="ts">
	import { page } from '$app/state';
	import type { ErrorProps } from './$types';

	let { error }: ErrorProps = $props();
</script>

<main>
	<div class="panel">
		<h1>{page.status}</h1>
		<p>{error?.message ?? 'Something went wrong.'}</p>
		{#if error?.message?.includes('D1 binding')}
			<p class="small muted">
				Run <code>npm run db:migrate:local</code> and start the app with
				<code>npm run dev</code> so the local D1 binding is available. See README.md.
			</p>
		{/if}
		<p class="small muted">Requested path: <span class="mono">{page.url.pathname}</span></p>
		<p><a class="btn secondary" href="/">Back to dashboard</a></p>
	</div>
</main>
