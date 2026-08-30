// The measuring instrument the arch crop is taken with. Its whole reason to exist is that a
// hard-coded rect is a number nobody can check — so the rect is measured off the rendered page, and
// these are the measurements that make that possible, tested against pages drawn here by hand.
import { describe, it, expect } from "vitest";
import zlib from "node:zlib";
import { InkMask, PixelRect } from "../../scripts/import/pdf/inkMask.js";

/** An 8-bit grayscale PNG of `rows` — one character per pixel, `#` for ink. */
function grayPng(rows) {
	const height = rows.length, width = rows[0].length;
	const raw = Buffer.alloc(height * (width + 1));
	rows.forEach((row, y) => {
		raw[y * (width + 1)] = 0; // filter: none
		[...row].forEach((c, x) => { raw[y * (width + 1) + 1 + x] = c === "#" ? 0 : 255; });
	});
	const crcTable = (() => {
		const t = new Uint32Array(256);
		for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
		return t;
	})();
	const crc32 = buf => { let c = 0xFFFFFFFF; for (const b of buf) c = crcTable[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
	const chunk = (type, data) => {
		const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
		const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
		const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
		return Buffer.concat([len, body, crc]);
	};
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 0;
	return Buffer.concat([
		Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
		chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
	]);
}

// A page shaped like the one this was written for: a masthead, a clear gap, an arch (thin crown
// strokes over a solid band), and the printed word the search starts from.
const PAGE = [
	"..######..",   // 0  masthead
	"..######..",   // 1
	"..........",   // 2  the gap that separates one printed object from the next
	"..........",   // 3
	"..........",   // 4
	"...####...",   // 5  crown
	"..#....#..",   // 6
	"..#....#..",   // 7
	"..######..",   // 8  band
	"..######..",   // 9
	"..........",   // 10
	"...####...",   // 11 the label
];

const mask = InkMask.fromPng(grayPng(PAGE));

describe("InkMask", () => {
	it("reads a rendered page as ink or not, whatever bit depth it came back at", () => {
		expect(mask.width).toBe(10);
		expect(mask.height).toBe(12);
		expect(mask.isInk(3, 5)).toBe(true);
		expect(mask.isInk(0, 5)).toBe(false);
	});

	it("measures how much of a row is inked", () => {
		expect(mask.rowInk(8, 0, 9)).toBeCloseTo(0.6);
		expect(mask.rowInk(2, 0, 9)).toBe(0);
	});

	it("reports a row's ink extent, and nothing for a blank row", () => {
		expect(mask.rowInkExtent(8, 0, 9)).toEqual([2, 7]);
		expect(mask.rowInkExtent(2, 0, 9)).toBeNull();
	});

	// The band is the landmark the crop's foot is taken from: the first mostly-inked run above a
	// known point, and the whole of that run rather than its first row.
	it("finds the solid run above a landmark, top and bottom", () => {
		expect(mask.solidRunAbove(10, 0, 9, 0.5)).toEqual({ top: 8, bottom: 9 });
	});

	it("reports no solid run where nothing on the page is solid enough", () => {
		expect(mask.solidRunAbove(10, 0, 9, 0.9)).toBeNull();
	});

	// The gap — not a remembered distance — is where one printed object ends and the next begins.
	it("reaches the crown of the object above and stops at the gap over it", () => {
		expect(mask.inkTopAbove(7, 0, 9, { gap: 3 })).toBe(5);
	});

	it("runs on into the next object when told to tolerate a longer gap", () => {
		expect(mask.inkTopAbove(7, 0, 9, { gap: 4 })).toBe(0);
	});

	it("reports nothing where the search starts in blank space", () => {
		expect(mask.inkTopAbove(3, 0, 9, { gap: 2 })).toBeNull();
	});
});

describe("PixelRect", () => {
	const rect = new PixelRect(2, 4, 7, 9);

	it("counts its own size inclusively — a one-pixel rect is one pixel wide", () => {
		expect(rect.width).toBe(6);
		expect(rect.height).toBe(6);
		expect(new PixelRect(3, 3, 3, 3).width).toBe(1);
	});

	it("grows by a pad without escaping the page", () => {
		const bounds = new PixelRect(0, 0, 9, 9);
		expect(rect.padded(3, bounds)).toEqual(new PixelRect(0, 1, 9, 9));
	});

	// Measured on a cheap render, cropped on an expensive one — the rect has to survive the change
	// of resolution, or the crop lands somewhere else on the page.
	it("rescales between the resolution it was measured at and the one it is cut at", () => {
		expect(rect.scaled(2)).toEqual(new PixelRect(4, 8, 14, 18));
	});
});
