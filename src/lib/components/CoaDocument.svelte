<script lang="ts">
	/**
	 * The printable certificate. Shared by the on-screen COA route and the
	 * dedicated print route so both always render the same document.
	 */
	import { VERDICT_LABELS, formatDate, formatDateTimeUtc, formatNumber } from '#lib/format';
	import type { SampleDetail } from '#lib/types';

	let {
		detail,
		approval,
		reportNo,
		generatedAt
	}: {
		detail: SampleDetail;
		approval: { decidedBy: string; decidedRole: string | null; decidedAt: string } | null;
		reportNo: string;
		generatedAt: string;
	} = $props();

	const approved = $derived(detail.sample.status === 'APPROVED');
	const overall = $derived(
		detail.lines.some((l) => l.verdict === 'FAIL')
			? 'FAIL'
			: detail.lines.length > 0 && detail.lines.every((l) => l.verdict === 'PASS')
				? 'PASS'
				: 'NA'
	);
	const analyst = $derived(detail.lines.find((l) => l.analystName)?.analystName ?? '—');
</script>

<div class="panel">
	<div style="display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
		<div>
			<div style="font-size: 1.05rem; font-weight: 600;">Laboratory — Project Field</div>
			<div class="small muted">Certificate of analysis</div>
		</div>
		<dl class="meta">
			<dt>Report no.</dt>
			<dd class="mono">{reportNo}</dd>
			<dt>Sample ID</dt>
			<dd class="mono">{detail.sample.sampleCode}</dd>
			<dt>Date of issue</dt>
			<dd>{approved && approval ? formatDate(approval.decidedAt) : '— not issued —'}</dd>
		</dl>
	</div>
</div>

<div class="panel">
	<h2>Sample</h2>
	<div class="grid-2">
		<dl class="meta">
			<dt>Material</dt>
			<dd>{detail.material.name}</dd>
			<dt>Item code</dt>
			<dd class="mono">{detail.material.code}</dd>
			<dt>Material type</dt>
			<dd>{detail.material.category}</dd>
			<dt>Formulation</dt>
			<dd>{detail.material.formulation ?? '-'}</dd>
		</dl>
		<dl class="meta">
			<dt>Supplier</dt>
			<dd>{detail.supplier?.name ?? '-'}</dd>
			<dt>Lot / batch no.</dt>
			<dd class="mono">{detail.sample.externalLotNo ?? '-'}</dd>
			<dt>Date received</dt>
			<dd>{formatDate(detail.sample.receivedDate)}</dd>
			<dt>Quantity</dt>
			<dd>
				{detail.sample.quantity === null ? '-' : formatNumber(detail.sample.quantity, 3)}
				{detail.sample.quantityUnit ?? ''}
			</dd>
		</dl>
	</div>
</div>

<div class="panel">
	<h2>Results of analysis</h2>
	{#if detail.lines.length === 0}
		<p class="empty">No test results recorded.</p>
	{:else}
		<table>
			<thead>
				<tr>
					<th>No.</th>
					<th>Parameter</th>
					<th>Specification</th>
					<th class="num">Result</th>
					<th>Unit</th>
					<th>Assessment</th>
					<th>Method</th>
				</tr>
			</thead>
			<tbody>
				{#each detail.lines as line, i (line.specificationId)}
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
								—
							{/if}
						</td>
						<td>{line.unit ?? '-'}</td>
						<td>{VERDICT_LABELS[line.verdict]}</td>
						<td class="small">{line.method ?? '-'}</td>
					</tr>
				{/each}
			</tbody>
			<tfoot>
				<tr>
					<td colspan="3"><strong>Overall assessment</strong></td>
					<td colspan="4"><strong>{overall}</strong></td>
				</tr>
			</tfoot>
		</table>
	{/if}
	{#if detail.sample.notes}
		<p class="small">Remark: {detail.sample.notes}</p>
	{/if}
</div>

<div class="panel">
	<h2>Authorisation</h2>
	{#if approved && approval}
		<div style="display: flex; gap: 3rem; flex-wrap: wrap;">
			<div>
				<div class="small muted">Analysed by</div>
				<div>{analyst}</div>
				<div class="small muted">Chemist</div>
			</div>
			<div>
				<div class="small muted">Approved by</div>
				<div
					style="font-size: 1.05rem; border-bottom: 1px solid var(--line-strong); padding-bottom: 2px; min-width: 14rem;"
				>
					{approval.decidedBy}
				</div>
				<div class="small muted">
					{approval.decidedRole ?? 'LAB_MANAGER'} · {formatDateTimeUtc(approval.decidedAt)}
				</div>
			</div>
		</div>
	{:else}
		<p class="empty">
			Not approved. The signature block is produced from the recorded approval decision and its
			timestamp.
		</p>
	{/if}
</div>

<p class="small muted">
	This report relates only to the sample as received. Results are assessed against the specification
	stored in the LIMS at the time of analysis. Generated {generatedAt}.
</p>
