import { defineConfig } from 'vitest/config';

// Pure unit tests for the specification engine live next to the code they cover.
// They do not need the SvelteKit plugin or a browser environment.
export default defineConfig({
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node'
	}
});
