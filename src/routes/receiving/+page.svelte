<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const errors = $derived(form?.errors ?? []);

	// Defaults keep the field types concrete and re-populate what was typed when
	// validation sent the form back.
	const blankValues = {
		materialId: '',
		supplierId: '',
		externalLotNo: '',
		quantity: '',
		quantityUnit: 'kg',
		receivedDate: '',
		createdBy: '',
		notes: ''
	};
	const v = $derived({ ...blankValues, ...(form?.values ?? {}) });
	const groups = $derived.by(() => {
		const map = new Map<string, typeof data.materials>();
		for (const m of data.materials) {
			const list = map.get(m.category) ?? [];
			list.push(m);
			map.set(m.category, list);
		}
		return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
	});

	const categoryLabel: Record<string, string> = {
		RM: 'Raw material (RM)',
		WIP: 'Work in process (WIP)',
		FG: 'Finished goods (FG)'
	};
</script>

<div class="page-head">
	<div>
		<h1>Goods inward</h1>
		<div class="sub">
			Register an incoming consignment. The sample receives an internal ID and the status
			<span class="mono">RECEIVED</span>.
		</div>
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

<form method="POST" class="panel">
	<h2>Consignment details</h2>

	<div class="grid-2">
		<div class="field">
			<label for="supplierId">Supplier</label>
			<select id="supplierId" name="supplierId">
				<option value="">— not recorded —</option>
				{#each data.suppliers as s (s.id)}
					<option value={s.id} selected={String(s.id) === v.supplierId}>{s.name}</option>
				{/each}
			</select>
			<span class="hint">External supplier of the consignment.</span>
		</div>

		<div class="field">
			<label for="materialId">Material <span class="muted">(name / code)</span></label>
			<select id="materialId" name="materialId" required>
				<option value="">— select a material —</option>
				{#each groups as [category, list] (category)}
					<optgroup label={categoryLabel[category] ?? category}>
						{#each list as m (m.id)}
							<option value={m.id} selected={String(m.id) === v.materialId}>
								{m.name} · {m.code}
							</option>
						{/each}
					</optgroup>
				{/each}
			</select>
			<span class="hint">Determines which tests and limits apply (RM / WIP / FG).</span>
		</div>

		<div class="field">
			<label for="externalLotNo">External lot number</label>
			<input
				id="externalLotNo"
				name="externalLotNo"
				type="text"
				required
				placeholder="e.g. 20260411"
				value={v.externalLotNo}
			/>
			<span class="hint">As printed on the supplier's documents.</span>
		</div>

		<div class="field">
			<label for="receivedDate">Received date</label>
			<input
				id="receivedDate"
				name="receivedDate"
				type="date"
				required
				value={v.receivedDate || data.today}
			/>
		</div>

		<div class="field">
			<label for="quantity">Quantity</label>
			<input
				id="quantity"
				name="quantity"
				type="number"
				step="any"
				min="0"
				placeholder="e.g. 2000"
				value={v.quantity}
			/>
		</div>

		<div class="field">
			<label for="quantityUnit">Unit</label>
			<input
				id="quantityUnit"
				name="quantityUnit"
				type="text"
				required
				placeholder="kg / L / units"
				value={v.quantityUnit}
			/>
		</div>

		<div class="field">
			<label for="createdBy">Registered by</label>
			<select id="createdBy" name="createdBy">
				<option value="">— not recorded —</option>
				{#each data.users as u (u.id)}
					<option value={u.name} selected={u.name === v.createdBy}>
						{u.name}{u.nameTh ? ` (${u.nameTh})` : ''} — {u.role}
					</option>
				{/each}
			</select>
			<span class="hint">
				Placeholder for authentication; swap for your identity provider.
			</span>
		</div>

		<div class="field">
			<label for="notes">Notes</label>
			<input
				id="notes"
				name="notes"
				type="text"
				placeholder="optional"
				value={v.notes}
			/>
		</div>
	</div>

	<div class="btn-row" style="margin-top: 0.6rem;">
		<button type="submit">Register sample</button>
		<a class="btn secondary" href="/samples">Cancel</a>
	</div>
</form>
