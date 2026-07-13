import { describe, it, expect } from "vitest";
import { zlibSync } from "../../lib/fflate.js";
import { Raster } from "../../src/art/Raster.js";
import { rasterKey, blackTransparent } from "../../scripts/import/pdf/png.js";

// -- tiny PNG builder (test oracle input) -----------------------------------
// Builds valid PNGs independently of Raster.toPng so decode tests aren't circular.
const CRC_TABLE = (() => {
	const t = new Uint32Array(256);
	for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
	return t;
})();
const crc32 = (b) => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const chunk = (type, data) => {
	const out = new Uint8Array(12 + data.length);
	const v = new DataView(out.buffer);
	v.setUint32(0, data.length);
	for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
	out.set(data, 8);
	v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
	return out;
};
function buildPng({ width, height, depth, colorType, raw }) {
	const ihdr = new Uint8Array(13);
	const v = new DataView(ihdr.buffer);
	v.setUint32(0, width); v.setUint32(4, height); ihdr[8] = depth; ihdr[9] = colorType;
	const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlibSync(raw)), chunk("IEND", new Uint8Array(0))];
	const png = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let off = 0;
	for (const p of parts) { png.set(p, off); off += p.length; }
	return png;
}

const randomPx = (n, seed = 7) => {
	const px = new Uint8Array(n);
	let s = seed;
	for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) & 0x7FFFFFFF; px[i] = s & 255; }
	return px;
};

describe("Raster PNG round-trip", () => {
	for (const channels of [1, 3, 4]) {
		it(`preserves a ${channels}-channel image through toPng/fromPng`, () => {
			const r = new Raster(5, 4, channels, randomPx(5 * 4 * channels, channels));
			const back = Raster.fromPng(r.toPng());
			expect({ width: back.width, height: back.height, channels: back.channels }).toEqual({ width: 5, height: 4, channels });
			expect([...back.px]).toEqual([...r.px]);
		});
	}
});

describe("Raster.key ↔ CLI pipeline rasterKey", () => {
	for (const channels of [1, 3, 4]) {
		it(`matches for a ${channels}-channel image`, async () => {
			const r = new Raster(7, 3, channels, randomPx(7 * 3 * channels, channels * 11));
			expect(await r.key()).toBe(rasterKey(Buffer.from(r.toPng())));
		});
	}
});

describe("Raster.fromPdfMask ↔ CLI pipeline blackTransparent", () => {
	it("produces the same stencil key (pdf.js bit 0 = pipeline gray 1 = ink)", async () => {
		// 13×5 so rows have a partial trailing byte, exercising row padding.
		const width = 13, height = 5, rowBytes = Math.ceil(width / 8);
		const pdfBits = randomPx(rowBytes * height, 42);
		// Pipeline input: 1-bit grayscale PNG whose gray value is the INVERSE of the
		// pdf.js mask bit — pdfimages writes ink as gray 1, pdf.js hands ink as bit 0.
		const raw = new Uint8Array(height * (rowBytes + 1));
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < rowBytes; x++) raw[y * (rowBytes + 1) + 1 + x] = ~pdfBits[y * rowBytes + x] & 255;
		}
		const oneBitPng = buildPng({ width, height, depth: 1, colorType: 0, raw });
		const pipelineKey = rasterKey(blackTransparent(Buffer.from(oneBitPng)));
		expect(await Raster.fromPdfMask(width, height, pdfBits).key()).toBe(pipelineKey);
	});
});

describe("Raster.fromPng scanline filters", () => {
	it("decodes rows using filters 1–4", () => {
		// 3×5 RGB image with a distinct filter per row; filtered bytes computed by hand
		// (the inverse of the spec's reconstruction functions).
		const width = 3, height = 5, channels = 3, stride = width * channels;
		const px = randomPx(height * stride, 99);
		const filters = [0, 1, 2, 3, 4];
		const raw = new Uint8Array(height * (stride + 1));
		for (let y = 0; y < height; y++) {
			const f = filters[y];
			raw[y * (stride + 1)] = f;
			for (let x = 0; x < stride; x++) {
				const cur = px[y * stride + x];
				const a = x >= channels ? px[y * stride + x - channels] : 0;
				const b = y >= 1 ? px[(y - 1) * stride + x] : 0;
				const c = x >= channels && y >= 1 ? px[(y - 1) * stride + x - channels] : 0;
				let pred = 0;
				if (f === 1) pred = a;
				else if (f === 2) pred = b;
				else if (f === 3) pred = (a + b) >> 1;
				else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
				raw[y * (stride + 1) + 1 + x] = (cur - pred) & 255;
			}
		}
		const png = buildPng({ width, height, depth: 8, colorType: 2, raw });
		expect([...Raster.fromPng(png).px]).toEqual([...px]);
	});

	it("rejects non-PNG bytes and unsupported formats", () => {
		expect(() => Raster.fromPng(new Uint8Array([1, 2, 3]))).toThrow(/not a PNG/);
		const raw = new Uint8Array(2 * (1 + 1)); // 1×2, 1 byte/px
		expect(() => Raster.fromPng(buildPng({ width: 1, height: 2, depth: 16, colorType: 0, raw }))).toThrow(/unsupported/);
	});
});

describe("Raster.thumb8", () => {
	it("is flat for a uniform image", () => {
		const r = new Raster(16, 16, 1, new Uint8Array(256).fill(100));
		expect(r.thumb8()).toEqual(Array(64).fill(100));
	});
	it("separates a light half from a dark half", () => {
		const px = new Uint8Array(16 * 16);
		px.fill(255, 0, 8 * 16); // top half white
		const t = new Raster(16, 16, 1, px).thumb8();
		expect(t.slice(0, 32)).toEqual(Array(32).fill(255));
		expect(t.slice(32)).toEqual(Array(32).fill(0));
	});
});

describe("Raster.isStencil", () => {
	it("accepts black RGB with binary alpha", () => {
		const px = new Uint8Array([0, 0, 0, 255, 0, 0, 0, 0]);
		expect(new Raster(2, 1, 4, px).isStencil()).toBe(true);
	});
	it("rejects colored pixels, soft alpha, and non-RGBA rasters", () => {
		expect(new Raster(1, 1, 4, new Uint8Array([9, 0, 0, 255])).isStencil()).toBe(false);
		expect(new Raster(1, 1, 4, new Uint8Array([0, 0, 0, 128])).isStencil()).toBe(false);
		expect(new Raster(1, 1, 3, new Uint8Array([0, 0, 0])).isStencil()).toBe(false);
	});
});

describe("Raster.toGray", () => {
	it("collapses equal-sample RGB to one channel", () => {
		const g = new Raster(2, 1, 3, new Uint8Array([5, 5, 5, 200, 200, 200])).toGray();
		expect(g.channels).toBe(1);
		expect([...g.px]).toEqual([5, 200]);
	});
	it("returns null when samples disagree or input is not RGB", () => {
		expect(new Raster(1, 1, 3, new Uint8Array([1, 2, 3])).toGray()).toBeNull();
		expect(new Raster(1, 1, 1, new Uint8Array([1])).toGray()).toBeNull();
	});
});
