import { ReleaseCompatibility } from "./ReleaseCompatibility.js";

// One release of this system as foundryvtt.com's package release API sees it.
// https://foundryvtt.com/article/package-release-api/
export class FoundryRelease {
	constructor({ id, version, manifestUrl, notesUrl, compatibility }) {
		this.id = id;
		this.version = version;
		this.manifestUrl = manifestUrl;
		this.notesUrl = notesUrl;
		this.compatibility = compatibility;
	}

	static fromManifest(manifest, { repository, tag }) {
		if (!repository) throw new Error("No repository given: set GITHUB_REPOSITORY or pass --repository owner/name.");
		if (!tag) throw new Error("No release tag given: set GITHUB_REF_NAME or pass --tag.");
		if (!manifest?.id) throw new Error("system.json is missing id.");
		if (!manifest?.version) throw new Error("system.json is missing version.");
		if (manifest.version !== tag.replace(/^v/, "")) {
			throw new Error(`system.json version ${manifest.version} does not match release tag ${tag}. Foundry reads the version from the manifest served at that tag, so the two must agree.`);
		}
		return new FoundryRelease({
			id: manifest.id,
			version: manifest.version,
			// The API rejects moving targets like /releases/latest/: this URL has to serve this
			// version's manifest permanently. system.json's own manifest field still points at
			// latest, which is what installed clients poll for updates.
			manifestUrl: `https://github.com/${repository}/releases/download/${tag}/system.json`,
			notesUrl: `https://github.com/${repository}/releases/tag/${tag}`,
			compatibility: ReleaseCompatibility.fromManifest(manifest.compatibility),
		});
	}

	toRequestBody({ dryRun = false } = {}) {
		const body = {
			id: this.id,
			release: {
				version: this.version,
				manifest: this.manifestUrl,
				notes: this.notesUrl,
				compatibility: this.compatibility.toRequestBody(),
			},
		};
		if (dryRun) body["dry-run"] = true;
		return body;
	}
}
