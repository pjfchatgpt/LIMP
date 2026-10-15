import { error } from '@sveltejs/kit';
import { getApprovals, getAuditTrail, getSample } from '#lib/server/lims';

export const load = async ({ params }: { params: { id: string } }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Invalid sample id.');

	const detail = await getSample(id);
	if (!detail) error(404, `Sample ${params.id} was not found.`);

	const [approvalRows, audit] = await Promise.all([getApprovals(id), getAuditTrail(id)]);

	return { ...detail, approvals: approvalRows, audit };
};
