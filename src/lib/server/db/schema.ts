/**
 * Drizzle schema for the D1 database.
 *
 * `migrations/0001_init.sql` is the source of truth for D1 - it is what
 * `wrangler d1 migrations apply` runs. This file mirrors that schema so the
 * application gets typed queries. Keep the two in step when you change either.
 */
import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const now = sql`(datetime('now'))`;

export const users = sqliteTable(
	'users',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		name: text('name').notNull(),
		nameTh: text('name_th'),
		role: text('role').notNull(),
		email: text('email'),
		isActive: integer('is_active').notNull().default(1),
		createdAt: text('created_at').notNull().default(now)
	},
	(t) => [uniqueIndex('ux_users_name').on(t.name)]
);

export const suppliers = sqliteTable(
	'suppliers',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		name: text('name').notNull(),
		address: text('address'),
		contactName: text('contact_name'),
		contactEmail: text('contact_email'),
		isActive: integer('is_active').notNull().default(1),
		createdAt: text('created_at').notNull().default(now)
	},
	(t) => [uniqueIndex('ux_suppliers_name').on(t.name)]
);

export const materials = sqliteTable(
	'materials',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		code: text('code').notNull(),
		name: text('name').notNull(),
		category: text('category').notNull(),
		productGroup: text('product_group'),
		formulation: text('formulation'),
		unit: text('unit').notNull().default('kg'),
		isActive: integer('is_active').notNull().default(1),
		createdAt: text('created_at').notNull().default(now)
	},
	(t) => [uniqueIndex('ux_materials_code').on(t.code), index('ix_materials_name').on(t.name)]
);

export const testParameters = sqliteTable(
	'test_parameters',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		code: text('code').notNull(),
		name: text('name').notNull(),
		nameTh: text('name_th'),
		unit: text('unit'),
		resultType: text('result_type').notNull(),
		defaultMethod: text('default_method'),
		instrument: text('instrument'),
		sortOrder: integer('sort_order').notNull().default(0)
	},
	(t) => [uniqueIndex('ux_parameters_code').on(t.code)]
);

export const specifications = sqliteTable(
	'specifications',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		materialId: integer('material_id').notNull(),
		parameterId: integer('parameter_id').notNull(),
		subLabel: text('sub_label').notNull().default(''),
		specText: text('spec_text').notNull(),
		minValue: real('min_value'),
		maxValue: real('max_value'),
		expectedText: text('expected_text'),
		unit: text('unit'),
		method: text('method'),
		instrument: text('instrument'),
		tatMinutes: integer('tat_minutes'),
		isActive: integer('is_active').notNull().default(1),
		createdAt: text('created_at').notNull().default(now)
	},
	(t) => [
		uniqueIndex('ux_specs_material_param').on(t.materialId, t.parameterId, t.subLabel),
		index('ix_specs_material').on(t.materialId)
	]
);

export const samples = sqliteTable(
	'samples',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		sampleCode: text('sample_code').notNull(),
		materialId: integer('material_id').notNull(),
		supplierId: integer('supplier_id'),
		externalLotNo: text('external_lot_no'),
		quantity: real('quantity'),
		quantityUnit: text('quantity_unit'),
		sampleType: text('sample_type').notNull().default('RM'),
		receivedDate: text('received_date').notNull(),
		dueDate: text('due_date'),
		status: text('status').notNull().default('RECEIVED'),
		notes: text('notes'),
		createdBy: text('created_by'),
		createdAt: text('created_at').notNull().default(now),
		updatedAt: text('updated_at').notNull().default(now)
	},
	(t) => [
		uniqueIndex('ux_samples_code').on(t.sampleCode),
		index('ix_samples_status').on(t.status),
		index('ix_samples_material').on(t.materialId),
		index('ix_samples_received').on(t.receivedDate)
	]
);

export const testResults = sqliteTable(
	'test_results',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		sampleId: integer('sample_id').notNull(),
		parameterId: integer('parameter_id').notNull(),
		specificationId: integer('specification_id'),
		subLabel: text('sub_label').notNull().default(''),
		specText: text('spec_text'),
		specMin: real('spec_min'),
		specMax: real('spec_max'),
		resultValue: real('result_value'),
		resultText: text('result_text'),
		unit: text('unit'),
		verdict: text('verdict').notNull().default('NA'),
		method: text('method'),
		instrument: text('instrument'),
		analysedDate: text('analysed_date'),
		analystName: text('analyst_name'),
		remark: text('remark'),
		enteredAt: text('entered_at').notNull().default(now),
		updatedAt: text('updated_at').notNull().default(now)
	},
	(t) => [
		uniqueIndex('ux_results_sample_param').on(t.sampleId, t.parameterId, t.subLabel),
		index('ix_results_sample').on(t.sampleId)
	]
);

export const approvals = sqliteTable(
	'approvals',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		sampleId: integer('sample_id').notNull(),
		action: text('action').notNull(),
		decidedBy: text('decided_by').notNull(),
		decidedRole: text('decided_role'),
		comment: text('comment'),
		decidedAt: text('decided_at').notNull().default(now)
	},
	(t) => [index('ix_approvals_sample').on(t.sampleId)]
);

export const auditLog = sqliteTable(
	'audit_log',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		entity: text('entity').notNull(),
		entityId: integer('entity_id'),
		action: text('action').notNull(),
		actor: text('actor'),
		detail: text('detail'),
		createdAt: text('created_at').notNull().default(now)
	},
	(t) => [index('ix_audit_entity').on(t.entity, t.entityId)]
);

export const counters = sqliteTable('counters', {
	key: text('key').primaryKey(),
	value: integer('value').notNull().default(0)
});

export type Material = typeof materials.$inferSelect;
export type TestParameter = typeof testParameters.$inferSelect;
export type Specification = typeof specifications.$inferSelect;
export type Sample = typeof samples.$inferSelect;
export type TestResult = typeof testResults.$inferSelect;
export type Approval = typeof approvals.$inferSelect;
export type User = typeof users.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
