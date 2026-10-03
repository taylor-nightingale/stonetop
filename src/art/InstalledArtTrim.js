// Brings artwork installed before the store kept the major arcana trimmed into line with the manifest.
// The books embed each arcanum's drawing on a far larger transparent canvas; the store now keeps the
// drawing alone, and a world that installed its art earlier still has the canvas. Run once per world.
//
// Rewrites a file only when trimming it gives EXACTLY the pixels the manifest names for its path — a
// file already right, one the store keeps whole, or a GM's own picture at a book path is left alone.
import { Raster } from "./Raster.js";
import { FoundArt } from "./BookArtExtractor.js";

export class InstalledArtTrim {
	/**
	 * @param {import("./ArtManifest.js").ArtManifest} manifest
	 * @param {{read: (path: string) => Promise<Uint8Array|null>}} reader an installed file's bytes by
	 *   store-relative path, or null when it is not installed
	 * @param {{write: (arts: FoundArt[]) => Promise<void>}} writer
	 */
	constructor(manifest, reader, writer) {
		this._manifest = manifest;
		this._reader = reader;
		this._writer = writer;
	}

	/** @returns {Promise<string[]>} the store paths rewritten */
	async run() {
		const rewrites = [];
		for (const entry of this._manifest.entries) {
			const raster = await this._installed(entry.path);
			if (!raster || await raster.key() === entry.key) continue;
			const trimmed = raster.trimmed();
			if (trimmed === raster || await trimmed.key() !== entry.key) continue;
			rewrites.push(new FoundArt(entry.path, trimmed.toPng()));
		}
		if (rewrites.length) await this._writer.write(rewrites);
		return rewrites.map(a => a.path);
	}

	async _installed(path) {
		const bytes = await this._reader.read(path);
		if (!bytes) return null;
		try {
			return Raster.fromPng(bytes);
		} catch {
			return null; // not a PNG this store wrote — someone else's file, left alone
		}
	}
}
