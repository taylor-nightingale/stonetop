// End-to-end proof over the real book PDFs: the browser extraction path (real
// pdf.js, real manifest) recovers EVERY piece of artwork the packs reference.
// Skipped when the PDFs aren't present (they're copyrighted and not in the repo)
// or when STONETOP_PDF_TESTS is unset — run it explicitly via `npm run test:pdf`.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ArtManifest } from "../../src/art/ArtManifest.js";
import { BookArtExtractor } from "../../src/art/BookArtExtractor.js";
import { Raster } from "../../src/art/Raster.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BOOK_II = join(root, "helper", "Book_II_-_The_Wider_World_and_Other_Wonders.pdf");
const BOOK_I = join(root, "helper", "Book_I_-_Stonetop.pdf");
// 1st-printing builds encode all line art as JBIG2 (the 2nd printing above does
// not), so they exercise the jbig2.wasm decoder the other copies never touch.
const BOOK_II_1ST = join(root, "helper", "Book_II_-_The_Wider_World_and_Other_Wonders_(1st_printing).pdf");
const BOOK_I_1ST = join(root, "helper", "Book_I_-_Stonetop_(1st_printing).pdf");
// ~100s of real pdf.js work, so opt-in even on machines that have the PDFs:
// `npm run test:pdf` sets the env var; the plain `npm test` run skips this file.
const optedIn = !!process.env.STONETOP_PDF_TESTS;
const havePdfs = optedIn && existsSync(BOOK_II) && existsSync(BOOK_I);
const have1stPrinting = optedIn && existsSync(BOOK_II_1ST) && existsSync(BOOK_I_1ST);

async function extractorOverVendoredWasm() {
	const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
	pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
		join(root, "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"),
	).href;
	const manifest = ArtManifest.fromJson(JSON.parse(readFileSync(join(root, "art-manifest.json"), "utf8")));
	// The SHIPPED wasm directory, not pdfjs-dist's: a decoder missing from the
	// vendored set silently drops every image it covers.
	const extractor = new BookArtExtractor(pdfjs, manifest, {
		wasmUrl: pathToFileURL(join(root, "lib/pdfjs/wasm/")).href,
	});
	return { extractor, manifest };
}

async function expectBooksToRecoverEverything(books) {
	const { extractor, manifest } = await extractorOverVendoredWasm();
	const found = new Map();
	for (const book of books) {
		const result = await extractor.extract(new Uint8Array(readFileSync(book)));
		for (const art of result.found) found.set(art.path, art);
	}

	const missing = manifest.paths().filter((p) => !found.has(p));
	expect(missing).toEqual([]);

	// Content-addressing integrity: every exact-keyed delivery decodes back to its key.
	for (const entry of manifest.entries.filter((e) => !e.match)) {
		expect(await Raster.fromPng(found.get(entry.path).bytes).key()).toBe(entry.key);
	}
}

describe.skipIf(!havePdfs)("BookArtExtractor against the real books", () => {
	it("recovers every manifest entry from the two PDFs", { timeout: 600_000 }, async () => {
		await expectBooksToRecoverEverything([BOOK_II, BOOK_I]);
	});
});

describe.skipIf(!have1stPrinting)("BookArtExtractor against the 1st-printing books (JBIG2 line art)", () => {
	it("recovers every manifest entry from the two PDFs", { timeout: 600_000 }, async () => {
		await expectBooksToRecoverEverything([BOOK_II_1ST, BOOK_I_1ST]);
	});
});
