// Reconciles a translator's file against the English currently in packs/src.
//
// The point of the exercise: a translator works in a flat key→string file and never touches pack
// structure, so the two can drift apart without anyone noticing. Every drift has to be visible in
// the file itself rather than in a report nobody reads, which is what `needsReview` and `orphaned`
// are for — both are written into the file, and both keep the entry out of the shipped language
// file until a human clears them. Untranslated and unreviewed strings fall back to English, which
// is always correct if unhelpful; a silently stale translation is neither.

export const EntryStatus = Object.freeze({
	TRANSLATED:   "translated",
	UNTRANSLATED: "untranslated",
	NEEDS_REVIEW: "needsReview",
	ORPHANED:     "orphaned",
});

export class ReconciledEntry {
	constructor(key, source, text, status) {
		this.key    = key;
		this.source = source;
		this.text   = text;
		this.status = status;
	}

	get shipsToRuntime() {
		return this.status === EntryStatus.TRANSLATED;
	}

	/** The form written back into the translator's file. */
	toAuthoring() {
		const authored = { source: this.source, text: this.text };
		if (this.status === EntryStatus.NEEDS_REVIEW) authored.needsReview = true;
		if (this.status === EntryStatus.ORPHANED)     authored.orphaned    = true;
		return authored;
	}
}

export class ReconciledDocument {
	constructor(slug, entries) {
		this.slug    = slug;
		this.entries = entries;
	}

	countOf(status) {
		return this.entries.filter(e => e.status === status).length;
	}

	toAuthoring() {
		return Object.fromEntries(this.entries.map(e => [e.key, e.toAuthoring()]));
	}

	/** Key → translated string, for the shipped language file. */
	toRuntime() {
		return Object.fromEntries(this.entries.filter(e => e.shipsToRuntime).map(e => [e.key, e.text]));
	}
}

export class Reconciliation {
	constructor(lang, pack, documentsByType) {
		this.lang            = lang;
		this.pack            = pack;
		this.documentsByType = documentsByType;
	}

	get allEntries() {
		return [...this.documentsByType.values()].flatMap(docs => docs.flatMap(d => d.entries));
	}

	countOf(status) {
		return this.allEntries.filter(e => e.status === status).length;
	}

	entriesWith(status) {
		const found = [];
		for (const [type, documents] of this.documentsByType) {
			for (const document of documents) {
				for (const entry of document.entries) {
					if (entry.status === status) found.push({ type, slug: document.slug, entry });
				}
			}
		}
		return found;
	}

	get isClean() {
		return !this.countOf(EntryStatus.NEEDS_REVIEW) && !this.countOf(EntryStatus.ORPHANED);
	}

	toAuthoring() {
		const out = {};
		for (const documents of this.documentsByType.values()) {
			for (const document of documents) out[document.slug] = document.toAuthoring();
		}
		return out;
	}

	toRuntime() {
		const out = {};
		for (const [type, documents] of this.documentsByType) {
			const bySlug = {};
			for (const document of documents) {
				const strings = document.toRuntime();
				if (Object.keys(strings).length) bySlug[document.slug] = strings;
			}
			if (Object.keys(bySlug).length) out[type] = bySlug;
		}
		return out;
	}
}

// Allowlist order groups every label, then every description. A translator wants one background's
// label and description next to each other, so entries are regrouped by their key's parent — first
// appearance wins, which keeps name/description/statsNote at the top where they belong.
function groupOrdered(entries) {
	const groups = new Map();
	for (const entry of entries) {
		const slash = entry.key.lastIndexOf("/");
		const group = slash < 0 ? "" : entry.key.slice(0, slash);
		if (!groups.has(group)) groups.set(group, []);
		groups.get(group).push(entry);
	}
	return [...groups.values()].flat();
}

function reconcileEntry(key, english, authored) {
	if (!authored || typeof authored !== "object") {
		return new ReconciledEntry(key, english, "", EntryStatus.UNTRANSLATED);
	}
	const text = typeof authored.text === "string" ? authored.text : "";
	if (!text.trim()) return new ReconciledEntry(key, english, "", EntryStatus.UNTRANSLATED);

	// `source` is rewritten to the current English so the translator sees what to translate against;
	// `needsReview` is the durable mark, and only a human removes it.
	const drifted = authored.source !== english || authored.needsReview === true;
	return new ReconciledEntry(key, english, text, drifted ? EntryStatus.NEEDS_REVIEW : EntryStatus.TRANSLATED);
}

/**
 * @param {string} lang
 * @param {string} pack
 * @param {Map<string, Map<string, Map<string, string>>>} english  type → slug → key → English
 * @param {object} authoring  the translator's file, slug → key → {source, text, ...}
 */
export function reconcile(lang, pack, english, authoring = {}) {
	const documentsByType = new Map();

	for (const [type, bySlug] of english) {
		const documents = [];
		for (const [slug, strings] of bySlug) {
			const authored = authoring?.[slug] ?? {};
			const entries  = [...strings].map(([key, text]) => reconcileEntry(key, text, authored[key]));

			// Anything the translator has that the packs no longer do. Kept, never deleted: a key can
			// vanish because a row gained a slug, and their words are still worth moving by hand.
			for (const [key, authored_] of Object.entries(authored)) {
				if (strings.has(key)) continue;
				const text = typeof authored_?.text === "string" ? authored_.text : "";
				if (!text.trim()) continue;
				entries.push(new ReconciledEntry(key, authored_?.source ?? "", text, EntryStatus.ORPHANED));
			}
			documents.push(new ReconciledDocument(slug, groupOrdered(entries)));
		}
		documentsByType.set(type, documents);
	}
	return new Reconciliation(lang, pack, documentsByType);
}
