// Orchestrates an artwork install: scan the uploaded book PDF(s) with the
// extractor, then hand everything recognized to the writer. Pure coordination —
// pdf.js details live in BookArtExtractor, Foundry file I/O in FoundryArtWriter.

/** What an install achieved, for reporting back to the GM. */
export class InstallReport {
	/**
	 * @param {string[]} installed store paths written
	 * @param {string[]} missing manifest paths no uploaded book contained
	 */
	constructor(installed, missing) {
		this.installed = installed;
		this.missing = missing;
	}

	get complete() {
		return this.missing.length === 0;
	}
}

export class ArtInstaller {
	/**
	 * @param {import("./BookArtExtractor.js").BookArtExtractor} extractor
	 * @param {{write: (art: import("./BookArtExtractor.js").FoundArt[]) => Promise<void>}} writer
	 * @param {import("./ArtManifest.js").ArtManifest} manifest
	 */
	constructor(extractor, writer, manifest) {
		this._extractor = extractor;
		this._writer = writer;
		this._manifest = manifest;
	}

	/**
	 * Extract from each uploaded PDF and write everything recognized.
	 * @param {Array<ArrayBuffer|Uint8Array>} pdfs
	 * @param {{onProgress?: (p: {file: number, files: number, page: number, pages: number, found: number}) => void}} [callbacks]
	 * @returns {Promise<InstallReport>}
	 */
	async install(pdfs, { onProgress } = {}) {
		const found = new Map(); // path -> FoundArt, merged across books
		for (let i = 0; i < pdfs.length; i++) {
			const result = await this._extractor.extract(pdfs[i], {
				onProgress: ({ page, pages }) =>
					onProgress?.({ file: i + 1, files: pdfs.length, page, pages, found: found.size }),
			});
			for (const art of result.found) if (!found.has(art.path)) found.set(art.path, art);
		}
		await this._writer.write([...found.values()]);
		const missing = this._manifest.paths().filter((p) => !found.has(p)).sort();
		return new InstallReport([...found.keys()].sort(), missing);
	}
}
