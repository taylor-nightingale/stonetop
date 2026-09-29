// One tagged GitHub release, and the URLs its assets are served from.
//
// Two things address the same release and neither should be spelling github.com out for itself: the
// manifest patch, which points `download` at this tag's zip, and the foundryvtt.com payload, which
// names this tag's system.json and release notes.
export class GitHubRelease {
	constructor(repository, tag) {
		this.repository = repository;
		this.tag = tag;
	}

	static from({ repository, tag } = {}) {
		if (!repository) throw new Error("No repository given: set GITHUB_REPOSITORY or pass --repository owner/name.");
		if (!tag) throw new Error("No release tag given: set GITHUB_REF_NAME or pass --tag.");
		return new GitHubRelease(repository, tag);
	}

	/** The version this tag names — tags are written both with and without the leading v. */
	get version() {
		return this.tag.replace(/^v/, "");
	}

	/** @param {string} filename an asset uploaded to this release */
	assetUrl(filename) {
		return `https://github.com/${this.repository}/releases/download/${this.tag}/${filename}`;
	}

	get notesUrl() {
		return `https://github.com/${this.repository}/releases/tag/${this.tag}`;
	}
}
