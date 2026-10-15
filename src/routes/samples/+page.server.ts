import { getStatusCounts, listSamples } from '#lib/server/lims';

export const load = async ({ url }: { url: URL }) => {
	const status = url.searchParams.get('status') ?? 'PENDING';
	const q = url.searchParams.get('q') ?? '';

	const [rows, counts] = await Promise.all([
		listSamples({ status, q }),
		getStatusCounts()
	]);

	return { rows, counts, status, q };
};
