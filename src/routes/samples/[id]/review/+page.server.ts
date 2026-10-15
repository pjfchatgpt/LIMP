import { error, fail, redirect } from '@sveltejs/kit';
import { getApprovals, getSample, listUsers, recordDecision } from '#lib/server/lims';

export const load = async ({ params }: { params: { id: string } }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Invalid sample id.');

	const detail = await getSample(id);
	if (!detail) error(404, `Sample ${params.id} was not found.`);

	const [approvals, users] = await Promise.all([getApprovals(id), listUsers()]);
	return { ...detail, approvals, users };
};

export const actions = {
	decide: async ({ request, params }: { request: Request; params: { id: string } }) => {
		const id = Number(params.id);
		const detail = await getSample(id);
		if (!detail) error(404, `Sample ${params.id} was not found.`);

		const form = await request.formData();
		const action = String(form.get('action') ?? '').trim();
		const decidedBy = String(form.get('decidedBy') ?? '').trim();
		const comment = String(form.get('comment') ?? '').trim();

		const errors: string[] = [];
		if (!['APPROVE', 'REJECT', 'RETEST'].includes(action)) {
			errors.push('Unknown decision.');
		}
		if (!decidedBy) errors.push('Select the person making the decision.');

		const unanswered = detail.lines.filter((l) => l.enteredAt === null);
		const failures = detail.lines.filter((l) => l.verdict === 'FAIL');

		if (action === 'APPROVE' && errors.length === 0) {
			if (detail.lines.length === 0) {
				errors.push(
					'There is nothing to approve: no specification is defined for this material.'
				);
			}
			if (unanswered.length > 0) {
				errors.push(`Cannot approve: ${unanswered.length} test line(s) have no recorded result.`);
			}
			if (failures.length > 0 && comment === '') {
				errors.push(
					`Cannot approve: ${failures.length} result(s) are out of specification. ` +
						'Add a justification comment to approve with deviation, or reject the sample.'
				);
			}
		}
		if ((action === 'REJECT' || action === 'RETEST') && comment === '') {
			errors.push('A comment is required when rejecting or requesting a retest.');
		}

		if (errors.length > 0) return fail(400, { errors, action, decidedBy, comment });

		const users = await listUsers();
		const user = users.find((u) => u.name === decidedBy);

		await recordDecision(id, action as 'APPROVE' | 'REJECT' | 'RETEST', {
			decidedBy,
			role: user?.role ?? null,
			comment: comment || null
		});

		redirect(303, `/samples/${id}?decided=${action}`);
	}
};
