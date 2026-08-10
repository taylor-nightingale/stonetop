// Proves the Seasons Change spread parses out of the real Book I: the four trade-dress glyphs in the
// book's own reading order, plus the harvest plate beside them. Skipped when the PDF isn't present
// (copyrighted, not in the repo) or when STONETOP_PDF_TESTS is unset — run via `npm run test:pdf`.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, mkdtempSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { extractSeasonsArt, SEASONS } from "../../scripts/import/pdf/steading-art.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BOOK_I = join(root, "helper", "Book_I_-_Stonetop.pdf");
const enabled = !!process.env.STONETOP_PDF_TESTS && existsSync(BOOK_I);

describe.skipIf(!enabled)("extractSeasonsArt against the real Book I", () => {
	let dir, result;
	beforeAll(() => {
		dir = mkdtempSync(join(os.tmpdir(), "seasons-art-test-"));
		result = extractSeasonsArt(BOOK_I, { artDir: join(dir, "art"), iconsDir: join(dir, "icons") });
	}, 120_000);
	afterAll(() => rmSync(dir, { recursive: true, force: true }));

	it("writes every season glyph and the plate, missing nothing", () => {
		expect(result.missing).toEqual([]);
		expect(result.written).toEqual([...SEASONS.map(s => `season-${s}`), "seasons"]);
	});

	it("puts the glyphs in the committed assets dir and the plate in the art store", () => {
		expect(readdirSync(join(dir, "icons")).sort())
			.toEqual(SEASONS.map(s => `season-${s}.png`).sort());
		expect(readdirSync(join(dir, "art"))).toEqual(["seasons.png"]);
	});

	// The glyphs are ~104px square; the plate is the wide harvest illustration. Sizes are what
	// distinguishes "picked the right image" from "picked the panel frame".
	it("extracts glyphs as small squares and the plate as a wide image", () => {
		const size = file => {
			const buf = readFileSync(file);
			return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
		};
		for (const s of SEASONS) {
			const { w, h } = size(join(dir, "icons", `season-${s}.png`));
			expect(w).toBe(h);
			expect(w).toBeLessThan(200);
		}
		const plate = size(join(dir, "art", "seasons.png"));
		expect(plate.w).toBeGreaterThan(1000);
		expect(plate.w).toBeGreaterThan(plate.h);
	});
});
