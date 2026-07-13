// Writes extracted artwork into Foundry's user-data directory via the FilePicker
// API — the store lands at Data/stonetop-art/, next to the system, exactly where
// the pack references expect it. Works on hosted servers: uploads go through the
// normal Foundry file API, no filesystem access needed.

export class FoundryArtWriter {
	/**
	 * @param {{createDirectory: Function, upload: Function}} filePicker a FilePicker-like API
	 * @param {{source?: string, root?: string}} [options]
	 */
	constructor(filePicker, { source = "data", root = "stonetop-art" } = {}) {
		this._filePicker = filePicker;
		this._source = source;
		this._root = root;
	}

	/**
	 * Upload every found file, creating store directories as needed.
	 * @param {import("./BookArtExtractor.js").FoundArt[]} arts
	 */
	async write(arts) {
		const dirs = new Set([this._root]);
		for (const art of arts) {
			const slash = art.path.lastIndexOf("/");
			if (slash > 0) dirs.add(`${this._root}/${art.path.slice(0, slash)}`);
		}
		for (const dir of [...dirs].sort()) await this._ensureDirectory(dir);

		for (const art of arts) {
			const slash = art.path.lastIndexOf("/");
			const dir = slash > 0 ? `${this._root}/${art.path.slice(0, slash)}` : this._root;
			const name = art.path.slice(slash + 1);
			const file = new File([art.bytes], name, { type: "image/png" });
			await this._filePicker.upload(this._source, dir, file, {}, { notify: false });
		}
	}

	async _ensureDirectory(path) {
		try {
			await this._filePicker.createDirectory(this._source, path);
		} catch (e) {
			// Already existing is fine; anything else (permissions, quota) must surface.
			if (!String(e?.message ?? e).includes("EEXIST")) throw e;
		}
	}
}
