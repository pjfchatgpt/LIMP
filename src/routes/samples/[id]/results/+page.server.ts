import { error, fail, redirect } from '@sveltejs/kit';
import { getSample, listUsers, saveResults, todayIso, type ResultEntry } from '#lib/server/lims';

export const load = async ({ params }: { params: { id: string } }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Invalid sample id.');

	const detail = await getSample(id);
	if (!detail) error(404, `Sample ${params.id} was not found.`);

	const users = await listUsers();
	return { ...detail, users, today: todayIso() };
};

export const actions = {
	default: async ({ request, params }: { request: Request; params: { id: string } }) => {
		const id = Number(params.id);
		const detail = await getSample(id);
		if (!detail) error(404, `Sample ${params.id} was not found.`);

		const form = await request.formData();
		const analystName = String(form.get('analystName') ?? '').trim();
		const analysedDate = String(form.get('analysedDate') ?? '').trim();
		const method = String(form.get('method') ?? '').trim();

		const errors: string[] = [];
		if (!analystName) errors.push('Select the analyst who performed the work.');
		if (!/^\d{4}-\d{2}-\d{2}$/.test(analysedDate)) errors.push('Analysis date is required.');

		// Build entries from the specification ids this sample actually has, so a
		// tampered form cannot introduce parameters that were never specified.
		const entries: ResultEntry[] = detail.lines.map((line) => ({
			specificationId: line.specificationId,
			value: String(form.get(`value_${line.specificationId}`) ?? '').trim(),
			text: String(form.get(`text_${line.specificationId}`) ?? '').trim(),
			remark: String(form.get(`remark_${line.specificationId}`) ?? '').trim()
		}));

		const anyEntered = entries.some((e) => e.value !== '' || e.text !== '');
		if (!anyEntered) errors.push('Enter at least one result.');

		if (errors.length > 0) {
			return fail(400, { errors });
		}

		await saveResults(id, entries, {
			analystName,
			analysedDate,
			method: method || undefined
		});

		redirect(303, `/samples/${id}?saved=1`);
	}
};
