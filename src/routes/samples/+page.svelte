<script lang="ts">
	import { STATUS_LABELS, statusClass, formatDate, ALL_STATUSES } from '#lib/format';

	let { data } = $props();

	const filters = [
		{ value: 'PENDING', label: 'Open (all active)' },
		...ALL_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
		{ value: 'ALL', label: 'Everything' }
	];
</script>

<div class="page-head">
	<div>
		<h1>Samples</h1>
		<div class="sub">{data.rows.length} row(s) matching the current filter.</div>
	</div>
	<a class="btn" href="/receiving">Register goods inward</a>
</div>

<div class="panel">
	<form method="GET" class="grid-2" style="align-items: end;">
		<div class="field">
			<label for="status">Status</label>
			<select id="status" name="status">
				{#each filters as f (f.value)}
					<option value={f.value} selected={f.value === data.status}>{f.label}</option>
				{/each}
			</select>
		</div>
		<div class="field">
			<label for="q">Search</label>
			<input
				id="q"
				name="q"
				type="text"
				placeholder="sample ID, lot, material name or code"
				value={data.q}
			/>
		</div>
		<div class="field">
			<button type="submit">Apply</button>
		</div>
	</form>
</div>

<div class="panel">
	{#if data.rows.length === 0}
		<p class="empty">No samples match this filter.</p>
	{:else}
		<table>
			<thead>
				<tr>
					<th>Sample ID</th>
					<th>Material</th>
					<th>Supplier</th>
					<th>Lot / batch</th>
					<th>Received</th>
					<th>Status</th>
					<th class="num">Results</th>
					<th class="num">Fails</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each data.rows as s (s.id)}
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
						<td class="num">{s.resultCount}/{s.specCount}</td>
						<td class="num">
							{#if s.failCount > 0}
								<span class="badge fail">{s.failCount}</span>
							{:else}
								<span class="muted">0</span>
							{/if}
						</td>
						<td class="actions">
							<a href={`/samples/${s.id}/results`}>Results</a>
							·
							<a href={`/samples/${s.id}/review`}>Review</a>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>
