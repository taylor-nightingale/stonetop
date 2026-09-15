// Entries a human has already looked at and handed back to the translator.
//
// `needsReview` and `orphaned` fail the check because they mean nobody has looked yet. Once someone
// has, the entry is not drift any more — it is work in the translator's queue, and failing the
// build every time it runs says nothing new. Acknowledging one here keeps it flagged in the
// translator's file and printed by the check, while letting genuinely NEW drift be the only thing
// that goes red.

/** One acknowledged entry, addressed the way the check addresses it: pack, document slug, key. */
export class AwaitingEntry {
	constructor(pack, slug, key) {
		this.pack = pack;
		this.slug = slug;
		this.key  = key;
	}

	matches(pack, slug, key) {
		return this.pack === pack && this.slug === slug && this.key === key;
	}

	get label() {
		return `${this.pack}/${this.slug} ${this.key}`;
	}

	withKey(key) {
		return new AwaitingEntry(this.pack, this.slug, key);
	}
}

export class AwaitingTranslator {
	constructor(entries = []) {
		this.entries = entries;
	}

	static empty() {
		return new AwaitingTranslator();
	}

	/** pack → slug → [key], the shape the file is authored in. */
	static fromJson(json) {
		const entries = [];
		for (const [pack, bySlug] of Object.entries(json ?? {})) {
			for (const [slug, keys] of Object.entries(bySlug ?? {})) {
				for (const key of keys ?? []) entries.push(new AwaitingEntry(pack, slug, key));
			}
		}
		return new AwaitingTranslator(entries);
	}

	static fromFlagged(flagged) {
		return new AwaitingTranslator(flagged.map(f => new AwaitingEntry(f.pack, f.slug, f.entry.key)));
	}

	get size() {
		return this.entries.length;
	}

	has(pack, slug, key) {
		return this.entries.some(entry => entry.matches(pack, slug, key));
	}

	/** Acknowledged entries that are no longer flagged — the translator has dealt with them. */
	staleAgainst(flagged) {
		const stillFlagged = (entry) => flagged.some(f => entry.matches(f.pack, f.slug, f.entry.key));
		return this.entries.filter(entry => !stillFlagged(entry));
	}

	/**
	 * The same acknowledgements after a key-scheme change. An acknowledgement addresses an entry, so
	 * it has to follow that entry to its new key — otherwise every renamed entry reads as new drift
	 * and the build goes red over work a human has already triaged.
	 *
	 * @param {string} pack
	 * @param {Map<string, Map<string, string>>} renames  slug → old key → new key
	 */
	renamed(pack, renames) {
		return new AwaitingTranslator(this.entries.map(entry => {
			if (entry.pack !== pack) return entry;
			const key = renames.get(entry.slug)?.get(entry.key);
			return key ? entry.withKey(key) : entry;
		}));
	}

	/** Only the entries for one pack, so a per-pack report need not scan the whole file. */
	forPack(pack) {
		return new AwaitingTranslator(this.entries.filter(entry => entry.pack === pack));
	}

	toJson() {
		const out = {};
		for (const { pack, slug, key } of this.entries) {
			out[pack]       ??= {};
			out[pack][slug] ??= [];
			out[pack][slug].push(key);
		}
		return out;
	}
}
