// A decoded 8-bit image raster — the unit of identity for book artwork. The art
// store is content-addressed by `key()`, a sha256 over the DECODED pixels (never
// the encoded file bytes), so the same picture gets the same name no matter which
// toolchain extracted it. Must stay byte-compatible with the CLI pipeline's
// rasterKey in scripts/import/pdf/png.js.
//
// Browser-safe: no node imports; zlib comes from the vendored fflate, hashing
// from Web Crypto (both available in node 20+ too, so tests run unmodified).
import { zlibSync, unzlibSync } from "../../lib/fflate.js";

const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];

const CRC_TABLE = (() => {
	const t = new Uint32Array(256);
	for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
	return t;
})();
const crc32 = (bytes) => {
	let c = 0xFFFFFFFF;
	for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
	return (c ^ 0xFFFFFFFF) >>> 0;
};

const CHANNELS_BY_COLOR_TYPE = { 0: 1, 2: 3, 6: 4 };
const COLOR_TYPE_BY_CHANNELS = { 1: 0, 3: 2, 4: 6 };

export class Raster {
	/**
	 * @param {number} width
	 * @param {number} height
	 * @param {number} channels 1 (gray), 3 (RGB) or 4 (RGBA)
	 * @param {Uint8Array} px interleaved samples, row-major
	 */
	constructor(width, height, channels, px) {
		if (!(channels in COLOR_TYPE_BY_CHANNELS)) throw new Error(`unsupported channel count ${channels}`);
		if (px.length !== width * height * channels) {
			throw new Error(`pixel buffer is ${px.length} bytes, expected ${width * height * channels}`);
		}
		this.width = width;
		this.height = height;
		this.channels = channels;
		this.px = px;
	}

	/**
	 * Build the canonical black-on-transparent stencil from a pdf.js image-mask
	 * bitmap (packed 1bpp rows, PDF convention: sample 0 = painted ink). Produces
	 * the exact raster the CLI pipeline commits for the books' line art, so keys match.
	 */
	static fromPdfMask(width, height, packed) {
		const rowBytes = Math.ceil(width / 8);
		const px = new Uint8Array(width * height * 4); // RGB stays 0 (black)
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const bit = (packed[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;
				if (bit === 0) px[(y * width + x) * 4 + 3] = 255;
			}
		}
		return new Raster(width, height, 4, px);
	}

	/** Wrap a pdf.js RGB_24BPP buffer. */
	static fromRgb(width, height, data) {
		return new Raster(width, height, 3, new Uint8Array(data.buffer ?? data, data.byteOffset ?? 0, width * height * 3));
	}

	/** Wrap a pdf.js RGBA_32BPP buffer. */
	static fromRgba(width, height, data) {
		return new Raster(width, height, 4, new Uint8Array(data.buffer ?? data, data.byteOffset ?? 0, width * height * 4));
	}

	/** Decode an 8-bit gray/RGB/RGBA non-interlaced PNG (all scanline filters). */
	static fromPng(bytes) {
		for (let i = 0; i < 8; i++) if (bytes[i] !== PNG_SIG[i]) throw new Error("not a PNG");
		const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		let width, height, channels;
		const idat = [];
		for (let p = 8; p < bytes.length; ) {
			const len = view.getUint32(p);
			const type = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
			const data = bytes.subarray(p + 8, p + 8 + len);
			if (type === "IHDR") {
				width = view.getUint32(p + 8); height = view.getUint32(p + 12);
				const depth = data[8], colorType = data[9], interlace = data[12];
				channels = CHANNELS_BY_COLOR_TYPE[colorType];
				if (depth !== 8 || !channels) throw new Error(`unsupported PNG depth/type ${depth}/${colorType}`);
				if (interlace !== 0) throw new Error("interlaced PNG not supported");
			} else if (type === "IDAT") {
				idat.push(data);
			}
			p += 12 + len;
		}
		const zipped = new Uint8Array(idat.reduce((n, c) => n + c.length, 0));
		let off = 0;
		for (const c of idat) { zipped.set(c, off); off += c.length; }
		const raw = unzlibSync(zipped);
		const stride = width * channels;
		const px = new Uint8Array(height * stride);
		let prev = new Uint8Array(stride);
		for (let y = 0; y < height; y++) {
			const filter = raw[y * (stride + 1)];
			const cur = px.subarray(y * stride, (y + 1) * stride);
			for (let x = 0; x < stride; x++) {
				const a = x >= channels ? cur[x - channels] : 0, b = prev[x], c = x >= channels ? prev[x - channels] : 0;
				let v = raw[y * (stride + 1) + 1 + x];
				if (filter === 1) v += a;
				else if (filter === 2) v += b;
				else if (filter === 3) v += (a + b) >> 1;
				else if (filter === 4) { const p2 = a + b - c, pa = Math.abs(p2 - a), pb = Math.abs(p2 - b), pc = Math.abs(p2 - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
				cur[x] = v & 255;
			}
			prev = cur;
		}
		return new Raster(width, height, channels, px);
	}

	/** Content key: sha256 over [width, height, channels] + raw pixels (hex). */
	async key() {
		const head = new Uint8Array(9);
		new DataView(head.buffer).setUint32(0, this.width);
		new DataView(head.buffer).setUint32(4, this.height);
		head[8] = this.channels;
		const buf = new Uint8Array(9 + this.px.length);
		buf.set(head, 0);
		buf.set(this.px, 9);
		const digest = await globalThis.crypto.subtle.digest("SHA-256", buf);
		return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
	}

	/** Encode as a PNG (filter 0 scanlines, single IDAT). */
	toPng() {
		const stride = this.width * this.channels;
		const raw = new Uint8Array(this.height * (stride + 1)); // filter byte 0 per row
		for (let y = 0; y < this.height; y++) {
			raw.set(this.px.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
		}
		const ihdr = new Uint8Array(13);
		const dv = new DataView(ihdr.buffer);
		dv.setUint32(0, this.width); dv.setUint32(4, this.height);
		ihdr[8] = 8; ihdr[9] = COLOR_TYPE_BY_CHANNELS[this.channels];
		const chunk = (type, data) => {
			const out = new Uint8Array(12 + data.length);
			const v = new DataView(out.buffer);
			v.setUint32(0, data.length);
			for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
			out.set(data, 8);
			v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
			return out;
		};
		const parts = [new Uint8Array(PNG_SIG), chunk("IHDR", ihdr), chunk("IDAT", zlibSync(raw)), chunk("IEND", new Uint8Array(0))];
		const png = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
		let off = 0;
		for (const p of parts) { png.set(p, off); off += p.length; }
		return png;
	}

	/**
	 * 8×8 grid of mean luminance (rounded ints) — the perceptual signature used to
	 * identify lossy-compressed images whose decoded pixels vary across decoders.
	 */
	thumb8() {
		const sum = new Float64Array(64), cnt = new Float64Array(64);
		for (let y = 0; y < this.height; y++) {
			const gy = Math.min(7, (y * 8 / this.height) | 0);
			for (let x = 0; x < this.width; x++) {
				const gx = Math.min(7, (x * 8 / this.width) | 0);
				const p = (y * this.width + x) * this.channels;
				const lum = this.channels === 1 ? this.px[p] : this.px[p] * 0.299 + this.px[p + 1] * 0.587 + this.px[p + 2] * 0.114;
				sum[gy * 8 + gx] += lum; cnt[gy * 8 + gx]++;
			}
		}
		return Array.from(sum, (s, i) => Math.round(s / cnt[i]));
	}

	/** True for the books' line-art stencils: RGBA, all-black RGB, hard binary alpha. */
	isStencil() {
		if (this.channels !== 4) return false;
		for (let i = 0; i < this.px.length; i += 4) {
			if (this.px[i] !== 0 || this.px[i + 1] !== 0 || this.px[i + 2] !== 0) return false;
			const a = this.px[i + 3];
			if (a !== 0 && a !== 255) return false;
		}
		return true;
	}

	/** Collapse RGB whose three samples agree everywhere to 1-channel gray, else null. */
	toGray() {
		if (this.channels !== 3) return null;
		const g = new Uint8Array(this.width * this.height);
		for (let i = 0; i < g.length; i++) {
			const p = i * 3;
			if (this.px[p] !== this.px[p + 1] || this.px[p] !== this.px[p + 2]) return null;
			g[i] = this.px[p];
		}
		return new Raster(this.width, this.height, 1, g);
	}
}
