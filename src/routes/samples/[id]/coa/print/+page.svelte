<script lang="ts">
	import CoaDocument from '#lib/components/CoaDocument.svelte';
	import { formatDateTimeUtc } from '#lib/format';

	let { data } = $props();

	const generatedAt = formatDateTimeUtc(new Date().toISOString());
</script>

<svelte:head>
	<title>COA {data.reportNo}</title>
	<!-- The print route opens in its own tab and sends itself to the print dialog. -->
	<script>
		window.addEventListener('load', () => setTimeout(() => window.print(), 150));
	</script>
</svelte:head>

{#if data.sample.status !== 'APPROVED'}
	<div class="errors">
		<strong>Draft — not approved.</strong>
		Current status is <strong>{data.sample.status}</strong>.
	</div>
{/if}

<CoaDocument
	detail={data}
	approval={data.approval}
	reportNo={data.reportNo}
	{generatedAt}
/>
