import zlib from "zlib";
import crypto from "crypto";

// The book's ornaments/illustrations are 1-bit grayscale ink masks; pdfimages exports them with
// inconsistent polarity (white-on-black or black-on-white). Normalize each to **black ink on a
// transparent background** so it renders correctly on any page with no CSS tricks. Ink polarity is
// inferred from the corners (whatever the corners are is the background).

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = (() => {
	const t = new Uint32Array(256);
	for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
	return t;
})();
const crc32 = (buf) => {
	let c = 0xFFFFFFFF;
	for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
	return (c ^ 0xFFFFFFFF) >>> 0;
};
const chunk = (type, data) => {
	const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
	const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
	return Buffer.concat([len, body, crc]);
};

function readChunks(buf) {
	const out = [];
	for (let p = 8; p < buf.length; ) { const len = buf.readUInt32BE(p); out.push({ type: buf.toString("ascii", p + 4, p + 8), data: buf.slice(p + 8, p + 8 + len) }); p += 12 + len; }
	return out;
}

/** Decode a 1-bit grayscale PNG to `{ width, height, px }` (px: Uint8Array of 0/1 per pixel). */
function decode1bitGray(buf) {
	const chunks = readChunks(buf);
	const ihdr = chunks.find((c) => c.type === "IHDR").data;
	const width = ihdr.readUInt32BE(0), height = ihdr.readUInt32BE(4);
	if (ihdr[8] !== 1 || ihdr[9] !== 0) throw new Error(`unsupported PNG depth/type ${ihdr[8]}/${ihdr[9]}`);
	const raw = zlib.inflateSync(Buffer.concat(chunks.filter((c) => c.type === "IDAT").map((c) => c.data)));
	const rowBytes = Math.ceil(width / 8);
	const unfiltered = Buffer.alloc(height * rowBytes);
	let prev = Buffer.alloc(rowBytes);
	for (let y = 0; y < height; y++) {
		const filter = raw[y * (rowBytes + 1)];
		const cur = Buffer.alloc(rowBytes);
		for (let x = 0; x < rowBytes; x++) {
			const a = x >= 1 ? cur[x - 1] : 0, b = prev[x], c = x >= 1 ? prev[x - 1] : 0;
			let v = raw[y * (rowBytes + 1) + 1 + x];
			if (filter === 1) v += a;
			else if (filter === 2) v += b;
			else if (filter === 3) v += (a + b) >> 1;
			else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
			cur[x] = v & 255;
		}
		cur.copy(unfiltered, y * rowBytes); prev = cur;
	}
	const px = new Uint8Array(width * height);
	for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) px[y * width + x] = (unfiltered[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;
	return { width, height, px };
}

/** Re-encode as 8-bit RGBA, ink (non-background pixels) → opaque black, background → transparent. */
function encodeRGBA(width, height, px, bg) {
	const stride = width * 4;
	const raw = Buffer.alloc(height * (stride + 1));
	for (let y = 0; y < height; y++) {
		const row = y * (stride + 1); raw[row] = 0; // filter: none
		for (let x = 0; x < width; x++) raw[row + 1 + x * 4 + 3] = px[y * width + x] !== bg ? 255 : 0; // alpha; RGB stays 0 (black)
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6; // RGBA
	return Buffer.concat([SIG, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/**
 * Normalize a 1-bit ink-mask PNG buffer to black-on-transparent RGBA. These masks consistently
 * encode the ink (chain weave, braid rule, illustration linework) as pixel value 1 on a value-0
 * field — confirmed across the chain, the braid rule, and the article art. Geometric background
 * detection is unreliable for the dense weaves (the pattern touches every edge), so we apply that
 * fixed convention: value 1 → opaque black, value 0 → transparent.
 */
export function blackTransparent(buf, bg = 0) {
	const { width, height, px } = decode1bitGray(buf);
	return encodeRGBA(width, height, px, bg);
}

/** Decode an 8-bit PNG (grayscale=1ch, RGB=3ch, RGBA=4ch) to `{width,height,channels,px}`. */
function decode8bit(buf) {
	const chunks = readChunks(buf);
	const ihdr = chunks.find((c) => c.type === "IHDR").data;
	const width = ihdr.readUInt32BE(0), height = ihdr.readUInt32BE(4), depth = ihdr[8], ctype = ihdr[9];
	if (depth !== 8) throw new Error(`unsupported PNG depth ${depth}`);
	const channels = ctype === 0 ? 1 : ctype === 2 ? 3 : ctype === 6 ? 4 : null;
	if (!channels) throw new Error(`unsupported PNG color type ${ctype}`);
	const raw = zlib.inflateSync(Buffer.concat(chunks.filter((c) => c.type === "IDAT").map((c) => c.data)));
	const stride = width * channels;
	const out = Buffer.alloc(height * stride);
	let prev = Buffer.alloc(stride);
	for (let y = 0; y < height; y++) {
		const filter = raw[y * (stride + 1)];
		const cur = Buffer.alloc(stride);
		for (let x = 0; x < stride; x++) {
			const a = x >= channels ? cur[x - channels] : 0, b = prev[x], c = x >= channels ? prev[x - channels] : 0;
			let v = raw[y * (stride + 1) + 1 + x];
			if (filter === 1) v += a;
			else if (filter === 2) v += b;
			else if (filter === 3) v += (a + b) >> 1;
			else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
			cur[x] = v & 255;
		}
		cur.copy(out, y * stride); prev = cur;
	}
	return { width, height, channels, px: out };
}

/**
 * Stable content key for a normalized 8-bit PNG: sha256 over the decoded raster (dimensions +
 * pixels), **not** the encoded file bytes. zlib's deflate output differs across builds, so hashing
 * the file gives different digests for pixel-identical images on different machines; hashing the
 * decoded raster is toolchain-independent, so content-addressed filenames reproduce everywhere.
 */
export function rasterKey(buf) {
	const { width, height, channels, px } = decode8bit(buf);
	const head = Buffer.alloc(9);
	head.writeUInt32BE(width, 0); head.writeUInt32BE(height, 4); head[8] = channels;
	return crypto.createHash("sha256").update(head).update(px).digest("hex");
}

/**
 * Convert an 8-bit grayscale/RGB(A) ink scan to **black-on-transparent** with a soft (antialiased)
 * alpha: white → transparent, black → opaque black, grays → partial. Used for the swirl bullet
 * glyphs, which pdftoppm renders as black-on-white RGB rather than a 1-bit mask.
 */
export function whiteTransparent(buf) {
	const { width, height, channels, px } = decode8bit(buf);
	const stride = width * 4;
	const raw = Buffer.alloc(height * (stride + 1));
	for (let y = 0; y < height; y++) {
		const row = y * (stride + 1); raw[row] = 0; // filter: none
		for (let x = 0; x < width; x++) {
			const p = (y * width + x) * channels;
			const lum = channels === 1 ? px[p] : Math.round(px[p] * 0.299 + px[p + 1] * 0.587 + px[p + 2] * 0.114);
			raw[row + 1 + x * 4 + 3] = 255 - lum; // RGB stays 0 (black); coverage = darkness
		}
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6; // RGBA
	return Buffer.concat([SIG, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/** Fraction of ink pixels (value 1) — a thin border frame is ~2%, an illustration 20%+. */
export function inkFraction(buf) {
	const { px } = decode1bitGray(buf);
	let ink = 0;
	for (let i = 0; i < px.length; i++) ink += px[i];
	return ink / px.length;
}
