// Pulls the book's illustrations straight out of an uploaded PDF, in the browser.
// It never needs to understand the page layout: every embedded image is decoded,
// content-keyed, and looked up in the shipped ArtManifest (exact key first, then
// the perceptual signature for lossy-compressed images). Anything the manifest
// doesn't know is discarded — only artwork the packs actually reference is kept.
import { Raster } from "./Raster.js";

/** One recognized piece of artwork: where it belongs in the store, and its PNG bytes. */
export class FoundArt {
	/**
	 * @param {string} path store-relative path, e.g. "wonders/<key>.png"
	 * @param {Uint8Array} bytes PNG encoding of the extracted raster
	 */
	constructor(path, bytes) {
		this.path = path;
		this.bytes = bytes;
	}
}

/** Outcome of scanning one PDF. */
export class ExtractionResult {
	/**
	 * @param {FoundArt[]} found
	 * @param {number} pages
	 * @param {number} imagesSeen distinct embedded images inspected
	 */
	constructor(found, pages, imagesSeen) {
		this.found = found;
		this.pages = pages;
		this.imagesSeen = imagesSeen;
	}
}

export class BookArtExtractor {
	/**
	 * @param {object} pdfjs a pdf.js module (GlobalWorkerOptions.workerSrc already set)
	 * @param {import("./ArtManifest.js").ArtManifest} manifest
	 * @param {{wasmUrl?: string, objectTimeoutMs?: number}} [options]
	 *        wasmUrl: base URL of pdf.js' wasm decoders (JPEG2000 images need it)
	 */
	constructor(pdfjs, manifest, { wasmUrl = null, objectTimeoutMs = 20000 } = {}) {
		this._pdfjs = pdfjs;
		this._manifest = manifest;
		this._wasmUrl = wasmUrl;
		this._objectTimeoutMs = objectTimeoutMs;
	}

	/**
	 * Scan a PDF and return every manifest-listed image it contains.
	 * @param {ArrayBuffer|Uint8Array} data the PDF file's bytes
	 * @param {{onProgress?: (p: {page: number, pages: number, found: number}) => void}} [callbacks]
	 */
	async extract(data, { onProgress } = {}) {
		const task = this._pdfjs.getDocument({
			data,
			verbosity: 0,
			wasmUrl: this._wasmUrl ?? undefined,
			// Force the worker to hand back raw pixel buffers instead of ImageBitmaps /
			// platform-decoded images — the raster bytes are what we hash.
			isOffscreenCanvasSupported: false,
			isImageDecoderSupported: false,
		});
		const found = new Map(); // path -> FoundArt
		const seenIds = new Set(); // object ids are unique per document
		let imagesSeen = 0;
		try {
			const doc = await task.promise;
			for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
				const page = await doc.getPage(pageNumber);
				const ops = await page.getOperatorList();
				for (let i = 0; i < ops.fnArray.length; i++) {
					const fn = ops.fnArray[i];
					const isMask = fn === this._pdfjs.OPS.paintImageMaskXObject;
					if (!isMask && fn !== this._pdfjs.OPS.paintImageXObject) continue;
					const arg = ops.argsArray[i][0];
					if (typeof arg === "string") {
						if (seenIds.has(arg)) continue;
						seenIds.add(arg);
					}
					const img = typeof arg === "string" ? await this._getObject(page, arg) : arg;
					if (!img || img.width == null) continue;
					imagesSeen++;
					const raster = await this._toRaster(page, img);
					if (!raster) continue;
					const path = await this._identify(raster);
					if (path && !found.has(path)) found.set(path, new FoundArt(path, raster.toPng()));
				}
				page.cleanup();
				onProgress?.({ page: pageNumber, pages: doc.numPages, found: found.size });
			}
			return new ExtractionResult([...found.values()], doc.numPages, imagesSeen);
		} finally {
			await task.destroy();
		}
	}

	/** Decode a pdf.js image object into a canonical Raster, or null if unusable. */
	async _toRaster(page, img) {
		const { width, height } = img;
		// Image masks reference their packed bitmap by a second-level object id; the
		// resolved object is either the bitmap itself or a wrapper holding it in .data.
		let data = img.data;
		if (typeof data === "string") {
			const resolved = await this._getObject(page, data);
			data = resolved?.data ?? resolved;
		}
		if (!data) return null;
		const maskRowBytes = Math.ceil(width / 8);
		if (data.length >= maskRowBytes * height && data.length <= maskRowBytes * height + height) {
			return Raster.fromPdfMask(width, height, data);
		}
		if (data.length === width * height * 3) return Raster.fromRgb(width, height, data);
		if (data.length === width * height * 4) return Raster.fromRgba(width, height, data);
		return null;
	}

	/** Match a raster against the manifest: exact key, gray-collapsed key, then perceptual. */
	async _identify(raster) {
		const exact = this._manifest.pathForKey(await raster.key());
		if (exact) return exact;
		// pdf.js expands 8-bit grayscale to RGB; the pipeline keys it as one channel.
		const gray = raster.toGray();
		if (gray) {
			const grayMatch = this._manifest.pathForKey(await gray.key());
			if (grayMatch) return grayMatch;
		}
		if (raster.isStencil()) return null; // stencils are exact or nothing
		return this._manifest.identifyLossy(raster);
	}

	/**
	 * Resolve a worker-decoded object. Large images live in commonObjs, the rest in
	 * objs; either may register AFTER the operator list resolves, so an unknown id
	 * means "wait", bounded by the timeout.
	 */
	_getObject(page, id) {
		return new Promise((resolve) => {
			let done = false;
			const finish = (value) => { if (!done) { done = true; resolve(value); } };
			const timer = setTimeout(() => finish(null), this._objectTimeoutMs);
			const store = page.commonObjs.has(id) ? page.commonObjs : page.objs;
			try {
				store.get(id, (value) => { clearTimeout(timer); finish(value); });
			} catch {
				clearTimeout(timer);
				finish(null);
			}
		});
	}
}
