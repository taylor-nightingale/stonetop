// Proves the Fortunes and Surplus arch panels come off the real Book I. They are the one piece of
// steading art that cannot be *pulled*: the whole playbook page is a single image mask, so there is
// no embedded raster to extract and the badge has to be rendered and cropped. Skipped when the PDF
// isn't present (copyrighted, not in the repo) or when STONETOP_PDF_TESTS is unset — `npm run test:pdf`.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, mkdtempSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { extractArchBadges, ARCH_BADGES, pageWithLabels } from "../../scripts/import/pdf/steading-art.js";
import { decode8bit } from "../../scripts/import/pdf/png.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BOOK_I = join(root, "helper", "Book_I_-_Stonetop.pdf");
const enabled = !!process.env.STONETOP_PDF_TESTS && existsSync(BOOK_I);

const size = file => {
	const buf = readFileSync(file);
	return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
};

/** How much of each row is inked, read off the alpha channel the extractor writes. */
const rowCoverage = file => {
	const { width, height, channels, px } = decode8bit(readFileSync(file));
	return Array.from({ length: height }, (_, y) => {
		let covered = 0;
		for (let x = 0; x < width; x++) if (px[(y * width + x) * channels + 3] > 128) covered++;
		return covered / width;
	});
};

describe.skipIf(!enabled)("extractArchBadges against the real Book I", () => {
	let dir, result;
	beforeAll(() => {
		dir = mkdtempSync(join(os.tmpdir(), "arch-badges-test-"));
		result = extractArchBadges(BOOK_I, dir);
	}, 120_000);
	afterAll(() => rmSync(dir, { recursive: true, force: true }));

	it("writes both arches, missing neither", () => {
		expect(result.missing).toEqual([]);
		expect(result.written).toEqual(ARCH_BADGES.map(b => b.slug));
		expect(readdirSync(dir).sort()).toEqual(["fortunes.png", "surplus.png"]);
	});

	// The panel is square — crown to the foot of the band is its own width. Measured off Book I at
	// 600dpi: 450x448 and 447x446, both 1.004. Held to 1%, which is tight enough that an interior
	// crop (much wider than tall, since the band is 29% of the height) could never pass.
	it("cuts each panel square, as the book sets it", () => {
		for (const badge of ARCH_BADGES) {
			const { w, h } = size(join(dir, `${badge.slug}.png`));
			expect(w / h, `${badge.slug} is not square`).toBeGreaterThan(0.99);
			expect(w / h, `${badge.slug} is not square`).toBeLessThan(1.01);
			expect(w).toBeGreaterThan(400);
		}
	});

	// The pair is printed side by side at one size. Two panels a percent apart would mean one crop
	// found something the other didn't — the masthead above, or the label box below.
	it("cuts the two to the same aspect, within 1%", () => {
		const [fortunes, surplus] = ARCH_BADGES.map(b => size(join(dir, `${b.slug}.png`)));
		const ratio = (fortunes.w / fortunes.h) / (surplus.w / surplus.h);
		expect(Math.abs(ratio - 1)).toBeLessThan(0.01);
		expect(Math.abs(fortunes.w - surplus.w)).toBeLessThan(20);
		expect(Math.abs(fortunes.h - surplus.h)).toBeLessThan(20);
	});

	// The proof that it is the WHOLE panel and not the illustration: the book closes each arch with a
	// distressed band across its foot, 29% of the panel's height. If the crop stopped at the top of
	// the band — the old interior crop — the bottom of the image would be as sparse as the drawing.
	it("keeps the inked band at the foot, which is what says the panel is whole", () => {
		for (const badge of ARCH_BADGES) {
			const rows = rowCoverage(join(dir, `${badge.slug}.png`));
			const bandTop = Math.round(rows.length * (1 - 0.29));
			const inBand  = rows.slice(bandTop + 4, rows.length - 4);
			const meanBand = inBand.reduce((a, b) => a + b, 0) / inBand.length;
			expect(meanBand, `${badge.slug} has no band at its foot`).toBeGreaterThan(0.75);
		}
	});

	// The neighbouring panel is ~11pt away and the crop window reaches 8pt past the label, so a crop
	// that ran wide would bring a slice of the other arch's outline in at the very edge.
	it("brings no stroke from the neighbouring panel", () => {
		for (const badge of ARCH_BADGES) {
			const { width, height, channels, px } = decode8bit(readFileSync(join(dir, `${badge.slug}.png`)));
			// The top eighth: above the crown's shoulders the panel's own ink is the outline only, so
			// a neighbour's stroke shows up as a second inked column at the far edge.
			for (const x of [0, width - 1]) {
				let covered = 0;
				for (let y = 0; y < Math.round(height / 8); y++) {
					if (px[(y * width + x) * channels + 3] > 128) covered++;
				}
				expect(covered, `${badge.slug} carries ink up the edge at x=${x}`).toBeLessThan(height / 16);
			}
		}
	});

	// Black on transparent, like the rest of the book art, so the sheet can tone it to whichever
	// parchment it is on. A badge that came back opaque would sit on a white card in dark mode.
	it("writes them black-on-transparent", () => {
		for (const badge of ARCH_BADGES) {
			const buf = readFileSync(join(dir, `${badge.slug}.png`));
			expect(buf[24]).toBe(8);   // bit depth
			expect(buf[25]).toBe(6);   // colour type: RGBA
		}
	});

	it("finds the arches by the words printed under them, not by a page number", () => {
		const found = pageWithLabels(BOOK_I, 72, 86, ARCH_BADGES.map(b => b.label));
		expect(found).not.toBeNull();
		expect(found.lines.get("Fortunes").bbox[0]).toBeLessThan(found.lines.get("Surplus").bbox[0]);
	});
});
