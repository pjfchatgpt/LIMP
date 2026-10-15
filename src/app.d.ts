// Cloudflare bindings are read from the `cloudflare:workers` module (see
// src/lib/server/db/index.ts), typed by @cloudflare/workers-types. There is no
// need to declare App.Platform for this application.
declare global {
	namespace App {
		interface Error {
			message: string;
		}
	}
}

export {};
