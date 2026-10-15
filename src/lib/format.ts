/**
 * Display helpers that are safe to import from components (no server imports).
 */
import type { Verdict } from './spec';

export type SampleStatus =
	| 'RECEIVED'
	| 'IN_TESTING'
	| 'PENDING_REVIEW'
	| 'APPROVED'
	| 'REJECTED'
	| 'RETEST';

export const STATUS_LABELS: Record<SampleStatus, string> = {
	RECEIVED: 'Received',
	IN_TESTING: 'In testing',
	PENDING_REVIEW: 'Pending review',
	APPROVED: 'Approved',
	REJECTED: 'Rejected',
	RETEST: 'Retest requested'
};

export const ACTIVE_STATUSES: SampleStatus[] = [
	'RECEIVED',
	'IN_TESTING',
	'PENDING_REVIEW',
	'RETEST'
];

export const ALL_STATUSES: SampleStatus[] = [
	'RECEIVED',
	'IN_TESTING',
	'PENDING_REVIEW',
	'APPROVED',
	'REJECTED',
	'RETEST'
];

export const VERDICT_LABELS: Record<Verdict, string> = {
	PASS: 'Pass',
	FAIL: 'Fail',
	NA: 'N/A'
};

/** CSS class suffix used by the .badge / .badge.<x> rules in app.css. */
export function statusClass(status: string): string {
	return status.toLowerCase();
}

export function verdictClass(verdict: string): string {
	return verdict.toLowerCase();
}

/**
 * Timestamps are stored as UTC text (`YYYY-MM-DD HH:MM:SS` or ISO-8601).
 * Render them as `YYYY-MM-DD HH:MM UTC` so a printed COA is unambiguous.
 */
export function formatDateTimeUtc(value: string | null | undefined): string {
	if (!value) return '-';
	const normalised = value.includes('T') ? value : value.replace(' ', 'T');
	const iso = /Z$|[+-]\d{2}:?\d{2}$/.test(normalised) ? normalised : `${normalised}Z`;
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return value;
	const pad = (n: number) => String(n).padStart(2, '0');
	return (
		`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
		`${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
	);
}

/** Date-only values are already ISO; pass them through defensively. */
export function formatDate(value: string | null | undefined): string {
	if (!value) return '-';
	return value.slice(0, 10);
}

/** Numeric formatting that keeps trailing tolerance but drops float noise. */
export function formatNumber(value: number | null | undefined, digits = 3): string {
	if (value === null || value === undefined) return '';
	const rounded = Number(value.toFixed(digits));
	return String(rounded);
}

/** Human description of a specification, e.g. "5.50 - 8.50" or "≤ 60". */
export function describeSpec(spec: {
	spec_text: string | null;
	min_value: number | null;
	max_value: number | null;
	unit?: string | null;
}): string {
	if (spec.spec_text) return spec.spec_text;
	if (spec.min_value !== null && spec.max_value !== null) {
		return `${formatNumber(spec.min_value)} - ${formatNumber(spec.max_value)}`;
	}
	if (spec.max_value !== null) return `max ${formatNumber(spec.max_value)}`;
	if (spec.min_value !== null) return `min ${formatNumber(spec.min_value)}`;
	return '-';
}
