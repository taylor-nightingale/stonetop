// Copies the ESM builds of runtime npm dependencies into ./lib so they ship in the
// release zip and resolve by relative path in the browser (Foundry has no bundler).
// Run automatically via the "postinstall" npm script. ./lib is git-ignored.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const vendored = [
	["node_modules/snarkdown/dist/snarkdown.es.js", "lib/snarkdown.es.js"],
	// Client-side zlib — PNG encode/decode for the in-Foundry artwork installer.
	["node_modules/fflate/esm/browser.js", "lib/fflate.js"],
	// Pinned pdf.js for the artwork installer. Vendored (not Foundry's bundled copy)
	// because extraction depends on decode internals — the version we tested is the
	// version we ship. The wasm decoders are loaded on demand from wasmUrl:
	// openjpeg decodes the books' JPEG2000 color plates, jbig2 the line-art
	// stencils of the 1st-printing PDFs (a missing decoder silently drops every
	// image it covers, so vendor them all), qcms handles ICC color profiles.
	["node_modules/pdfjs-dist/build/pdf.min.mjs", "lib/pdfjs/pdf.mjs"],
	["node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "lib/pdfjs/pdf.worker.mjs"],
	["node_modules/pdfjs-dist/wasm/openjpeg.wasm", "lib/pdfjs/wasm/openjpeg.wasm", "binary"],
	["node_modules/pdfjs-dist/wasm/openjpeg_nowasm_fallback.js", "lib/pdfjs/wasm/openjpeg_nowasm_fallback.js", "binary"],
	["node_modules/pdfjs-dist/wasm/jbig2.wasm", "lib/pdfjs/wasm/jbig2.wasm", "binary"],
	["node_modules/pdfjs-dist/wasm/jbig2_nowasm_fallback.js", "lib/pdfjs/wasm/jbig2_nowasm_fallback.js", "binary"],
	["node_modules/pdfjs-dist/wasm/qcms_bg.wasm", "lib/pdfjs/wasm/qcms_bg.wasm", "binary"],
	["node_modules/pdfjs-dist/wasm/LICENSE_JBIG2", "lib/pdfjs/wasm/LICENSE_JBIG2", "binary"],
	["node_modules/pdfjs-dist/wasm/LICENSE_PDFJS_JBIG2", "lib/pdfjs/wasm/LICENSE_PDFJS_JBIG2", "binary"],
	["node_modules/pdfjs-dist/wasm/LICENSE_OPENJPEG", "lib/pdfjs/wasm/LICENSE_OPENJPEG", "binary"],
	["node_modules/pdfjs-dist/wasm/LICENSE_PDFJS_OPENJPEG", "lib/pdfjs/wasm/LICENSE_PDFJS_OPENJPEG", "binary"],
	["node_modules/pdfjs-dist/wasm/LICENSE_QCMS", "lib/pdfjs/wasm/LICENSE_QCMS", "binary"],
	["node_modules/pdfjs-dist/wasm/LICENSE_PDFJS_QCMS", "lib/pdfjs/wasm/LICENSE_PDFJS_QCMS", "binary"],
];

for (const [from, to, mode] of vendored) {
	mkdirSync(join(root, dirname(to)), { recursive: true });
	if (mode === "binary") {
		copyFileSync(join(root, from), join(root, to));
	} else {
		// Strip the trailing sourceMappingURL so the browser doesn't 404 on the missing map.
		const src = readFileSync(join(root, from), "utf8")
			.replace(/\n?\/\/# sourceMappingURL=.*$/m, "\n");
		writeFileSync(join(root, to), src);
	}
	console.log(`vendored ${from} -> ${to}`);
}
