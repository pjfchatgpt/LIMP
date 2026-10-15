import { error } from '@sveltejs/kit';
import { getLatestApproval, getSample } from '#lib/server/lims';

export const load = async ({ params }: { params: { id: string } }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Invalid sample id.');

	const detail = await getSample(id);
	if (!detail) error(404, `Sample ${params.id} was not found.`);

	const approval = await getLatestApproval(id);

	return { ...detail, approval, reportNo: `COA-${detail.sample.sampleCode}` };
};
