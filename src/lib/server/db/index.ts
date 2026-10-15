/**
 * D1 connection helper.
 *
 * The binding is read from the `cloudflare:workers` module. On Cloudflare that
 * module is provided by the runtime (Workers and Pages Functions); during
 * `vite dev` / `vite preview` the Cloudflare adapter aliases it to a proxy
 * backed by the local Miniflare state configured in wrangler.toml. Application
 * code therefore has a single code path for local and deployed environments.
 *
 * The binding is read lazily inside each request, never at module scope, so the
 * platform is always initialised by the time it is used.
 */
import { env } from 'cloudflare:workers';
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema';

export type Database = DrizzleD1Database<typeof schema>;

export interface DbContext {
	db: Database;
	/** Raw binding, for statements Drizzle does not model (e.g. RETURNING upserts). */
	d1: D1Database;
}

export class MissingDatabaseError extends Error {
	constructor() {
		super(
			'The D1 binding "DB" is not available. Check that wrangler.toml declares ' +
				'[[d1_databases]] with binding = "DB", then run `npm run db:migrate:local` ' +
				'before starting the app.'
		);
		this.name = 'MissingDatabaseError';
	}
}

export function getDb(): DbContext {
	const d1 = (env as unknown as { DB?: D1Database }).DB;
	if (!d1) throw new MissingDatabaseError();
	return { db: drizzle(d1, { schema }), d1 };
}

export { schema };
