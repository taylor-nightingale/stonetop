// Reads a world's installed artwork (Data/stonetop-art/) by store-relative path. Each folder is listed
// once and only files it holds are fetched, so art that was never installed — Book I is optional —
// costs one listing rather than a 404 per image.

export class InstalledArtReader {
	/**
	 * @param {object} deps
	 * @param {{browse: (source: string, dir: string) => Promise<{files?: string[]}>}} deps.picker
	 * @param {(url: string, init?: object) => Promise<{ok: boolean, arrayBuffer: () => Promise<ArrayBuffer>}>} deps.fetch
	 * @param {(path: string) => string} deps.url a data-relative path's URL on this server
	 * @param {string} [deps.root]
	 */
	constructor({ picker, fetch, url, root = "stonetop-art" }) {
		this._picker = picker;
		this._fetch = fetch;
		this._url = url;
		this._root = root;
		this._listings = new Map(); // folder → Promise<Set<file name>>
	}

	/** @returns {Promise<Uint8Array|null>} the file's bytes, or null when it is not installed */
	async read(path) {
		const slash = path.lastIndexOf("/");
		const dir = slash > 0 ? `${this._root}/${path.slice(0, slash)}` : this._root;
		if (!(await this._listing(dir)).has(path.slice(slash + 1))) return null;
		// Past the browser's cache: the file may be about to be rewritten in place, and a cached copy
		// would be judged instead of what is on disk.
		const response = await this._fetch(this._url(`${this._root}/${path}`), { cache: "reload" });
		return response.ok ? new Uint8Array(await response.arrayBuffer()) : null;
	}

	_listing(dir) {
		if (!this._listings.has(dir)) {
			this._listings.set(dir, this._picker.browse("data", dir)
				.then(result => new Set((result?.files ?? []).map(f => decodeURIComponent(f.slice(f.lastIndexOf("/") + 1)))))
				.catch(() => new Set())); // browse throws when the folder doesn't exist
		}
		return this._listings.get(dir);
	}
}
