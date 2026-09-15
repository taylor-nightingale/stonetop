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
	BROKEN_MARKUP: "brokenMarkup",
});

// Markup that has to survive translation byte for byte, because Foundry acts on it:
//
//   @UUID[Compendium.stonetop.moves.abc123]{Defy Danger}
//        the braces hold a label a translator SHOULD rewrite, the brackets a target they must not
//   [[/r 1d6]]
//        an inline roll — a follower's damage is often prose wrapped around one
//
// Both go on looking perfectly correct in the translation file once broken, which is why this is
// checked rather than trusted.
const UUID_TARGET = /@UUID\[([^\]]+)\]/gu;
const INLINE_ROLL = /\[\[[^\]]+\]\]/gu;

export function protectedMarkup(text) {
	const value = String(text ?? "");
	return [
		...[...value.matchAll(UUID_TARGET)].map(match => match[1]),
		...[...value.matchAll(INLINE_ROLL)].map(match => match[0]),
	].sort();
}

// Order-insensitive: a translator may reorder sentences, and that is their business. Which
// documents are linked and which dice are rolled, and how many times, is not.
function sameMarkup(english, translated) {
	const before = protectedMarkup(english);
	const after  = protectedMarkup(translated);
	return before.length === after.length && before.every((token, i) => token === after[i]);
}

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
		return !this.flaggedEntries.length;
	}

	/** Everything a human has to look at, tagged with the pack so it can be acknowledged by address. */
	get flaggedEntries() {
		return [EntryStatus.NEEDS_REVIEW, EntryStatus.BROKEN_MARKUP, EntryStatus.ORPHANED]
			.flatMap(status => this.entriesWith(status))
			.map(found => ({ ...found, pack: this.pack }));
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
	if (drifted) return new ReconciledEntry(key, english, text, EntryStatus.NEEDS_REVIEW);

	// Only worth checking once the translation is known to be current — against drifted English the
	// comparison says nothing.
	if (!sameMarkup(english, text)) return new ReconciledEntry(key, english, text, EntryStatus.BROKEN_MARKUP);
	return new ReconciledEntry(key, english, text, EntryStatus.TRANSLATED);
}

const translated = (entry) => typeof entry?.text === "string" && entry.text.trim().length > 0;

// A row that gains a slug takes its English with it: same row, same words, new address. When an
// orphan's English is still in the document under a different key, and that key has no translation
// of its own, the German belongs there — handing it back would have the translator retype words
// they already wrote. The move is decided by English equality alone, so it never guesses: the
// string being translated is byte-for-byte the one they translated.
//
// A unique vacant match only. Two live keys holding the same English is legitimate data and there
// is no way to tell which one was meant, so those stay orphaned for a human.
function rehomeOrphans(strings, authored) {
	const homeless = Object.entries(authored).filter(([key, entry]) =>
		!strings.has(key) && translated(entry) && entry.source);
	if (!homeless.length) return authored;

	const vacantByEnglish = new Map();
	for (const [key, english] of strings) {
		if (translated(authored[key])) continue;
		if (!vacantByEnglish.has(english)) vacantByEnglish.set(english, []);
		vacantByEnglish.get(english).push(key);
	}

	const rehomed = { ...authored };
	for (const [key, entry] of homeless) {
		const vacant = vacantByEnglish.get(entry.source);
		if (vacant?.length !== 1) continue;
		// An earlier orphan may already have claimed it; first one wins, the rest stay flagged.
		if (translated(rehomed[vacant[0]])) continue;
		rehomed[vacant[0]] = entry;
		delete rehomed[key];
	}
	return rehomed;
}

// A title that was folded into the row below it. The new English is the old title followed by the
// old text, and the translation of each half already exists — the title's under the orphaned key,
// the remainder under the live one, where on its own it reads as a fragment. Four Lightbearer rows
// were shipping "(wähle 1)" as the whole of a heading because of exactly this.
//
// Composition is allowed only when the English proves it: the live English must START with the
// orphan's English, so the two halves are known to be in that order and nothing else came between.
// It joins two human translations rather than writing one — but it is still a join, so every one is
// reported rather than applied silently.
function composeFoldedOrphans(strings, authored, onCompose) {
	const composed = { ...authored };
	for (const [key, orphan] of Object.entries(authored)) {
		if (strings.has(key) || !translated(orphan) || !orphan.source) continue;

		const hosts = [...strings].filter(([liveKey, english]) =>
			english !== orphan.source
			&& english.startsWith(orphan.source)
			&& translated(composed[liveKey])
			&& !composed[liveKey].text.includes(orphan.text.trim()));
		if (hosts.length !== 1) continue;

		const [hostKey, english] = hosts[0];
		const text = `${orphan.text.trim()} ${composed[hostKey].text.trim()}`;
		composed[hostKey] = { source: english, text };
		delete composed[key];
		onCompose?.({ key, hostKey, text });
	}
	return composed;
}

// The same German at two addresses is not two translations. An incoming installment still files a
// string under the key it had before that row gained a slug, so once the identical German is live
// at the new key the leftover is a duplicate, not lost work. This is the one case where an orphan
// is dropped rather than handed back: byte-identical text, same document, already filed correctly.
function withoutDuplicateOrphans(strings, authored) {
	const live = new Set();
	for (const [key, entry] of Object.entries(authored)) {
		if (strings.has(key) && translated(entry)) live.add(entry.text.trim());
	}
	if (!live.size) return authored;

	const kept = {};
	for (const [key, entry] of Object.entries(authored)) {
		if (!strings.has(key) && translated(entry) && live.has(entry.text.trim())) continue;
		kept[key] = entry;
	}
	return kept;
}

/**
 * @param {string} lang
 * @param {string} pack
 * @param {Map<string, Map<string, Map<string, string>>>} english  type → slug → key → English
 * @param {object} authoring  the translator's file, slug → key → {source, text, ...}
 */
export function reconcile(lang, pack, english, authoring = {}, { onCompose } = {}) {
	const documentsByType = new Map();

	for (const [type, bySlug] of english) {
		const documents = [];
		for (const [slug, strings] of bySlug) {
			const rehomed  = rehomeOrphans(strings, authoring?.[slug] ?? {});
			const folded   = composeFoldedOrphans(strings, rehomed, composed =>
				onCompose?.({ pack, slug, ...composed }));
			const authored = withoutDuplicateOrphans(strings, folded);
			const entries  = [...strings].map(([key, text]) => reconcileEntry(key, text, authored[key]));

			// Anything the translator has that the packs no longer do. Kept, never deleted: a key can
			// vanish because a row gained a slug, and their words are still worth moving by hand.
			for (const [key, authored_] of Object.entries(authored)) {
				if (strings.has(key) || !translated(authored_)) continue;
				entries.push(new ReconciledEntry(key, authored_?.source ?? "", authored_.text, EntryStatus.ORPHANED));
			}
			documents.push(new ReconciledDocument(slug, groupOrdered(entries)));
		}
		documentsByType.set(type, documents);
	}
	return new Reconciliation(lang, pack, documentsByType);
}
