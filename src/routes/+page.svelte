<script lang="ts">
	import { STATUS_LABELS, statusClass, formatDate, type SampleStatus } from '#lib/format';

	let { data } = $props();

	const tiles: { key: SampleStatus; href: string }[] = [
		{ key: 'RECEIVED', href: '/samples?status=RECEIVED' },
		{ key: 'IN_TESTING', href: '/samples?status=IN_TESTING' },
		{ key: 'PENDING_REVIEW', href: '/samples?status=PENDING_REVIEW' },
		{ key: 'RETEST', href: '/samples?status=RETEST' },
		{ key: 'APPROVED', href: '/samples?status=APPROVED' },
		{ key: 'REJECTED', href: '/samples?status=REJECTED' }
	];

	const openCount = $derived(
		(data.counts.RECEIVED ?? 0) +
			(data.counts.IN_TESTING ?? 0) +
			(data.counts.PENDING_REVIEW ?? 0) +
			(data.counts.RETEST ?? 0)
	);
</script>

<div class="page-head">
	<div>
		<h1>Laboratory dashboard</h1>
		<div class="sub">
			Goods inward → testing → review → certificate of analysis.
			{openCount} sample{openCount === 1 ? '' : 's'} still open.
		</div>
	</div>
	<a class="btn" href="/receiving">Register goods inward</a>
</div>

<div class="grid-4">
	{#each tiles as tile (tile.key)}
		<a class="kpi" href={tile.href} style="text-decoration: none;">
			<div class="label">{STATUS_LABELS[tile.key]}</div>
			<div class="value">{data.counts[tile.key] ?? 0}</div>
		</a>
	{/each}
</div>

<div class="panel" style="margin-top: 1.1rem;">
	<h2>Most recent samples</h2>
	{#if data.recent.length === 0}
		<p class="empty">
			No samples yet. Register one on the <a href="/receiving">goods inward</a> page, or load the
			demo set with <span class="mono">npm run db:demo:local</span>.
		</p>
	{:else}
		<table>
			<thead>
				<tr>
					<th>Sample ID</th>
					<th>Material</th>
					<th>Supplier</th>
					<th>Lot</th>
					<th>Received</th>
					<th>Status</th>
					<th class="num">Results</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each data.recent as s (s.id)}
					<tr>
						<td class="mono"><a href={`/samples/${s.id}`}>{s.sampleCode}</a></td>
						<td>
							{s.materialName}
							<div class="small muted">{s.materialCode} · {s.category}</div>
						</td>
						<td>{s.supplierName ?? '-'}</td>
						<td>{s.externalLotNo ?? '-'}</td>
						<td>{formatDate(s.receivedDate)}</td>
						<td><span class="badge {statusClass(s.status)}">{STATUS_LABELS[s.status]}</span></td>
						<td class="num">
							{s.resultCount}/{s.specCount}
							{#if s.failCount > 0}
								<span class="badge fail">{s.failCount} fail</span>
							{/if}
						</td>
						<td class="actions"><a href={`/samples/${s.id}`}>Open</a></td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>
