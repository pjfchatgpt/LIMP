import { describe, expect, it } from 'vitest';
import {
	evaluateResult,
	normalizeText,
	parseNumber,
	parseSpecText,
	resolveBounds,
	rollUpVerdicts,
	specFromRow
} from './spec';

describe('specFromRow', () => {
	it('maps a database row onto the engine shape', () => {
		expect(
			specFromRow({
				specText: '5.50 - 8.50',
				minValue: 5.5,
				maxValue: 8.5,
				expectedText: null
			})
		).toEqual({ spec_text: '5.50 - 8.50', min_value: 5.5, max_value: 8.5, expected_text: null });
	});

	it('normalises undefined to null and passes null through', () => {
		expect(specFromRow({ specText: 'x' })).toEqual({
			spec_text: 'x',
			min_value: null,
			max_value: null,
			expected_text: null
		});
		expect(specFromRow(null)).toBeNull();
		expect(specFromRow(undefined)).toBeNull();
	});

	it('produces a specification the engine actually evaluates', () => {
		// Regression guard: a camelCase/snake_case mismatch here made every
		// stored verdict NA while the browser preview still looked correct.
		const spec = specFromRow({ specText: '5.50 - 8.50', minValue: 5.5, maxValue: 8.5 });
		expect(evaluateResult({ spec, resultValue: 7.44 }).verdict).toBe('PASS');
		expect(evaluateResult({ spec, resultValue: 9 }).verdict).toBe('FAIL');

		const noNumericBounds = specFromRow({ specText: '1.010 - 1.030' });
		expect(evaluateResult({ spec: noNumericBounds, resultValue: 1.013 }).verdict).toBe('PASS');
		expect(evaluateResult({ spec: noNumericBounds, resultValue: 1.04 }).verdict).toBe('FAIL');
	});
});

describe('parseNumber', () => {
	it('accepts numbers, numeric strings and values with units', () => {
		expect(parseNumber(7.44)).toBe(7.44);
		expect(parseNumber('7.44')).toBe(7.44);
		expect(parseNumber('1,013')).toBe(1.013);
		expect(parseNumber('98.5 %')).toBe(98.5);
		expect(parseNumber('  60 ml ')).toBe(60);
		expect(parseNumber('-22')).toBe(-22);
	});

	it('reads a comma together with a dot as a thousands group', () => {
		expect(parseNumber('1,234.5')).toBe(1234.5);
		expect(parseNumber('1.234,5')).toBe(1234.5);
		expect(parseNumber('1,234,567')).toBe(1234567);
	});

	it('rejects empty and non-numeric input', () => {
		expect(parseNumber('')).toBeNull();
		expect(parseNumber('   ')).toBeNull();
		expect(parseNumber(null)).toBeNull();
		expect(parseNumber('n/a')).toBeNull();
		expect(parseNumber('-')).toBeNull();
	});
});

describe('normalizeText', () => {
	it('ignores case, repeated spaces, NBSP and trailing full stops', () => {
		expect(normalizeText('  ของเหลว\u00a0สีน้ำตาลแดง ')).toBe('ของเหลว สีน้ำตาลแดง');
		expect(normalizeText('Max.')).toBe('max');
		expect(normalizeText('ABC  DEF')).toBe('abc def');
	});
});

describe('parseSpecText - real specification strings from the master data', () => {
	it('parses numeric ranges', () => {
		expect(parseSpecText('5.50 - 8.50')).toMatchObject({ min: 5.5, max: 8.5 });
		expect(parseSpecText('1.010-1.030')).toMatchObject({ min: 1.01, max: 1.03 });
		expect(parseSpecText('57.50-62.5')).toMatchObject({ min: 57.5, max: 62.5 });
		expect(parseSpecText('250 - 500 cPs')).toMatchObject({ min: 250, max: 500 });
		expect(parseSpecText('-22 - -18')).toMatchObject({ min: -22, max: -18 });
	});

	it('parses Thai and English "not more than" forms as a maximum', () => {
		expect(parseSpecText('ไม่เกิน 5')).toMatchObject({ min: null, max: 5 });
		expect(parseSpecText('ไม่มากกว่า 2 %')).toMatchObject({ min: null, max: 2 });
		expect(parseSpecText('Cream ไม่เกิน 5 ml')).toMatchObject({ min: null, max: 5 });
		expect(parseSpecText('ความคงทนของฟองที่ 1 นาที ต้องไม่เกิน 60 ml')).toMatchObject({
			min: null,
			max: 60
		});
		expect(parseSpecText('<= 60 ml')).toMatchObject({ min: null, max: 60 });
	});

	it('parses Thai and English "not less than" forms as a minimum', () => {
		expect(parseSpecText('ไม่น้อยกว่า 98 %')).toMatchObject({ min: 98, max: null });
		expect(parseSpecText('>= 98')).toMatchObject({ min: 98, max: null });
	});

	it('falls back to an expected text value', () => {
		expect(parseSpecText('ของเหลว สีน้ำตาลแดง')).toMatchObject({
			min: null,
			max: null,
			expectedText: 'ของเหลว สีน้ำตาลแดง'
		});
		expect(parseSpecText('ละลายได้ดีในน้ำ (เขย่า 10 ครั้ง')).toMatchObject({
			expectedText: 'ละลายได้ดีในน้ำ (เขย่า 10 ครั้ง'
		});
	});

	it('returns empty bounds for blank input', () => {
		expect(parseSpecText('')).toEqual({ min: null, max: null, expectedText: null });
		expect(parseSpecText(null)).toEqual({ min: null, max: null, expectedText: null });
	});

	it('does not mistake a numbered line for a range', () => {
		expect(parseSpecText('1.1) ที่ 20 °C (กรัมต่อมิลลิลิตร)').min).toBeNull();
	});
});

describe('resolveBounds', () => {
	it('prefers explicit columns but falls back to parsing spec_text', () => {
		expect(resolveBounds({ spec_text: '1.010 - 1.030' })).toMatchObject({ min: 1.01, max: 1.03 });
		expect(resolveBounds({ spec_text: 'ignored', min_value: 1, max_value: 2 })).toMatchObject({
			min: 1,
			max: 2
		});
		expect(resolveBounds({ spec_text: 'ของเหลว สีน้ำตาลแดง', max_value: null }).expectedText).toBe(
			'ของเหลว สีน้ำตาลแดง'
		);
		expect(resolveBounds(null)).toEqual({ min: null, max: null, expectedText: null });
	});
});

describe('evaluateResult - numeric against bounds', () => {
	const ph = { spec_text: '5.50 - 8.50' };

	it('passes a value inside the range', () => {
		expect(evaluateResult({ spec: ph, resultValue: 7.44 })).toMatchObject({
			verdict: 'PASS',
			reason: 'OK'
		});
	});

	it('passes exactly on both limits (inclusive)', () => {
		expect(evaluateResult({ spec: ph, resultValue: 5.5 }).verdict).toBe('PASS');
		expect(evaluateResult({ spec: ph, resultValue: 8.5 }).verdict).toBe('PASS');
	});

	it('fails below the minimum and above the maximum', () => {
		expect(evaluateResult({ spec: ph, resultValue: 5.4 })).toMatchObject({
			verdict: 'FAIL',
			reason: 'BELOW_MIN'
		});
		expect(evaluateResult({ spec: ph, resultValue: 8.6 })).toMatchObject({
			verdict: 'FAIL',
			reason: 'ABOVE_MAX'
		});
	});

	it('tolerates floating point noise at the boundary', () => {
		expect(evaluateResult({ spec: ph, resultValue: 8.5000000000001 }).verdict).toBe('PASS');
		expect(evaluateResult({ spec: ph, resultValue: 8.5001 }).verdict).toBe('FAIL');
	});

	it('handles a maximum-only specification', () => {
		const foam = { spec_text: 'ต้องไม่เกิน 60', min_value: null, max_value: 60 };
		expect(evaluateResult({ spec: foam, resultValue: 60 }).verdict).toBe('PASS');
		expect(evaluateResult({ spec: foam, resultValue: 65 })).toMatchObject({
			verdict: 'FAIL',
			reason: 'ABOVE_MAX'
		});
		expect(evaluateResult({ spec: foam, resultValue: 0 }).verdict).toBe('PASS');
	});

	it('handles a minimum-only specification', () => {
		const sieve = { spec_text: 'ไม่น้อยกว่า 98 %', min_value: 98, max_value: null };
		expect(evaluateResult({ spec: sieve, resultValue: 99.5 }).verdict).toBe('PASS');
		expect(evaluateResult({ spec: sieve, resultValue: 97 })).toMatchObject({
			verdict: 'FAIL',
			reason: 'BELOW_MIN'
		});
	});

	it('accepts a numeric value typed with a unit', () => {
		const den = { spec_text: '1.010 - 1.030' };
		expect(evaluateResult({ spec: den, resultValue: '1.013' }).verdict).toBe('PASS');
		expect(evaluateResult({ spec: den, resultValue: '1,013' }).verdict).toBe('PASS');
		expect(evaluateResult({ spec: den, resultValue: '1.040' }).verdict).toBe('FAIL');
	});
});

describe('evaluateResult - qualitative text', () => {
	const colour = { spec_text: 'ของเหลว สีน้ำตาลแดง', expected_text: 'ของเหลว สีน้ำตาลแดง' };

	it('passes an exact match', () => {
		expect(
			evaluateResult({ spec: colour, resultText: 'ของเหลว สีน้ำตาลแดง', resultType: 'TEXT' })
		).toMatchObject({ verdict: 'PASS', reason: 'TEXT_MATCH' });
	});

	it('accepts a more specific result that contains the specification', () => {
		expect(
			evaluateResult({ spec: colour, resultText: 'เป็นของเหลว สีน้ำตาลแดง', resultType: 'TEXT' })
		).toMatchObject({ verdict: 'PASS', reason: 'TEXT_MATCH_PARTIAL' });
	});

	it('fails a different description', () => {
		expect(
			evaluateResult({ spec: colour, resultText: 'ของเหลว สีเหลือง', resultType: 'TEXT' })
		).toMatchObject({ verdict: 'FAIL', reason: 'TEXT_MISMATCH' });
	});

	it('ignores surrounding whitespace and case', () => {
		expect(
			evaluateResult({ spec: colour, resultText: '  ของเหลว\u00a0สีน้ำตาลแดง. ', resultType: 'TEXT' })
				.verdict
		).toBe('PASS');
	});

	it('does not treat a very short expected value as a substring match', () => {
		const spec = { spec_text: 'ดี', expected_text: 'ดี' };
		expect(evaluateResult({ spec, resultText: 'ไม่ดี', resultType: 'TEXT' }).verdict).toBe('FAIL');
	});
});

describe('evaluateResult - incomplete and unconfigured cases', () => {
	it('reports NA when nothing was entered', () => {
		expect(evaluateResult({ spec: { spec_text: '5.50 - 8.50' } })).toMatchObject({
			verdict: 'NA',
			reason: 'NOT_ENTERED'
		});
		expect(evaluateResult({ spec: null, resultValue: '' })).toMatchObject({ reason: 'NOT_ENTERED' });
	});

	it('reports NA when a numeric specification received only text', () => {
		expect(
			evaluateResult({ spec: { spec_text: '5.50 - 8.50' }, resultText: 'ok', resultType: 'NUMERIC' })
		).toMatchObject({ verdict: 'NA', reason: 'NUMERIC_REQUIRED' });
	});

	it('reports NA when no specification exists at all', () => {
		expect(evaluateResult({ spec: null, resultValue: 12 })).toMatchObject({
			verdict: 'NA',
			reason: 'NO_SPECIFICATION'
		});
		expect(evaluateResult({ spec: { spec_text: '' }, resultValue: 12 })).toMatchObject({
			verdict: 'NA',
			reason: 'NO_SPECIFICATION'
		});
	});
});

describe('rollUpVerdicts', () => {
	it('fails the sample if any line fails', () => {
		expect(rollUpVerdicts(['PASS', 'FAIL', 'PASS'])).toBe('FAIL');
	});
	it('passes only when every line passes', () => {
		expect(rollUpVerdicts(['PASS', 'PASS'])).toBe('PASS');
		expect(rollUpVerdicts(['PASS', 'NA'])).toBe('NA');
	});
	it('is NA for an empty list', () => {
		expect(rollUpVerdicts([])).toBe('NA');
	});
});
