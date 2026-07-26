// Bundles the es-shims Uint8Array hex/base64 polyfill into a single self-installing
// IIFE that vendor-deps.js prepends to the vendored pdf.js. es-arraybuffer-base64 is
// a CommonJS module tree (spec-compliant, maintained by es-shims); esbuild flattens it
// into one browser-ready file we can drop in without a runtime bundler. Its `/auto`
// entry feature-detects and only shims methods the engine is missing, so the result is
// a no-op wherever pdf.js already has native toHex/toBase64/fromHex/fromBase64.
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** @returns {Promise<string>} the polyfill as a standalone IIFE, ready to prepend. */
export async function buildUint8ArrayPolyfill() {
	const result = await build({
		stdin: { contents: "require('es-arraybuffer-base64/auto');", resolveDir: root, loader: "js" },
		bundle: true,
		format: "iife",
		platform: "browser",
		minify: true,
		write: false,
		legalComments: "none",
	});
	return result.outputFiles[0].text;
}
