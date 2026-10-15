import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

// SvelteKit 3 takes its configuration here rather than from svelte.config.js.
// adapter-cloudflare detects a Cloudflare Pages project from
// `pages_build_output_dir` in wrangler.toml, and `platformProxy` makes the D1
// binding available to `vite dev` and `vite preview` as well as to the deployed
// Worker.
export default defineConfig({
	plugins: [
		sveltekit({
			preprocess: vitePreprocess(),
			adapter: adapter({
				platformProxy: { configPath: 'wrangler.toml' }
			})
		})
	]
});
