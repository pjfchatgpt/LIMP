<script lang="ts">
	import {
		STATUS_LABELS,
		statusClass,
		verdictClass,
		VERDICT_LABELS,
		formatDate,
		formatDateTimeUtc,
		formatNumber
	} from '#lib/format';

	let { data, form } = $props();

	const errors = $derived(form?.errors ?? []);

	const unanswered = $derived(data.lines.filter((l) => l.enteredAt === null));
	const failures = $derived(data.lines.filter((l) => l.verdict === 'FAIL'));
	// Mirrors the server rule: every line must be recorded. A failing line is
	// approvable only with a justification comment, which the server enforces.
	const canApprove = $derived(data.lines.length > 0 && unanswered.length === 0);
</script>

<div class="page-head">
	<div>
		<h1>Review — <span class="mono">{data.sample.sampleCode}</span></h1>
		<div class="sub">
			{data.material.name} · {data.material.code} · current status
			<span class="badge {statusClass(data.sample.status)}">{STATUS_LABELS[data.sample.status]}</span>
		</div>
	</div>
	<div class="btn-row">
		<a class="btn secondary" href={`/samples/${data.sample.id}`}>Back to sample</a>
		<a class="btn secondary" href={`/samples/${data.sample.id}/results`}>Open result entry</a>
		{#if data.sample.status === 'APPROVED'}
			<a class="btn" href={`/samples/${data.sample.id}/coa`}>View COA</a>
		{/if}
	</div>
</div>

{#if errors.length > 0}
	<div class="errors">
		<strong>The decision was not recorded:</strong>
		<ul>
			{#each errors as e, i (i)}
				<li>{e}</li>
			{/each}
		</ul>
	</div>
{/if}

<div class="panel">
	<h2>Recorded results against specification</h2>
	{#if data.lines.length === 0}
		<p class="empty">No specification is defined for this material.</p>
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
					<th>Remark</th>
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
								<span class="muted">not recorded</span>
							{/if}
						</td>
						<td>{line.unit ?? '-'}</td>
						<td>
							<span class="badge {verdictClass(line.verdict)}">{VERDICT_LABELS[line.verdict]}</span>
						</td>
						<td class="small">{line.method ?? '-'}</td>
						<td class="small">{line.analystName ?? '-'}</td>
						<td class="small">{line.remark ?? ''}</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<p class="small muted" style="margin-top: 0.6rem;">
			{data.lines.length} line(s) ·
			{data.lines.length - unanswered.length} recorded ·
			{unanswered.length} blank ·
			{failures.length} out of specification
		</p>
	{/if}
</div>

<form method="POST" action="?/decide">
	<div class="panel">
		<h2>Decision</h2>
		<div class="grid-2">
			<div class="field">
				<label for="decidedBy">Decided by</label>
				<select id="decidedBy" name="decidedBy" required>
					<option value="">— select —</option>
					{#each data.users as u (u.id)}
						<option value={u.name}>
							{u.name}{u.nameTh ? ` (${u.nameTh})` : ''} — {u.role}
						</option>
					{/each}
				</select>
				<span class="hint">The lab's workflow is: test by Chemist, verify by TM, approve by Lab Manager.</span>
			</div>
			<div class="field">
				<label for="comment">Comment</label>
				<input
					id="comment"
					name="comment"
					type="text"
					placeholder="required to reject, retest, or approve with deviation"
					value={form?.comment ?? ''}
				/>
			</div>
		</div>

		{#if failures.length > 0 && unanswered.length === 0}
			<p class="small muted">
				{failures.length} result(s) are out of specification. Approving them requires a
				justification comment; otherwise reject the sample or request a retest.
			</p>
		{/if}

		<div class="btn-row" style="margin-top: 0.5rem;">
			<button type="submit" name="action" value="APPROVE" disabled={!canApprove}>
				Approve
			</button>
			<button class="warn" type="submit" name="action" value="RETEST">Request retest</button>
			<button class="danger" type="submit" name="action" value="REJECT">Reject</button>
		</div>
		{#if !canApprove}
			<p class="small muted">
				Approve is disabled because {unanswered.length} test line(s) have no recorded result.
			</p>
		{/if}
	</div>
</form>

{#if data.approvals.length > 0}
	<div class="panel">
		<h2>Decision history</h2>
		<table>
			<thead><tr><th>When</th><th>Action</th><th>By</th><th>Role</th><th>Comment</th></tr></thead>
			<tbody>
				{#each data.approvals as a (a.id)}
					<tr>
						<td class="small">{formatDateTimeUtc(a.decidedAt)}</td>
						<td>
							<span class="badge {a.action === 'APPROVE' ? 'pass' : a.action === 'REJECT' ? 'fail' : 'retest'}">
								{a.action}
							</span>
						</td>
						<td>{a.decidedBy}</td>
						<td class="small">{a.decidedRole ?? '-'}</td>
						<td>{a.comment ?? '-'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<p class="small muted">Received {formatDate(data.sample.receivedDate)}.</p>
