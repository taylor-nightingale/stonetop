import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

// pdf.js loads its wasm image decoders on demand from wasmUrl. A missing
// decoder does not error the extraction — pdf.js silently drops every image
// it covers ("ignoring XObject"), which once shipped as "found 5 of 206":
// the 1st-printing books encode all line art as JBIG2, and only openjpeg.wasm
// was vendored. Guard the complete decoder set.
const WASM_DIR = join(import.meta.dirname, "../../lib/pdfjs/wasm");

describe("vendored pdf.js wasm decoders", () => {
	it.each([
		"openjpeg.wasm",
		"openjpeg_nowasm_fallback.js",
		"jbig2.wasm",
		"jbig2_nowasm_fallback.js",
		"qcms_bg.wasm",
	])("ships %s", (file) => {
		expect(existsSync(join(WASM_DIR, file))).toBe(true);
	});
});
