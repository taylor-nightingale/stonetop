import { describe, it, expect } from "vitest";
import zlib from "zlib";
import { rasterKey } from "../../../scripts/import/pdf/png.js";

// Build a minimal 8-bit RGBA PNG from a raw pixel raster, deflated at a caller-chosen level.
// Two different levels give byte-different files that decode to identical pixels — exactly the
// cross-machine scenario (a different zlib build emitting different bytes for the same image) that
// rasterKey must see through. crc32/chunk are re-implemented here so the fixture owes nothing to
// png.js's own (unexported) encoder.
const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const crc32 = (() => {
	const t = new Uint32Array(256);
	for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
	return (buf) => { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
})();
const chunk = (type, data) => {
	const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
	const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
	return Buffer.concat([len, body, crc]);
};
const pngRGBA = (width, height, rgba, level) => {
	const stride = width * 4;
	const raw = Buffer.alloc(height * (stride + 1));
	for (let y = 0; y < height; y++) { raw[y * (stride + 1)] = 0; rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride); }
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
	return Buffer.concat([SIG, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level })), chunk("IEND", Buffer.alloc(0))]);
};

describe("rasterKey — content hash over pixels, not encoded bytes", () => {
	const width = 3, height = 2;
	// 6 distinct-ish RGBA pixels.
	const rgba = Buffer.from([
		0, 0, 0, 255, 255, 255, 255, 0, 12, 34, 56, 78,
		9, 9, 9, 255, 128, 128, 128, 128, 0, 0, 0, 0,
	]);

	it("is identical for pixel-identical images encoded with different deflate levels", () => {
		const a = pngRGBA(width, height, rgba, 1);
		const b = pngRGBA(width, height, rgba, 9);
		expect(a.equals(b)).toBe(false);         // different encoded bytes...
		expect(rasterKey(a)).toBe(rasterKey(b)); // ...same content key
	});

	it("changes when a single pixel changes", () => {
		const a = pngRGBA(width, height, rgba, 6);
		const changed = Buffer.from(rgba); changed[0] ^= 0xFF;
		expect(rasterKey(a)).not.toBe(rasterKey(pngRGBA(width, height, changed, 6)));
	});

	it("distinguishes different dimensions that share the same pixel bytes", () => {
		const a = pngRGBA(3, 2, rgba, 6);
		const b = pngRGBA(2, 3, rgba, 6);
		expect(rasterKey(a)).not.toBe(rasterKey(b));
	});
});
