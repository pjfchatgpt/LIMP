<script lang="ts">
	import CoaDocument from '#lib/components/CoaDocument.svelte';
	import { formatDateTimeUtc } from '#lib/format';

	let { data } = $props();

	const approved = $derived(data.sample.status === 'APPROVED');
	const generatedAt = formatDateTimeUtc(new Date().toISOString());
</script>

<div class="page-head no-print">
	<div>
		<h1>Certificate of analysis</h1>
		<div class="sub">Report {data.reportNo} · {data.material.name}</div>
	</div>
	<div class="btn-row">
		<a class="btn secondary" href={`/samples/${data.sample.id}`}>Back to sample</a>
		<a class="btn secondary" href={`/samples/${data.sample.id}/coa/export`}>Export CSV</a>
		<a class="btn" href={`/samples/${data.sample.id}/coa/print`} target="_blank" rel="noopener">
			Print / PDF
		</a>
	</div>
</div>

{#if !approved}
	<div class="errors no-print">
		<strong>Draft — not approved.</strong>
		Current status is <strong>{data.sample.status}</strong>. This document is not a valid certificate
		until a lab manager approves the sample on the review page.
	</div>
{/if}

<CoaDocument
	detail={data}
	approval={data.approval}
	reportNo={data.reportNo}
	{generatedAt}
/>
