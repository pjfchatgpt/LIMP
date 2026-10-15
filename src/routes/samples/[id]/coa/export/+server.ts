import { error } from '@sveltejs/kit';
import { getLatestApproval, getSample } from '#lib/server/lims';

/**
 * Machine-readable export of the certificate. Uses tab-separated values with a
 * UTF-8 BOM so Thai product names survive a round trip through Excel.
 */
function cell(value: unknown): string {
	if (value === null || value === undefined) return '';
	const s = String(value).replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
	return /["\t]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(cells: unknown[]): string {
	return cells.map(cell).join('\t');
}

export const GET = async ({ params }: { params: { id: string } }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Invalid sample id.');

	const detail = await getSample(id);
	if (!detail) error(404, `Sample ${params.id} was not found.`);
	const approval = await getLatestApproval(id);

	const lines: string[] = [];
	lines.push(row(['Report', `COA-${detail.sample.sampleCode}`]));
	lines.push(row(['Sample ID', detail.sample.sampleCode]));
	lines.push(row(['Status', detail.sample.status]));
	lines.push(row(['Material', detail.material.name]));
	lines.push(row(['Item code', detail.material.code]));
	lines.push(row(['Material type', detail.material.category]));
	lines.push(row(['Formulation', detail.material.formulation ?? '']));
	lines.push(row(['Supplier', detail.supplier?.name ?? '']));
	lines.push(row(['Lot / batch', detail.sample.externalLotNo ?? '']));
	lines.push(row(['Date received', detail.sample.receivedDate]));
	lines.push(row(['Quantity', detail.sample.quantity ?? '', detail.sample.quantityUnit ?? '']));
	lines.push(row([]));
	lines.push(
		row([
			'No.',
			'Parameter',
			'Sub-label',
			'Specification',
			'Result (numeric)',
			'Result (text)',
			'Unit',
			'Assessment',
			'Method',
			'Analyst',
			'Acknowledged (UTC)'
		])
	);
	detail.lines.forEach((l, i) => {
		lines.push(
			row([
				i + 1,
				l.parameterName,
				l.subLabel,
				l.specText,
				l.resultValue ?? '',
				l.resultText ?? '',
				l.unit ?? '',
				l.verdict,
				l.method ?? '',
				l.analystName ?? '',
				l.enteredAt ?? ''
			])
		);
	});
	lines.push(row([]));
	lines.push(row(['Approved by', approval?.decidedBy ?? '']));
	lines.push(row(['Role', approval?.decidedRole ?? '']));
	lines.push(row(['Approved at (UTC)', approval?.decidedAt ?? '']));

	return new Response(`\uFEFF${lines.join('\r\n')}\r\n`, {
		headers: {
			'content-type': 'text/tab-separated-values; charset=utf-8',
			'content-disposition': `attachment; filename="COA-${detail.sample.sampleCode}.tsv"`,
			'cache-control': 'no-store'
		}
	});
};
