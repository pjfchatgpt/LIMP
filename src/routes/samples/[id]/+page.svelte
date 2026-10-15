<script lang="ts">
	import { page } from '$app/state';
	import {
		STATUS_LABELS,
		statusClass,
		verdictClass,
		VERDICT_LABELS,
		formatDate,
		formatDateTimeUtc,
		formatNumber
	} from '#lib/format';

	let { data } = $props();

	const saved = $derived(page.url.searchParams.get('saved') === '1');
	const decided = $derived(page.url.searchParams.get('decided'));

	const pending = $derived(data.lines.filter((l) => l.verdict === 'NA' && l.enteredAt === null).length);
</script>

<div class="page-head">
	<div>
		<h1>
			<span class="mono">{data.sample.sampleCode}</span>
			<span class="badge {statusClass(data.sample.status)}">{STATUS_LABELS[data.sample.status]}</span>
		</h1>
		<div class="sub">
			{data.material.name} · {data.material.code} · {data.material.category}
		</div>
	</div>
	<div class="btn-row">
		<a class="btn" href={`/samples/${data.sample.id}/results`}>Enter results</a>
		<a class="btn secondary" href={`/samples/${data.sample.id}/review`}>Review</a>
		<a class="btn secondary" href={`/samples/${data.sample.id}/coa`}>COA</a>
	</div>
</div>

{#if saved}
	<div class="notice">Results saved. Verdicts were evaluated against the specification.</div>
{/if}
{#if decided}
	<div class="notice">Decision recorded: {decided}.</div>
{/if}

<div class="panel">
	<h2>Sample details</h2>
	<div class="grid-2">
		<dl class="meta">
			<dt>Material</dt>
			<dd>{data.material.name}</dd>
			<dt>Item code</dt>
			<dd class="mono">{data.material.code}</dd>
			<dt>Category</dt>
			<dd>{data.material.category}{data.material.formulation ? ` · ${data.material.formulation}` : ''}</dd>
			<dt>Supplier</dt>
			<dd>{data.supplier?.name ?? '— not recorded —'}</dd>
			<dt>External lot</dt>
			<dd class="mono">{data.sample.externalLotNo ?? '-'}</dd>
		</dl>
		<dl class="meta">
			<dt>Quantity</dt>
			<dd>
				{data.sample.quantity === null ? '-' : formatNumber(data.sample.quantity, 3)}
				{data.sample.quantityUnit ?? ''}
			</dd>
			<dt>Received</dt>
			<dd>{formatDate(data.sample.receivedDate)}</dd>
			<dt>Registered by</dt>
			<dd>{data.sample.createdBy ?? '-'}</dd>
			<dt>Registered at</dt>
			<dd>{formatDateTimeUtc(data.sample.createdAt)}</dd>
			<dt>Notes</dt>
			<dd>{data.sample.notes ?? '-'}</dd>
		</dl>
	</div>
</div>

<div class="panel">
	<h2>
		Test results
		<span class="small muted">
			— {data.lines.filter((l) => l.enteredAt !== null).length}/{data.lines.length} line(s) recorded
			{#if pending > 0}· {pending} still blank{/if}
		</span>
	</h2>
	{#if data.lines.length === 0}
		<p class="empty">
			No specification is defined for this material, so there is nothing to analyse. Add rows to
			<code>specifications</code> for this material.
		</p>
	{:else}
		<table>
			<thead>
				<tr>
					<th>#</th>
					<th>Parameter</th>
					<th>Specification</th>
					<th class="num">Result</th>
					<th>Unit</th>
					<th>Verdict</th>
					<th>Method</th>
					<th>Analyst</th>
					<th>Acknowledged</th>
				</tr>
			</thead>
			<tbody>
				{#each data.lines as line, i (line.specificationId)}
					<tr>
						<td class="num">{i + 1}</td>
						<td>
							{line.parameterName}
							{#if line.subLabel}<div class="small muted">{line.subLabel}</div>{/if}
						</td>
						<td>{line.specText}</td>
						<td class="num">
							{#if line.resultValue !== null}
								{formatNumber(line.resultValue, 4)}
							{:else if line.resultText}
								{line.resultText}
							{:else}
								<span class="muted">—</span>
							{/if}
						</td>
						<td>{line.unit ?? '-'}</td>
						<td>
							<span class="badge {verdictClass(line.verdict)}">
								{VERDICT_LABELS[line.verdict]}
							</span>
						</td>
						<td class="small">{line.method ?? '-'}</td>
						<td class="small">{line.analystName ?? '-'}</td>
						<td class="small">{line.enteredAt ? formatDateTimeUtc(line.enteredAt) : '-'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>

{#if data.approvals.length > 0}
	<div class="panel">
		<h2>Decisions</h2>
		<table>
			<thead>
				<tr><th>When</th><th>Action</th><th>By</th><th>Role</th><th>Comment</th></tr>
			</thead>
			<tbody>
				{#each data.approvals as a (a.id)}
					<tr>
						<td class="small">{formatDateTimeUtc(a.decidedAt)}</td>
						<td><span class="badge {a.action === 'APPROVE' ? 'pass' : a.action === 'REJECT' ? 'fail' : 'retest'}">{a.action}</span></td>
						<td>{a.decidedBy}</td>
						<td class="small">{a.decidedRole ?? '-'}</td>
						<td>{a.comment ?? '-'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

{#if data.audit.length > 0}
	<div class="panel">
		<h2>Audit trail</h2>
		<table>
			<thead><tr><th>When</th><th>Action</th><th>Actor</th><th>Detail</th></tr></thead>
			<tbody>
				{#each data.audit as a (a.id)}
					<tr>
						<td class="small">{formatDateTimeUtc(a.createdAt)}</td>
						<td class="small mono">{a.action}</td>
						<td class="small">{a.actor ?? '-'}</td>
						<td class="small">{a.detail ?? ''}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
