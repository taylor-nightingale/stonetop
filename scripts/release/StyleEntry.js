// One entry of a package manifest's `styles` array.
//
// Foundry accepts two shapes for it — a bare path, or `{src, layer}` — and reads `src` verbatim
// into the page head. Not as a <link>: system and module styles are `@import` statements inside an
// inline <style> (templates/views/layouts/main.hbs, v13 and v14 alike), and core's own sheets are
// the only ones that get a real <link>.
//
// That import carries no version, so a browser keeps a release's CSS until the cache entry dies of
// its own accord. Firefox does not even drop it on a force-reload — the cache bypass reaches the
// document's own subresources, not sheets an inline <style> imports — so a player who updates the
// system runs this release's templates against last release's stylesheet, and every class the
// release introduced is unstyled. Stamping the version onto `src` makes that impossible: the URL
// changes when the version does, and Express serves the same file whatever the query says.
export class StyleEntry {
	constructor(src, layer) {
		this.src = src;
		this.layer = layer;
	}

	static from(entry) {
		return typeof entry === "string" ? new StyleEntry(entry) : new StyleEntry(entry.src, entry.layer);
	}

	/** True for a path this package serves — the only kind the system's own version can speak for. */
	get isLocal() {
		return !/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(this.src);
	}

	/**
	 * The same entry, served from a URL that names `version`.
	 *
	 * Idempotent, and it re-stamps rather than appends: the release workflow patches a manifest that
	 * may already carry a previous run's stamp, and two `v` parameters would answer the question
	 * twice.
	 */
	withVersion(version) {
		if (!this.isLocal) return this;
		const [path, query = ""] = this.src.split(/\?(.*)/s);
		const params = new URLSearchParams(query);
		params.set("v", version);
		return new StyleEntry(`${path}?${params}`, this.layer);
	}

	/** Back to the shape it came in as — a bare path stays a bare path. */
	toJSON() {
		return this.layer === undefined ? this.src : { src: this.src, layer: this.layer };
	}
}
