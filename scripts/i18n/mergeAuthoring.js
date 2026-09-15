// Unions two versions of a translator's authoring file — ours and an incoming installment.
//
// Git cannot merge these usefully. The files are machine-written, every entry is a four-line block,
// and a textual merge happily pairs one side's `text` with the other side's `source` — which reads
// as a current translation of English that has since changed, exactly the silent staleness the
// `source` field exists to prevent. So the merge is done per key instead, on the parsed documents.
//
// Which side wins is not symmetric: an incoming installment is the translator's newer work and wins
// wherever it carries German. But it is NOT a superset of ours — keys we rehomed by hand since they
// last pulled hold German their file has never seen — so ours is kept wherever theirs is blank.
// Taking theirs wholesale drops precisely that hand-migrated work.

/** One entry as it sits in an authoring file, before reconciliation against the packs. */
export class AuthoredEntry {
	constructor(source = "", text = "", { needsReview = false, orphaned = false } = {}) {
		this.source      = source;
		this.text        = text;
		this.needsReview = needsReview;
		this.orphaned    = orphaned;
	}

	static fromJson(json) {
		return new AuthoredEntry(
			typeof json?.source === "string" ? json.source : "",
			typeof json?.text   === "string" ? json.text   : "",
			{ needsReview: json?.needsReview === true, orphaned: json?.orphaned === true },
		);
	}

	get hasText() {
		return this.text.trim().length > 0;
	}

	/**
	 * The entry that survives when both sides hold one. Review markers are durable — only a human
	 * clears them — so a side that won carries its own marker forward rather than losing it to the
	 * other side's silence.
	 */
	preferring(other) {
		return other?.hasText ? other : this;
	}

	toJson() {
		const json = { source: this.source, text: this.text };
		if (this.needsReview) json.needsReview = true;
		if (this.orphaned)    json.orphaned    = true;
		return json;
	}
}

/** One authoring file: slug → key → entry. */
export class AuthoringFile {
	constructor(documents = new Map()) {
		this.documents = documents;
	}

	static fromJson(json) {
		const documents = new Map();
		for (const [slug, keys] of Object.entries(json ?? {})) {
			const entries = new Map();
			for (const [key, entry] of Object.entries(keys ?? {})) entries.set(key, AuthoredEntry.fromJson(entry));
			documents.set(slug, entries);
		}
		return new AuthoringFile(documents);
	}

	entryAt(slug, key) {
		return this.documents.get(slug)?.get(key) ?? null;
	}

	get translatedCount() {
		return [...this.documents.values()].reduce(
			(n, entries) => n + [...entries.values()].filter(e => e.hasText).length, 0);
	}

	/** Union with an incoming installment: its German wins where it has any, ours survives where not. */
	mergedWith(incoming) {
		const documents = new Map();
		const slugs = new Set([...this.documents.keys(), ...incoming.documents.keys()]);

		for (const slug of slugs) {
			const mine   = this.documents.get(slug)     ?? new Map();
			const theirs = incoming.documents.get(slug) ?? new Map();
			const entries = new Map();

			for (const key of new Set([...mine.keys(), ...theirs.keys()])) {
				const ours  = mine.get(key);
				const other = theirs.get(key);
				entries.set(key, ours ? ours.preferring(other) : other);
			}
			documents.set(slug, entries);
		}
		return new AuthoringFile(documents);
	}

	toJson() {
		const out = {};
		for (const [slug, entries] of this.documents) {
			out[slug] = Object.fromEntries([...entries].map(([key, entry]) => [key, entry.toJson()]));
		}
		return out;
	}
}
