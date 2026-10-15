/**
 * Shapes shared between the server layer and the UI.
 *
 * This module must stay free of server imports: components import it directly,
 * while `#lib/server/lims` re-exports the same types for route handlers.
 */
import type { Verdict } from './spec';

export type { Verdict };

export type SampleStatus =
	| 'RECEIVED'
	| 'IN_TESTING'
	| 'PENDING_REVIEW'
	| 'APPROVED'
	| 'REJECTED'
	| 'RETEST';

export type DecisionAction = 'APPROVE' | 'REJECT' | 'RETEST';

export interface StatusCounts {
	RECEIVED: number;
	IN_TESTING: number;
	PENDING_REVIEW: number;
	APPROVED: number;
	REJECTED: number;
	RETEST: number;
}

export interface SampleListRow {
	id: number;
	sampleCode: string;
	status: SampleStatus;
	receivedDate: string;
	externalLotNo: string | null;
	sampleType: string;
	materialCode: string;
	materialName: string;
	category: string;
	supplierName: string | null;
	specCount: number;
	resultCount: number;
	failCount: number;
	naCount: number;
}

/** One specification line of a sample, joined with its recorded result. */
export interface ResultLine {
	specificationId: number;
	parameterId: number;
	parameterCode: string;
	parameterName: string;
	parameterNameTh: string | null;
	subLabel: string;
	unit: string | null;
	resultType: string;
	specText: string;
	minValue: number | null;
	maxValue: number | null;
	expectedText: string | null;
	method: string | null;
	instrument: string | null;
	tatMinutes: number | null;
	/** null when no result has been recorded yet */
	resultValue: number | null;
	resultText: string | null;
	verdict: Verdict;
	remark: string | null;
	analystName: string | null;
	analysedDate: string | null;
	enteredAt: string | null;
}

export interface SampleHeader {
	id: number;
	sampleCode: string;
	status: SampleStatus;
	receivedDate: string;
	dueDate: string | null;
	externalLotNo: string | null;
	quantity: number | null;
	quantityUnit: string | null;
	sampleType: string;
	notes: string | null;
	createdBy: string | null;
	createdAt: string;
}

export interface MaterialSummary {
	id: number;
	code: string;
	name: string;
	category: string;
	formulation: string | null;
	productGroup: string | null;
}

export interface SupplierSummary {
	id: number;
	name: string;
	address: string | null;
}

/** Everything the sample, review and COA pages render. */
export interface SampleDetail {
	sample: SampleHeader;
	material: MaterialSummary;
	supplier: SupplierSummary | null;
	lines: ResultLine[];
}

export interface ApprovalRecord {
	id: number;
	sampleId: number;
	action: DecisionAction;
	decidedBy: string;
	decidedRole: string | null;
	comment: string | null;
	decidedAt: string;
}

export interface AuditRecord {
	id: number;
	entity: string;
	entityId: number | null;
	action: string;
	actor: string | null;
	detail: string | null;
	createdAt: string;
}
