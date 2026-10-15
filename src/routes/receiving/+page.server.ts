import { fail, redirect } from '@sveltejs/kit';
import { createSample, listMaterials, listSuppliers, listUsers, todayIso } from '#lib/server/lims';

export const load = async () => {
	const [materials, suppliers, users] = await Promise.all([
		listMaterials(),
		listSuppliers(),
		listUsers()
	]);
	return { materials, suppliers, users, today: todayIso() };
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const actions = {
	default: async ({ request }: { request: Request }) => {
		const form = await request.formData();
		const values = {
			materialId: String(form.get('materialId') ?? '').trim(),
			supplierId: String(form.get('supplierId') ?? '').trim(),
			externalLotNo: String(form.get('externalLotNo') ?? '').trim(),
			quantity: String(form.get('quantity') ?? '').trim(),
			quantityUnit: String(form.get('quantityUnit') ?? '').trim(),
			receivedDate: String(form.get('receivedDate') ?? '').trim(),
			createdBy: String(form.get('createdBy') ?? '').trim(),
			notes: String(form.get('notes') ?? '').trim()
		};

		const errors: string[] = [];
		if (!values.materialId) errors.push('Material is required.');
		if (!values.externalLotNo) errors.push('External lot number is required.');
		if (!ISO_DATE.test(values.receivedDate)) errors.push('Received date must be a valid date.');

		let quantity: number | null = null;
		if (values.quantity !== '') {
			quantity = Number(values.quantity);
			if (!Number.isFinite(quantity) || quantity < 0) {
				errors.push('Quantity must be a non-negative number.');
				quantity = null;
			}
		}
		if (!values.quantityUnit) errors.push('Unit is required.');

		if (errors.length > 0) {
			return fail(400, { errors, values });
		}

		const materials = await listMaterials();
		const material = materials.find((m) => m.id === Number(values.materialId));
		if (!material) {
			return fail(400, { errors: ['Unknown material.'], values });
		}

		const created = await createSample({
			materialId: material.id,
			supplierId: values.supplierId ? Number(values.supplierId) : null,
			externalLotNo: values.externalLotNo,
			quantity,
			quantityUnit: values.quantityUnit,
			// the sample type follows the material category so it cannot drift
			sampleType: material.category,
			receivedDate: values.receivedDate,
			notes: values.notes || null,
			createdBy: values.createdBy || null
		});

		redirect(303, `/samples/${created.id}`);
	}
};
