import { getStatusCounts, listSamples } from '#lib/server/lims';

export const load = async () => {
	const [counts, recent] = await Promise.all([getStatusCounts(), listSamples({ limit: 8 })]);
	return { counts, recent };
};
