<script lang="ts">
	import { untrack } from 'svelte';
	import type { PageProps } from './$types';
	import { evaluateResult, specFromRow } from '#lib/spec';
	import { verdictClass, VERDICT_LABELS, formatNumber } from '#lib/format';

	let { data, form }: PageProps = $props();

	const errors = $derived(form?.errors ?? []);

	// Local mirror of the entered values, so PASS/FAIL updates as the analyst types.
	// Seeded once with untrack: the page reloads after a save, so the props never
	// change underneath a mounted component.
	let values = $state<Record<number, string>>(
		untrack(() =>
			Object.fromEntries(
				data.lines.map((l) => [
					l.specificationId,
					l.resultValue === null ? '' : String(l.resultValue)
				])
			)
		)
	);
	let texts = $state<Record<number, string>>(
		untrack(() => Object.fromEntries(data.lines.map((l) => [l.specificationId, l.resultText ?? ''])))
	);

	// Same engine the server uses when saving - no second implementation.
	const evaluations = $derived(
		data.lines.map((l) =>
			evaluateResult({
				spec: specFromRow(l),
				resultValue: values[l.specificationId] ?? '',
				resultText: texts[l.specificationId] ?? '',
				resultType: l.resultType as 'NUMERIC' | 'TEXT'
			})
		)
	);

	const summary = $derived.by(() => {
		const counts = { PASS: 0, FAIL: 0, NA: 0 };
		for (const e of evaluations) counts[e.verdict] += 1;
		return counts;
	});
</script>

<div class="page-head">
	<div>
		<h1>Result entry — <span class="mono">{data.sample.sampleCode}</span></h1>
		<div class="sub">
			{data.material.name} · {data.material.code} · lot
			<span class="mono">{data.sample.externalLotNo ?? '-'}</span>
		</div>
	</div>
	<div class="btn-row">
		<a class="btn secondary" href={`/samples/${data.sample.id}`}>Back to sample</a>
	</div>
</div>

{#if errors.length > 0}
	<div class="errors">
		<strong>Please correct the following:</strong>
		<ul>
			{#each errors as e, i (i)}
				<li>{e}</li>
			{/each}
		</ul>
	</div>
{/if}

<div class="panel">
	<strong>Live preview:</strong>
	<span class="badge pass">{summary.PASS} pass</span>
	<span class="badge fail">{summary.FAIL} fail</span>
	<span class="badge na">{summary.NA} not evaluated</span>
	<span class="small muted">
		Verdicts are recalculated on the server when you save, using the same rules.
	</span>
</div>

{#if data.lines.length === 0}
	<div class="panel">
		<p class="empty">
			No specification exists for this material. Define specifications before entering results.
		</p>
	</div>
{:else}
	<form method="POST">
		<div class="panel">
			<h2>Analysis details</h2>
			<div class="grid-2">
				<div class="field">
					<label for="analystName">Analyst</label>
					<select id="analystName" name="analystName" required>
						<option value="">— select —</option>
						{#each data.users as u (u.id)}
							<option value={u.name}>{u.name}{u.nameTh ? ` (${u.nameTh})` : ''}</option>
						{/each}
					</select>
				</div>
				<div class="field">
					<label for="analysedDate">Analysis date</label>
					<input id="analysedDate" name="analysedDate" type="date" required value={data.today} />
				</div>
				<div class="field">
					<label for="method">Method override <span class="muted">(optional)</span></label>
					<input
						id="method"
						name="method"
						type="text"
						placeholder="defaults to the method on each specification"
					/>
				</div>
			</div>
		</div>

		<div class="panel">
			<h2>Results</h2>
			<table>
				<thead>
					<tr>
						<th>#</th>
						<th>Parameter</th>
						<th>Specification</th>
						<th>Result</th>
						<th>Verdict</th>
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
								{#if line.instrument}<div class="small muted">{line.instrument}</div>{/if}
							</td>
							<td>
								{line.specText}
								<div class="small muted">{line.unit ?? '-'}</div>
							</td>
							<td>
								{#if line.resultType === 'NUMERIC'}
									<input
										type="number"
										step="any"
										name={`value_${line.specificationId}`}
										bind:value={values[line.specificationId]}
										aria-label={`Result for ${line.parameterName}`}
									/>
								{:else}
									<input
										type="text"
										name={`text_${line.specificationId}`}
										bind:value={texts[line.specificationId]}
										placeholder="qualitative result"
										aria-label={`Result for ${line.parameterName}`}
									/>
								{/if}
							</td>
							<td>
								<span class="badge {verdictClass(evaluations[i].verdict)}">
									{VERDICT_LABELS[evaluations[i].verdict]}
								</span>
								<div class="small muted">{evaluations[i].message}</div>
								{#if line.resultValue !== null || line.resultText}
									<div class="small muted">
										last saved:
										{line.resultValue !== null
											? formatNumber(line.resultValue, 4)
											: line.resultText}
									</div>
								{/if}
							</td>
							<td>
								<input
									type="text"
									name={`remark_${line.specificationId}`}
									value={line.remark ?? ''}
									placeholder="optional"
									aria-label={`Remark for ${line.parameterName}`}
								/>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="btn-row">
			<button type="submit">Save results</button>
			<a class="btn secondary" href={`/samples/${data.sample.id}`}>Cancel</a>
		</div>
	</form>
{/if}
