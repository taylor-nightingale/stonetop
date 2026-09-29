// system.json as a release ships it, rather than as the working tree keeps it.
//
// `download` names a tagged asset that does not exist until the release is cut, so it is true only
// of a released manifest and never belongs in the committed file.
export class ReleaseManifest {
	constructor(manifest) {
		this._manifest = manifest;
	}

	static from(manifest) {
		if (!manifest?.version) throw new Error("system.json is missing version.");
		return new ReleaseManifest(manifest);
	}

	get version() {
		return this._manifest.version;
	}

	/**
	 * Every file this package serves by path. Foundry refuses to install a package when any of them is
	 * missing, and it looks the path up literally — `a.css?v=1` is a file named `a.css?v=1`.
	 */
	get includedFiles() {
		const { esmodules = [], scripts = [], styles = [], languages = [] } = this._manifest;
		return [
			...esmodules,
			...scripts,
			...styles.map(entry => (typeof entry === "string" ? entry : entry.src)),
			...languages.map(language => language.path),
		].filter(path => !/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(path));
	}

	withDownloadUrl(url) {
		return new ReleaseManifest({ ...this._manifest, download: url });
	}

	toJSON() {
		return this._manifest;
	}
}
