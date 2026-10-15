/**
 * Specification engine.
 *
 * Pure, dependency-free and isomorphic: the browser uses it for the live
 * PASS/FAIL preview while the analyst types, and the server uses the same code
 * as the authority when the result is saved. Keeping one implementation avoids
 * the classic LIMS bug where the preview and the stored verdict disagree.
 *
 * Supported specification shapes (all taken from the real master data):
 *   range             "5.50 - 8.50"       "1.010-1.030"    "57.50-62.5"
 *   maximum only      "ไม่เกิน 5"          "ไม่มากกว่า 2 %"   "<= 60 ml"
 *   minimum only      "ไม่น้อยกว่า 98 %"   ">= 98"
 *   expected text     "ละลายได้ดีในน้ำ"    "ของเหลว สีน้ำตาลแดง"
 */

export type Verdict = 'PASS' | 'FAIL' | 'NA';
export type ResultType = 'NUMERIC' | 'TEXT';

export interface SpecLike {
	spec_text?: string | null;
	min_value?: number | null;
	max_value?: number | null;
	expected_text?: string | null;
}

/**
 * Shape of a specification as it comes out of the database (Drizzle returns
 * camelCase properties).
 */
export interface SpecRowLike {
	specText?: string | null;
	minValue?: number | null;
	maxValue?: number | null;
	expectedText?: string | null;
}

/**
 * Single conversion point between database rows and the engine.
 *
 * Both the browser preview and the server-side save must go through this: a
 * mismatch here silently turns every verdict into NA while the preview still
 * looks correct.
 */
export function specFromRow(row: SpecRowLike | null | undefined): SpecLike | null {
	if (!row) return null;
	return {
		spec_text: row.specText ?? null,
		min_value: row.minValue ?? null,
		max_value: row.maxValue ?? null,
		expected_text: row.expectedText ?? null
	};
}

export interface EvaluationInput {
	spec?: SpecLike | null;
	/** Numeric result as typed, or null when only text was entered. */
	resultValue?: number | string | null;
	/** Free-text result (qualitative parameters). */
	resultText?: string | null;
	resultType?: ResultType;
}

export type Reason =
	| 'OK'
	| 'NOT_ENTERED'
	| 'BELOW_MIN'
	| 'ABOVE_MAX'
	| 'TEXT_MATCH'
	| 'TEXT_MATCH_PARTIAL'
	| 'TEXT_MISMATCH'
	| 'NO_SPECIFICATION'
	| 'NUMERIC_REQUIRED';

export interface Evaluation {
	verdict: Verdict;
	reason: Reason;
	/** Human sentence shown next to the result. */
	message: string;
}

/* ------------------------------------------------------------------ text ---- */

export function normalizeRaw(value: unknown): string {
	if (value === null || value === undefined) return '';
	return String(value)
		.replace(/\u00a0/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Case-, space- and trailing-punctuation-insensitive comparison form. */
export function normalizeText(value: unknown): string {
	return normalizeRaw(value).replace(/[.．]+$/, '').toLowerCase();
}

/**
 * Parse a number out of a typed value such as "1,013", "98.5 %" or "1.234,5".
 *
 * Separator rule: a single comma with no dot is read as a decimal separator,
 * because laboratory values (densities, percentages) are decimals and never
 * thousands. Two or more commas, or a comma together with a dot, are read as
 * thousands separators unless the comma is the later of the two symbols.
 */
export function parseNumber(value: unknown): number | null {
	if (value === null || value === undefined || value === '') return null;
	if (typeof value === 'number') return Number.isFinite(value) ? value : null;

	let cleaned = normalizeRaw(value).replace(/[^0-9eE+\-.,]/g, '');
	if (cleaned === '' || cleaned === '-' || cleaned === '+' || cleaned === '.') return null;

	const dots = (cleaned.match(/\./g) ?? []).length;
	const commas = (cleaned.match(/,/g) ?? []).length;

	if (commas > 0) {
		if (dots === 0) {
			cleaned = commas === 1 ? cleaned.replace(',', '.') : cleaned.replace(/,/g, '');
		} else if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
			// "1.234,5" - dot groups thousands, comma is the decimal separator
			cleaned = cleaned.replace(/\./g, '').replace(/,/g, '.');
		} else {
			cleaned = cleaned.replace(/,/g, '');
		}
	}

	const n = Number(cleaned);
	return Number.isFinite(n) ? n : null;
}

function formatNumber(n: number): string {
	return String(Number(n.toFixed(10)));
}

/* -------------------------------------------------------- spec text parse ---- */

export interface ParsedSpec {
	min: number | null;
	max: number | null;
	expectedText: string | null;
}

// A bare numeric range, optionally followed by a unit: "5.50 - 8.50", "250 - 500 cPs"
const RANGE_RE =
	/^(-?\d+(?:\.\d+)?)\s*(?:-|–|—|~|to)\s*(-?\d+(?:\.\d+)?)\s*[A-Za-z%°µ/·]*$/;
// Thai and English "not more than" forms
const MAX_RE = /(?:ต้องไม่เกิน|ไม่เกิน|ไม่มากกว่า|ไม่สูงกว่า|<=|≤|not\s+more\s+than|\bmax(?:imum)?\b)\s*([-\d.]+)/i;
// Thai and English "not less than" forms
const MIN_RE = /(?:ต้องไม่น้อยกว่า|ไม่น้อยกว่า|ไม่ต่ำกว่า|>=|≥|not\s+less\s+than|\bmin(?:imum)?\b)\s*([-\d.]+)/i;

/**
 * Derive numeric bounds (and/or an expected text value) from a specification
 * string. Needed because the source spreadsheets carry most limits as free text.
 */
export function parseSpecText(specText: unknown): ParsedSpec {
	const raw = normalizeRaw(specText);
	if (raw === '') return { min: null, max: null, expectedText: null };

	const rangeMatch = raw.match(RANGE_RE);
	if (rangeMatch) {
		const a = Number(rangeMatch[1]);
		const b = Number(rangeMatch[2]);
		if (Number.isFinite(a) && Number.isFinite(b)) {
			return { min: Math.min(a, b), max: Math.max(a, b), expectedText: null };
		}
	}

	const maxMatch = raw.match(MAX_RE);
	if (maxMatch) {
		const n = parseNumber(maxMatch[1]);
		if (n !== null) return { min: null, max: n, expectedText: null };
	}

	const minMatch = raw.match(MIN_RE);
	if (minMatch) {
		const n = parseNumber(minMatch[1]);
		if (n !== null) return { min: n, max: null, expectedText: null };
	}

	return { min: null, max: null, expectedText: raw };
}

/** Resolve the effective bounds, preferring explicit columns over parsed text. */
export function resolveBounds(spec?: SpecLike | null): ParsedSpec {
	if (!spec) return { min: null, max: null, expectedText: null };
	const parsed = parseSpecText(spec.spec_text);
	const min = spec.min_value ?? parsed.min;
	const max = spec.max_value ?? parsed.max;
	const expectedText =
		spec.expected_text ?? (min === null && max === null ? parsed.expectedText : null);
	return { min, max, expectedText };
}

/* ------------------------------------------------------------- evaluate ---- */

function toleranceFor(bound: number): number {
	return 1e-9 * Math.max(1, Math.abs(bound));
}

function rangeSentence(value: number, min: number | null, max: number | null): string {
	if (min !== null && max !== null) {
		return `${formatNumber(value)} is within ${formatNumber(min)} - ${formatNumber(max)}.`;
	}
	if (max !== null) return `${formatNumber(value)} is not more than ${formatNumber(max)}.`;
	if (min !== null) return `${formatNumber(value)} is not less than ${formatNumber(min)}.`;
	return `${formatNumber(value)} is acceptable.`;
}

export function evaluateResult(input: EvaluationInput): Evaluation {
	const numeric = parseNumber(input.resultValue);
	const text = normalizeRaw(input.resultText);

	const hasNumeric = numeric !== null;
	const hasText = text !== '';

	if (!hasNumeric && !hasText) {
		return { verdict: 'NA', reason: 'NOT_ENTERED', message: 'No result recorded yet.' };
	}

	const { min, max, expectedText } = resolveBounds(input.spec);
	const hasBounds = min !== null || max !== null;

	// 1. Numeric result against numeric bounds - the primary path.
	if (hasBounds && hasNumeric) {
		if (min !== null && numeric < min - toleranceFor(min)) {
			return {
				verdict: 'FAIL',
				reason: 'BELOW_MIN',
				message: `${formatNumber(numeric)} is below the minimum ${formatNumber(min)}.`
			};
		}
		if (max !== null && numeric > max + toleranceFor(max)) {
			return {
				verdict: 'FAIL',
				reason: 'ABOVE_MAX',
				message: `${formatNumber(numeric)} is above the maximum ${formatNumber(max)}.`
			};
		}
		return { verdict: 'PASS', reason: 'OK', message: rangeSentence(numeric, min, max) };
	}

	// 2. Expected text - qualitative parameters.
	if (expectedText !== null && expectedText !== undefined && expectedText !== '') {
		if (hasNumeric) {
			const expectedNumeric = parseNumber(expectedText);
			if (
				expectedNumeric !== null &&
				Math.abs(numeric - expectedNumeric) <= toleranceFor(expectedNumeric)
			) {
				return { verdict: 'PASS', reason: 'TEXT_MATCH', message: 'Matches the specification.' };
			}
		}
		const candidate = hasText ? text : hasNumeric ? formatNumber(numeric) : '';
		if (normalizeText(candidate) === normalizeText(expectedText)) {
			return { verdict: 'PASS', reason: 'TEXT_MATCH', message: 'Matches the specification.' };
		}
		// A more specific result that still contains the specification is accepted,
		// e.g. spec "ของเหลว สีน้ำตาลแดง" against result "เป็นของเหลว สีน้ำตาลแดง".
		if (
			hasText &&
			normalizeText(candidate).includes(normalizeText(expectedText)) &&
			normalizeText(expectedText).length >= 4
		) {
			return {
				verdict: 'PASS',
				reason: 'TEXT_MATCH_PARTIAL',
				message: 'Matches the specification (the result is more specific).'
			};
		}
		return {
			verdict: 'FAIL',
			reason: 'TEXT_MISMATCH',
			message: `Does not match the expected value "${normalizeRaw(expectedText)}".`
		};
	}

	// 3. Bounds exist but only text was entered.
	if (hasBounds && !hasNumeric) {
		return {
			verdict: 'NA',
			reason: 'NUMERIC_REQUIRED',
			message: 'A numeric result is required to evaluate this specification.'
		};
	}

	return { verdict: 'NA', reason: 'NO_SPECIFICATION', message: 'No specification defined.' };
}

/** Roll several line verdicts up into a single sample verdict. */
export function rollUpVerdicts(verdicts: Verdict[]): 'PASS' | 'FAIL' | 'NA' {
	if (verdicts.some((v) => v === 'FAIL')) return 'FAIL';
	if (verdicts.length > 0 && verdicts.every((v) => v === 'PASS')) return 'PASS';
	return 'NA';
}
