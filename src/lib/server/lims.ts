/**
 * LIMS domain services. All reads and writes for the four business flows live
 * here so that routes stay thin and the D1 statements stay in one place.
 */
import { and, asc, desc, eq, inArray, like, or, sql } from 'drizzle-orm';
import type {
	DecisionAction,
	ResultLine,
	SampleDetail,
	SampleListRow,
	SampleStatus,
	StatusCounts
} from '#lib/types';
import { evaluateResult, rollUpVerdicts, specFromRow, type Verdict } from '#lib/spec';
import { getDb, type DbContext } from './db';
import {
	approvals,
	auditLog,
	materials,
	samples,
	specifications,
	suppliers,
	testParameters,
	testResults,
	users
} from './db/schema';

export type { DecisionAction, ResultLine, SampleDetail, SampleListRow, SampleStatus, StatusCounts };

export const SAMPLE_PREFIX: Record<string, string> = { RM: 'RM', WIP: 'WIP', FG: 'FG' };

/* ------------------------------------------------------------------ utils ---- */

export function todayIso(): string {
	return new Date().toISOString().slice(0, 10);
}

/** Buddhist-era 2-digit year, matching the lab's existing sample-number style. */
export function buddhistYear2(date = new Date()): string {
	return String(date.getUTCFullYear() + 543).slice(-2);
}

/** ISO-8601 UTC timestamp with a trailing Z, for audit columns. */
export function utcNow(): string {
	return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Mint the next internal sample id, e.g. FG6900001. */
export async function nextSampleCode(ctx: DbContext, sampleType: string): Promise<string> {
	const prefix = SAMPLE_PREFIX[sampleType] ?? 'RM';
	const key = `SAMPLE:${prefix}`;
	const row = await ctx.d1
		.prepare(
			`INSERT INTO counters (key, value) VALUES (?, 1)
			 ON CONFLICT(key) DO UPDATE SET value = value + 1
			 RETURNING value`
		)
		.bind(key)
		.first<{ value: number }>();
	const seq = row?.value ?? 1;
	return `${prefix}${buddhistYear2()}${String(seq).padStart(5, '0')}`;
}

async function log(
	ctx: DbContext,
	entity: string,
	entityId: number | null,
	action: string,
	actor: string | null,
	detail: string
): Promise<void> {
	await ctx.db.insert(auditLog).values({ entity, entityId, action, actor, detail });
}

/* ------------------------------------------------------------- reference ---- */

export async function listMaterials() {
	const { db } = getDb();
	return db
		.select()
		.from(materials)
		.where(eq(materials.isActive, 1))
		.orderBy(asc(materials.category), asc(materials.code));
}

export async function listSuppliers() {
	const { db } = getDb();
	return db.select().from(suppliers).where(eq(suppliers.isActive, 1)).orderBy(asc(suppliers.name));
}

export async function listUsers() {
	const { db } = getDb();
	return db.select().from(users).where(eq(users.isActive, 1)).orderBy(asc(users.role), asc(users.name));
}

/* ---------------------------------------------------------------- samples ---- */

const specCountSql = sql<number>`(
	SELECT COUNT(*) FROM specifications sp
	WHERE sp.material_id = ${samples.materialId} AND sp.is_active = 1
)`;
const resultCountSql = sql<number>`(
	SELECT COUNT(*) FROM test_results r
	WHERE r.sample_id = ${samples.id}
	  AND (r.result_value IS NOT NULL OR (r.result_text IS NOT NULL AND TRIM(r.result_text) <> ''))
)`;
const failCountSql = sql<number>`(
	SELECT COUNT(*) FROM test_results r WHERE r.sample_id = ${samples.id} AND r.verdict = 'FAIL'
)`;
const naCountSql = sql<number>`(
	SELECT COUNT(*) FROM test_results r WHERE r.sample_id = ${samples.id} AND r.verdict = 'NA'
)`;

export async function listSamples(
	opts: { status?: string; q?: string; limit?: number } = {}
): Promise<SampleListRow[]> {
	const { db } = getDb();
	const filters = [];
	if (opts.status && opts.status !== 'ALL') {
		if (opts.status === 'PENDING') {
			filters.push(inArray(samples.status, ['RECEIVED', 'IN_TESTING', 'RETEST']));
		} else {
			filters.push(eq(samples.status, opts.status));
		}
	}
	if (opts.q) {
		const needle = `%${opts.q.trim()}%`;
		filters.push(
			or(
				like(samples.sampleCode, needle),
				like(samples.externalLotNo, needle),
				like(materials.name, needle),
				like(materials.code, needle)
			)
		);
	}

	const rows = await db
		.select({
			id: samples.id,
			sampleCode: samples.sampleCode,
			status: samples.status,
			receivedDate: samples.receivedDate,
			externalLotNo: samples.externalLotNo,
			sampleType: samples.sampleType,
			materialCode: materials.code,
			materialName: materials.name,
			category: materials.category,
			supplierName: suppliers.name,
			specCount: specCountSql,
			resultCount: resultCountSql,
			failCount: failCountSql,
			naCount: naCountSql
		})
		.from(samples)
		.innerJoin(materials, eq(materials.id, samples.materialId))
		.leftJoin(suppliers, eq(suppliers.id, samples.supplierId))
		.where(filters.length ? and(...filters) : undefined)
		.orderBy(desc(samples.receivedDate), desc(samples.id))
		.limit(opts.limit ?? 200);

	return rows.map((r) => ({
		...r,
		status: r.status as SampleStatus,
		specCount: Number(r.specCount),
		resultCount: Number(r.resultCount),
		failCount: Number(r.failCount),
		naCount: Number(r.naCount)
	}));
}

export async function getStatusCounts() {
	const { db } = getDb();
	const rows = await db
		.select({ status: samples.status, n: sql<number>`COUNT(*)` })
		.from(samples)
		.groupBy(samples.status);
	const counts: StatusCounts = {
		RECEIVED: 0,
		IN_TESTING: 0,
		PENDING_REVIEW: 0,
		APPROVED: 0,
		REJECTED: 0,
		RETEST: 0
	};
	for (const r of rows) counts[r.status as SampleStatus] = Number(r.n);
	return counts;
}

export async function getSample(id: number): Promise<SampleDetail | null> {
	const { db } = getDb();

	const head = await db
		.select({
			sample: samples,
			material: materials,
			supplier: suppliers
		})
		.from(samples)
		.innerJoin(materials, eq(materials.id, samples.materialId))
		.leftJoin(suppliers, eq(suppliers.id, samples.supplierId))
		.where(eq(samples.id, id))
		.limit(1);

	if (head.length === 0) return null;
	const { sample, material, supplier } = head[0];

	const rows = await db
		.select({
			specificationId: specifications.id,
			parameterId: testParameters.id,
			parameterCode: testParameters.code,
			parameterName: testParameters.name,
			parameterNameTh: testParameters.nameTh,
			subLabel: specifications.subLabel,
			unit: sql<string | null>`COALESCE(${specifications.unit}, ${testParameters.unit})`,
			resultType: testParameters.resultType,
			specText: specifications.specText,
			minValue: specifications.minValue,
			maxValue: specifications.maxValue,
			expectedText: specifications.expectedText,
			method: specifications.method,
			instrument: specifications.instrument,
			tatMinutes: specifications.tatMinutes,
			resultValue: testResults.resultValue,
			resultText: testResults.resultText,
			verdict: testResults.verdict,
			remark: testResults.remark,
			analystName: testResults.analystName,
			analysedDate: testResults.analysedDate,
			enteredAt: testResults.enteredAt
		})
		.from(specifications)
		.innerJoin(testParameters, eq(testParameters.id, specifications.parameterId))
		.leftJoin(
			testResults,
			and(
				eq(testResults.specificationId, specifications.id),
				eq(testResults.sampleId, sample.id)
			)
		)
		.where(and(eq(specifications.materialId, sample.materialId), eq(specifications.isActive, 1)))
		.orderBy(asc(testParameters.sortOrder), asc(testParameters.code), asc(specifications.subLabel));

	return {
		sample: {
			id: sample.id,
			sampleCode: sample.sampleCode,
			status: sample.status as SampleStatus,
			receivedDate: sample.receivedDate,
			dueDate: sample.dueDate,
			externalLotNo: sample.externalLotNo,
			quantity: sample.quantity,
			quantityUnit: sample.quantityUnit,
			sampleType: sample.sampleType,
			notes: sample.notes,
			createdBy: sample.createdBy,
			createdAt: sample.createdAt
		},
		material: {
			id: material.id,
			code: material.code,
			name: material.name,
			category: material.category,
			formulation: material.formulation,
			productGroup: material.productGroup
		},
		supplier: supplier ? { id: supplier.id, name: supplier.name, address: supplier.address } : null,
		lines: rows.map((r) => ({
			...r,
			verdict: (r.verdict ?? 'NA') as Verdict
		}))
	};
}

export async function getApprovals(sampleId: number) {
	const { db } = getDb();
	return db
		.select()
		.from(approvals)
		.where(eq(approvals.sampleId, sampleId))
		.orderBy(desc(approvals.decidedAt), desc(approvals.id));
}

export async function getAuditTrail(sampleId: number) {
	const { db } = getDb();
	return db
		.select()
		.from(auditLog)
		.where(and(eq(auditLog.entity, 'sample'), eq(auditLog.entityId, sampleId)))
		.orderBy(desc(auditLog.id))
		.limit(50);
}

/* --------------------------------------------------------------- receiving ---- */

export interface CreateSampleInput {
	materialId: number;
	supplierId: number | null;
	externalLotNo: string | null;
	quantity: number | null;
	quantityUnit: string | null;
	sampleType: string;
	receivedDate: string;
	notes: string | null;
	createdBy: string | null;
}

export async function createSample(
	input: CreateSampleInput
): Promise<{ id: number; sampleCode: string }> {
	const ctx = getDb();
	const sampleCode = await nextSampleCode(ctx, input.sampleType);

	const inserted = await ctx.db
		.insert(samples)
		.values({
			sampleCode,
			materialId: input.materialId,
			supplierId: input.supplierId,
			externalLotNo: input.externalLotNo,
			quantity: input.quantity,
			quantityUnit: input.quantityUnit,
			sampleType: input.sampleType,
			receivedDate: input.receivedDate,
			status: 'RECEIVED',
			notes: input.notes,
			createdBy: input.createdBy,
			createdAt: utcNow(),
			updatedAt: utcNow()
		})
		.returning({ id: samples.id, sampleCode: samples.sampleCode });

	const created = inserted[0];
	await log(
		ctx,
		'sample',
		created.id,
		'CREATED',
		input.createdBy,
		`Sample ${created.sampleCode} registered with status RECEIVED (lot ${input.externalLotNo ?? '-'})`
	);
	return created;
}

/* ----------------------------------------------------------------- results ---- */

export interface ResultEntry {
	specificationId: number;
	value: string;
	text: string;
	remark: string;
}

export interface SaveResultsOutcome {
	saved: number;
	status: SampleStatus;
	verdicts: { pass: number; fail: number; na: number };
}

/**
 * Persist analyst results. Specifications are re-read from the database rather
 * than trusted from the form, so limits and verdicts cannot be tampered with
 * client-side.
 */
export async function saveResults(
	sampleId: number,
	entries: ResultEntry[],
	meta: { analystName: string; analysedDate: string; method?: string }
): Promise<SaveResultsOutcome> {
	const ctx = getDb();
	const { db } = ctx;

	const sampleRow = await db
		.select({ id: samples.id, materialId: samples.materialId, code: samples.sampleCode })
		.from(samples)
		.where(eq(samples.id, sampleId))
		.limit(1);
	if (sampleRow.length === 0) throw new Error('Sample not found');
	const sample = sampleRow[0];

	const specs = await db
		.select({
			id: specifications.id,
			parameterId: specifications.parameterId,
			subLabel: specifications.subLabel,
			specText: specifications.specText,
			minValue: specifications.minValue,
			maxValue: specifications.maxValue,
			expectedText: specifications.expectedText,
			unit: sql<string | null>`COALESCE(${specifications.unit}, ${testParameters.unit})`,
			resultType: testParameters.resultType,
			method: specifications.method,
			instrument: specifications.instrument
		})
		.from(specifications)
		.innerJoin(testParameters, eq(testParameters.id, specifications.parameterId))
		.where(and(eq(specifications.materialId, sample.materialId), eq(specifications.isActive, 1)));

	const byId = new Map(specs.map((s) => [s.id, s]));
	const verdicts: Verdict[] = [];
	let saved = 0;

	for (const entry of entries) {
		const spec = byId.get(entry.specificationId);
		if (!spec) continue;

		const value = entry.value.trim() === '' ? null : Number(entry.value);
		const numericValue = value === null || Number.isNaN(value) ? null : value;
		const text = entry.text.trim() === '' ? null : entry.text.trim();

		const evaluation = evaluateResult({
			spec: specFromRow(spec),
			resultValue: numericValue,
			resultText: text,
			resultType: spec.resultType as 'NUMERIC' | 'TEXT'
		});
		verdicts.push(evaluation.verdict);
		saved += 1;

		const payload = {
			sampleId,
			parameterId: spec.parameterId,
			specificationId: spec.id,
			subLabel: spec.subLabel,
			specText: spec.specText,
			specMin: spec.minValue,
			specMax: spec.maxValue,
			resultValue: numericValue,
			resultText: text,
			unit: spec.unit,
			verdict: evaluation.verdict,
			method: meta.method ?? spec.method,
			instrument: spec.instrument,
			analysedDate: meta.analysedDate,
			analystName: meta.analystName,
			remark: entry.remark.trim() === '' ? null : entry.remark.trim(),
			updatedAt: utcNow()
		};

		await db
			.insert(testResults)
			.values({ ...payload, enteredAt: utcNow() })
			.onConflictDoUpdate({
				target: [testResults.sampleId, testResults.parameterId, testResults.subLabel],
				set: payload
			});
	}

	// Sample-level status: all lines answered -> ready for review.
	const allRows = await db
		.select({
			verdict: testResults.verdict,
			value: testResults.resultValue,
			text: testResults.resultText
		})
		.from(testResults)
		.where(eq(testResults.sampleId, sampleId));

	const answered = allRows.filter(
		(r) => r.value !== null || (r.text !== null && r.text.trim() !== '')
	).length;
	const verdictList = allRows
		.filter((r) => r.value !== null || (r.text !== null && r.text.trim() !== ''))
		.map((r) => r.verdict as Verdict);

	let status: SampleStatus;
	if (verdictList.length > 0 && verdictList.length >= specs.length) {
		status = 'PENDING_REVIEW';
	} else if (answered > 0) {
		status = 'IN_TESTING';
	} else {
		status = 'RECEIVED';
	}

	await db
		.update(samples)
		.set({ status, updatedAt: utcNow() })
		.where(eq(samples.id, sampleId));

	await log(
		ctx,
		'sample',
		sampleId,
		'RESULTS_SAVED',
		meta.analystName,
		`${saved} result line(s) recorded; overall ${rollUpVerdicts(verdictList)}; status ${status}`
	);

	const outcome: SaveResultsOutcome = {
		saved,
		status,
		verdicts: {
			pass: verdicts.filter((v) => v === 'PASS').length,
			fail: verdicts.filter((v) => v === 'FAIL').length,
			na: verdicts.filter((v) => v === 'NA').length
		}
	};
	return outcome;
}

/* -------------------------------------------------------------- approvals ---- */

const DECISION_STATUS: Record<DecisionAction, SampleStatus> = {
	APPROVE: 'APPROVED',
	REJECT: 'REJECTED',
	RETEST: 'RETEST'
};

export async function recordDecision(
	sampleId: number,
	action: DecisionAction,
	meta: { decidedBy: string; role: string | null; comment: string | null }
): Promise<SampleStatus> {
	const ctx = getDb();
	const { db } = ctx;

	const sampleRow = await db
		.select({ id: samples.id, code: samples.sampleCode })
		.from(samples)
		.where(eq(samples.id, sampleId))
		.limit(1);
	if (sampleRow.length === 0) throw new Error('Sample not found');

	const status = DECISION_STATUS[action];
	await db.insert(approvals).values({
		sampleId,
		action,
		decidedBy: meta.decidedBy,
		decidedRole: meta.role,
		comment: meta.comment,
		decidedAt: utcNow()
	});
	await db.update(samples).set({ status, updatedAt: utcNow() }).where(eq(samples.id, sampleId));
	await log(
		ctx,
		'sample',
		sampleId,
		action,
		meta.decidedBy,
		`${sampleRow[0].code} set to ${status}${meta.comment ? ` - ${meta.comment}` : ''}`
	);
	return status;
}

/** Latest decision, used on the COA for the signature block. */
export async function getLatestApproval(sampleId: number) {
	const rows = await getApprovals(sampleId);
	return rows.find((r) => r.action === 'APPROVE') ?? null;
}
