import { StyleEntry } from "./StyleEntry.js";

// system.json as a release ships it, rather than as the working tree keeps it.
//
// Two things are true only of a released manifest: `download` names a tagged asset that does not
// exist until the release is cut, and every stylesheet is served from a URL carrying the version it
// belongs to. Neither belongs in the committed file — the download URL would name a release that
// has not happened, and a hand-written `?v=` is a second place to remember on every bump, which is
// exactly the drift the stamp exists to rule out.
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

	get styles() {
		return (this._manifest.styles ?? []).map(entry => StyleEntry.from(entry));
	}

	withDownloadUrl(url) {
		return new ReleaseManifest({ ...this._manifest, download: url });
	}

	/** Every stylesheet this package serves, addressed by a URL that changes when the version does. */
	withVersionedStyles() {
		if (!this._manifest.styles) return this;
		const styles = this.styles.map(entry => entry.withVersion(this.version).toJSON());
		return new ReleaseManifest({ ...this._manifest, styles });
	}

	toJSON() {
		return this._manifest;
	}
}
