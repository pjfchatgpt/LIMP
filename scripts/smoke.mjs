#!/usr/bin/env node
/**
 * End-to-end smoke test.
 *
 * Drives the real HTTP routes of a running server (`npm run dev`) and asserts
 * the four business flows work end to end: goods inward, result entry with
 * PASS/FAIL evaluation, the review decision, and the certificate of analysis.
 *
 *   node scripts/smoke.mjs [baseUrl]
 *
 * It writes to the database it points at, so run it against a local dev
 * database. Every sample it creates carries a lot number starting with SMOKE-.
 * Exits non-zero if any check fails.
 */
const BASE = (process.argv[2] ?? process.env.LIMS_BASE_URL ?? 'http://127.0.0.1:8788').replace(
	/\/$/,
	''
);

let passed = 0;
const failures = [];

function check(name, condition, detail = '') {
	if (condition) {
		passed += 1;
		console.log(`  ok    ${name}`);
	} else {
		failures.push(name);
		console.log(`  FAIL  ${name}${detail ? `  [${detail}]` : ''}`);
	}
}

const HTML_HEADERS = { accept: 'text/html,application/xhtml+xml' };

async function get(path) {
	const res = await fetch(`${BASE}${path}`, { headers: HTML_HEADERS });
	return { status: res.status, text: await res.text(), url: res.url };
}

/**
 * Submit a form exactly as a browser does (`accept: text/html` is what makes
 * SvelteKit answer with a 303 instead of a JSON action envelope) and follow the
 * redirect, so one assertion covers the whole post/redirect/get cycle.
 */
async function postForm(path, fields) {
	const body = new URLSearchParams();
	for (const [k, v] of Object.entries(fields)) body.append(k, String(v));
	const res = await fetch(`${BASE}${path}`, {
		method: 'POST',
		body,
		headers: {
			...HTML_HEADERS,
			'content-type': 'application/x-www-form-urlencoded',
			// SvelteKit's CSRF check requires a same-origin Origin header on form posts.
			origin: BASE,
			referer: `${BASE}${path.split('?')[0]}`
		}
	});
	return { status: res.status, text: await res.text(), url: res.url };
}

const pathOf = (url) => new URL(url).pathname;
const searchOf = (url) => new URL(url).search;
const idFromUrl = (url) => (pathOf(url).match(/^\/samples\/(\d+)$/) ?? [])[1] ?? null;

function optionValueFor(html, label) {
	const pattern = new RegExp(`<option value="(\\d+)"[^>]*>([^<]*${label}[^<]*)</option>`, 'i');
	const m = html.match(pattern);
	return m ? m[1] : null;
}

/** Register a sample through the real form and return its id. */
async function registerSample({ materialCode, lot, quantity = '1500' }) {
	const page = await get('/receiving');
	const materialId = optionValueFor(page.text, materialCode);
	if (!materialId) return { error: `material ${materialCode} not offered` };
	const res = await postForm('/receiving', {
		materialId,
		supplierId: '',
		externalLotNo: lot,
		quantity,
		quantityUnit: 'kg',
		receivedDate: '2026-10-14',
		createdBy: 'Analyst 1',
		notes: 'smoke test'
	});
	return { id: idFromUrl(res.url), res };
}

/** Extract the result-entry inputs, paired with the text of their table row. */
function resultRows(html) {
	return html
		.split('<tr>')
		.slice(1)
		.map((row) => ({
			row,
			text: row.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '),
			numericName: row.match(/name="value_(\d+)"/)?.[0]?.match(/"(value_\d+)"/)?.[1],
			textName: row.match(/name="text_(\d+)"/)?.[0]?.match(/"(text_\d+)"/)?.[1]
		}))
		.filter((r) => r.numericName || r.textName);
}

/** Values that satisfy every butachlor specification, chosen per parameter. */
function inSpecValues(html) {
	const fields = {};
	for (const r of resultRows(html)) {
		if (r.numericName) {
			const t = r.text;
			let v = '1';
			if (/Density at 20/.test(t)) v = '1.013';
			else if (/Density at 30/.test(t)) v = '1.005';
			else if (/pH \(1 % dilution\)/.test(t)) v = '7.44';
			else if (/Active ingredient/.test(t)) v = '60.36';
			else if (/Cream|Free oil|Emulsion stability/.test(t)) v = '0';
			fields[r.numericName] = v;
		} else if (r.textName) {
			fields[r.textName] = /Appearance|Colour/.test(r.text)
				? 'ของเหลว สีน้ำตาลแดง'
				: 'ละลายได้ดีในน้ำ';
		}
	}
	return fields;
}

/** Values that violate every butachlor specification. */
function outOfSpecValues(html) {
	const fields = {};
	for (const r of resultRows(html)) {
		if (r.numericName) fields[r.numericName] = '9999';
		else if (r.textName) fields[r.textName] = 'not matching the specification';
	}
	return fields;
}

const countOf = (html, cls) => (html.match(new RegExp(`badge ${cls}`, 'g')) ?? []).length;

const stamp = Date.now();

console.log(`LIMS smoke test against ${BASE}\n`);

// ---------------------------------------------------------------- 1. shell --
console.log('1. application shell');
{
	const dash = await get('/');
	check('GET / returns 200', dash.status === 200, `status ${dash.status}`);
	check('dashboard renders', dash.text.includes('Laboratory dashboard'));
	check('dashboard reads samples from D1', /FG69\d{5}/.test(dash.text));

	const samples = await get('/samples?status=ALL');
	check('GET /samples returns 200', samples.status === 200, `status ${samples.status}`);
	check('sample list renders data', /FG69\d{5}/.test(samples.text));

	const receiving = await get('/receiving');
	check('GET /receiving returns 200', receiving.status === 200, `status ${receiving.status}`);
	check('material master loaded from D1', receiving.text.includes('DEMO-EC-001'));
	check('supplier master loaded from D1', receiving.text.includes('Demo Supplier A'));
}

// ---------------------------------------------------------- 2. goods inward --
console.log('\n2. goods inward');
const happy = await registerSample({ materialCode: 'DEMO-EC-001', lot: `SMOKE-A-${stamp}` });
check('found the Butachlor material in the dropdown', happy.id !== null, happy.error ?? '');
check('POST /receiving redirects to the new sample', happy.id !== null, happy.res?.url ?? '');
if (happy.res) {
	const t = happy.res.text;
	check('the generated sample page renders', t.includes('Sample details'));
	check('status is RECEIVED', /badge received/i.test(t));
	check('lot number recorded', t.includes(`SMOKE-A-${stamp}`));
	check('an internal sample id was minted', /FG69\d{5}/.test(t));
}

// ------------------------------------------------------ 3. result entry -----
if (happy.id) {
	console.log('\n3. result entry and specification evaluation');
	const resultsPage = await get(`/samples/${happy.id}/results`);
	check('result entry page renders', resultsPage.status === 200, `status ${resultsPage.status}`);

	const fields = { analystName: 'Analyst 1', analysedDate: '2026-10-14', ...inSpecValues(resultsPage.text) };
	const lineCount = Object.keys(fields).length - 2;
	check(
		'specification lines generated from the material spec',
		lineCount >= 7,
		`${lineCount} line(s)`
	);
	check('pH offered as a numeric field', /name="value_\d+"[^>]*/s.test(resultsPage.text));
	check('a qualitative spec is offered as text', /name="text_\d+"/.test(resultsPage.text));
	check('pH row present', /pH \(1 % dilution\)/.test(resultsPage.text));
	check('Solubility row present', /Solubility/.test(resultsPage.text));

	const saved = await postForm(`/samples/${happy.id}/results`, fields);
	check(
		'POST results redirects back to the sample',
		pathOf(saved.url) === `/samples/${happy.id}` && searchOf(saved.url) === '?saved=1',
		saved.url
	);
	check('save confirmation shown', saved.text.includes('Results saved'));
	check('sample moved to PENDING_REVIEW', saved.text.includes('Pending review'));
	check(
		'every entered line is assessed PASS (not merely "not failed")',
		countOf(saved.text, 'pass') >= 8 && countOf(saved.text, 'na') === 0,
		`${countOf(saved.text, 'pass')} pass, ${countOf(saved.text, 'na')} na`
	);

	// ------------------------------------------------------- 5. review -----
	console.log('\n5. review and approval');
	const reviewPage = await get(`/samples/${happy.id}/review`);
	check('review page renders', reviewPage.status === 200, `status ${reviewPage.status}`);
	check('specification shown next to the result', reviewPage.text.includes('5.50 - 8.50'));
	check('every line assessed as pass', !/badge fail/i.test(reviewPage.text));

	const approved = await postForm(`/samples/${happy.id}/review?/decide`, {
		action: 'APPROVE',
		decidedBy: 'Lab Manager 1',
		comment: 'smoke test approval'
	});
	check(
		'POST approve redirects back to the sample',
		pathOf(approved.url) === `/samples/${happy.id}` &&
			searchOf(approved.url) === '?decided=APPROVE',
		approved.url
	);
	check('status is APPROVED', /badge approved/i.test(approved.text));

	// ---------------------------------------------------------- 6. COA ----
	console.log('\n6. certificate of analysis');
	const coa = await get(`/samples/${happy.id}/coa`);
	check('COA renders', coa.status === 200, `status ${coa.status}`);
	check('COA shows the report number', /COA-FG69\d{5}/.test(coa.text));
	check('COA is issued, not a draft', !coa.text.includes('Draft — not approved'));
	check('COA shows the specification', coa.text.includes('5.50 - 8.50'));
	check('COA shows the approval signature', coa.text.includes('Lab Manager 1'));
	check('COA shows the approval timestamp', /UTC/.test(coa.text));
	check('COA shows an overall assessment', /Overall assessment/.test(coa.text));
	check('COA links to the print route', coa.text.includes(`/samples/${happy.id}/coa/print`));

	const printView = await get(`/samples/${happy.id}/coa/print`);
	check('print view renders', printView.status === 200, `status ${printView.status}`);

	const exported = await get(`/samples/${happy.id}/coa/export`);
	check('CSV export returns 200', exported.status === 200, `status ${exported.status}`);
	check('CSV export contains the results', exported.text.includes('5.50 - 8.50'));
	check('CSV export contains the approval', exported.text.includes('Lab Manager 1'));
}

// ------------------------------------------------- 7. review guard rails ----
console.log('\n7. review guard rails (self-contained sample)');
const guarded = await registerSample({ materialCode: 'DEMO-EC-001', lot: `SMOKE-B-${stamp}` });
check('guard-rail sample registered', guarded.id !== null, guarded.error ?? '');

if (guarded.id) {
	const tooEarly = await postForm(`/samples/${guarded.id}/review?/decide`, {
		action: 'APPROVE',
		decidedBy: 'Lab Manager 1',
		comment: 'premature'
	});
	check(
		'approving a sample with no results is refused',
		tooEarly.status === 400 && /no recorded result/.test(tooEarly.text),
		`status ${tooEarly.status}`
	);

	// Deliberately out-of-specification values.
	const resultsPage = await get(`/samples/${guarded.id}/results`);
	const fields = {
		analystName: 'Analyst 1',
		analysedDate: '2026-10-14',
		...outOfSpecValues(resultsPage.text)
	};

	const saved = await postForm(`/samples/${guarded.id}/results`, fields);
	check(
		'out-of-specification results are stored and flagged FAIL',
		countOf(saved.text, 'fail') >= 8,
		`${countOf(saved.text, 'fail')} fail badge(s)`
	);
	check('out-of-spec sample sits at PENDING_REVIEW', saved.text.includes('Pending review'));

	const noComment = await postForm(`/samples/${guarded.id}/review?/decide`, {
		action: 'APPROVE',
		decidedBy: 'Lab Manager 1',
		comment: ''
	});
	check(
		'approving a failure without a justification is refused',
		noComment.status === 400 && /out of specification/.test(noComment.text),
		`status ${noComment.status}`
	);

	const rejected = await postForm(`/samples/${guarded.id}/review?/decide`, {
		action: 'REJECT',
		decidedBy: 'Lab Manager 1',
		comment: 'density and pH outside limits, batch rejected'
	});
	check(
		'rejecting with a comment is accepted',
		pathOf(rejected.url) === `/samples/${guarded.id}` && /badge rejected/i.test(rejected.text),
		rejected.url
	);

	const draftCoa = await get(`/samples/${guarded.id}/coa`);
	check('a rejected sample renders a draft COA', draftCoa.text.includes('Draft'));

	const deviation = await postForm(`/samples/${guarded.id}/review?/decide`, {
		action: 'APPROVE',
		decidedBy: 'Lab Manager 1',
		comment: 'deviation accepted under concession CR-1234'
	});
	check(
		'approving a failure with a documented justification is accepted',
		/badge approved/i.test(deviation.text),
		deviation.url
	);

	const retest = await postForm(`/samples/${guarded.id}/review?/decide`, {
		action: 'RETEST',
		decidedBy: 'TM 1',
		comment: 'repeat the density determination'
	});
	check('requesting a retest is accepted', /badge retest/i.test(retest.text), retest.url);
}

// ------------------------------------------------------ 8. error handling ---
console.log('\n8. error handling');
{
	const missing = await get('/samples/999999');
	check('unknown sample returns 404', missing.status === 404, `status ${missing.status}`);
	const bad = await get('/samples/not-a-number');
	check('non-numeric sample id returns 404', bad.status === 404, `status ${bad.status}`);
	const noResults = await get('/nosuchpage');
	check('unknown route returns 404', noResults.status === 404, `status ${noResults.status}`);

	const page = await get('/receiving');
	const materialId = optionValueFor(page.text, 'DEMO-EC-001');
	const invalid = await postForm('/receiving', {
		materialId,
		supplierId: '',
		externalLotNo: '',
		quantity: '-5',
		quantityUnit: '',
		receivedDate: 'not-a-date',
		createdBy: '',
		notes: ''
	});
	check(
		'invalid goods-inward input is rejected with messages',
		invalid.status === 400 && /Please correct the following/.test(invalid.text),
		`status ${invalid.status}`
	);
}

console.log(`\n${passed} check(s) passed, ${failures.length} failed`);
if (failures.length > 0) {
	console.log('failed checks:');
	for (const f of failures) console.log(`  - ${f}`);
	process.exit(1);
}
