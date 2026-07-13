// The shipped index of book artwork: which raster keys the packs reference and the
// store path each one lives at (stonetop-art/<path>). Generated at build time by
// scripts/art/build-art-manifest.js from the committed pack/template references —
// it contains only hashes, names and 8×8 luminance thumbnails, never book content.
//
// Identification is two-tier: an exact content-key lookup covers everything that
// decodes deterministically (line-art stencils, palette images); entries that came
// from lossy compression additionally carry a `match` signature, because different
// JPEG2000 decoders produce slightly different pixels (and pdf.js may decode at
// reduced resolution), so those are identified perceptually instead.

/** Mean absolute difference between two 8×8 luminance thumbnails. */
const thumbDistance = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / 64;

// Measured on the real books: the true match sits at distance ≈0.2 while the
// closest wrong image is ≈25. Anything under 10 with the right aspect is ours.
const MAX_THUMB_DISTANCE = 10;
const MAX_ASPECT_DRIFT = 0.02;

export class ManifestEntry {
	/**
	 * @param {string} path store-relative path, e.g. "arcana/mindgem.png"
	 * @param {string} key content key (Raster.key) of the committed file
	 * @param {{width: number, height: number, thumb: number[]}|null} match
	 *        perceptual signature for lossy-compressed images; null when the
	 *        exact key is guaranteed to reproduce
	 */
	constructor(path, key, match = null) {
		this.path = path;
		this.key = key;
		this.match = match;
	}

	static fromJson({ path, key, match = null }) {
		return new ManifestEntry(path, key, match);
	}

	toJson() {
		return this.match ? { path: this.path, key: this.key, match: this.match } : { path: this.path, key: this.key };
	}
}

export class ArtManifest {
	/** @param {ManifestEntry[]} entries */
	constructor(entries) {
		this.entries = entries;
		this._byKey = new Map(entries.map((e) => [e.key, e]));
	}

	static fromJson({ entries }) {
		return new ArtManifest(entries.map(ManifestEntry.fromJson));
	}

	toJson() {
		return { entries: this.entries.map((e) => e.toJson()) };
	}

	get size() {
		return this.entries.length;
	}

	/** All store paths the packs reference. */
	paths() {
		return this.entries.map((e) => e.path);
	}

	/** Exact identification by content key. */
	pathForKey(key) {
		return this._byKey.get(key)?.path ?? null;
	}

	/**
	 * Perceptual identification for lossy-compressed images: nearest signature by
	 * thumbnail distance among entries whose aspect ratio matches, if close enough.
	 * @param {{width: number, height: number, thumb8: () => number[]}} raster
	 * @returns {string|null} store path
	 */
	identifyLossy(raster) {
		const aspect = raster.width / raster.height;
		let bestPath = null, bestDistance = MAX_THUMB_DISTANCE;
		let thumb = null;
		for (const e of this.entries) {
			if (!e.match) continue;
			if (Math.abs(e.match.width / e.match.height - aspect) / (e.match.width / e.match.height) > MAX_ASPECT_DRIFT) continue;
			thumb ??= raster.thumb8();
			const d = thumbDistance(thumb, e.match.thumb);
			if (d < bestDistance) { bestDistance = d; bestPath = e.path; }
		}
		return bestPath;
	}
}
