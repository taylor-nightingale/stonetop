// The whole translation corpus at once, for the two things a single pack cannot see.
//
// `reconcile` deliberately works one pack at a time, which makes it blind in two directions:
//
//   a move pulled OUT of an arcanum or a background keeps its English byte for byte, but its
//   translation stays filed under the pack it left — orphaned there, and missing where it landed.
//   Three such moves were shipping untranslated with their German stranded one file away.
//
//   the same English occurs in many documents. "increase Fortunes by 1" is in twelve improvements
//   and "Consequences" in eighteen arcana. Asking a translator for each one separately is asking
//   the same question eighteen times.
//
// Both are settled by byte-identical English, never by similarity, so neither invents a
// translation: one relocates words a human already wrote, the other reuses them verbatim.

import { englishCatalogForPack } from "./packCatalog.js";
import { TRANSLATED_PACKS, readAuthoring } from "./files.js";

/** Where a string lives: which pack, which document, which key. */
export class CorpusAddress {
	constructor(pack, slug, key) {
		this.pack = pack;
		this.slug = slug;
		this.key  = key;
	}

	get label() {
		return `${this.pack}/${this.slug} ${this.key}`;
	}

	equals(other) {
		return other instanceof CorpusAddress
			&& this.pack === other.pack && this.slug === other.slug && this.key === other.key;
	}
}

/** A translation moved from the pack it was written in to the pack its string now lives in. */
export class Relocation {
	constructor(from, to, entry) {
		this.from  = from;
		this.to    = to;
		this.entry = entry;
	}
}

/** An untranslated string filled in from identical English translated elsewhere. */
export class MemoryFill {
	constructor(address, english, german, reusedFrom) {
		this.address    = address;
		this.english    = english;
		this.german     = german;
		this.reusedFrom = reusedFrom;
	}
}

/** Identical English that has been translated more than one way — a human has to choose. */
export class MemoryConflict {
	constructor(address, english, germans) {
		this.address = address;
		this.english = english;
		this.germans = germans;
	}
}

const hasText = (entry) => typeof entry?.text === "string" && entry.text.trim().length > 0;

// Paragraphs, because a container's translation is split up paragraph by paragraph when its text is
// broken into rows or pulled out into a move. Whole-text comparison misses that entirely: the
// missionary background's German is three paragraphs that now live at three different keys.
const MIN_PARAGRAPH = 40;
const paragraphsOf = (text) => String(text ?? "").split(/\n\s*\n/u)
	.map(p => p.replace(/\s+/gu, " ").trim()).filter(p => p.length >= MIN_PARAGRAPH);

/**
 * Every pack's English and authoring side by side.
 *
 * @param {Map<string, {english: Map<string, Map<string, string>>, authoring: object}>} packs
 *        pack name → slug → key → English, and the translator's file for that pack
 */
export class Corpus {
	constructor(packs) {
		this.packs = packs;
	}

	/** Flattens `englishCatalogForPack`'s type → slug → key nesting, since slugs are unique per pack. */
	static englishBySlug(catalog) {
		const bySlug = new Map();
		for (const documents of catalog.values()) {
			for (const [slug, strings] of documents) bySlug.set(slug, strings);
		}
		return bySlug;
	}

	/** Authored German filed at an address the packs no longer have a string for. */
	*orphans() {
		for (const [pack, { english, authoring }] of this.packs) {
			for (const [slug, entries] of Object.entries(authoring ?? {})) {
				const strings = english.get(slug);
				for (const [key, entry] of Object.entries(entries ?? {})) {
					if (!hasText(entry) || strings?.has(key)) continue;
					yield { address: new CorpusAddress(pack, slug, key), entry };
				}
			}
		}
	}

	/** Every address the packs do have a string for, with whatever is authored there. */
	*live() {
		for (const [pack, { english, authoring }] of this.packs) {
			for (const [slug, strings] of english) {
				for (const [key, text] of strings) {
					const address = new CorpusAddress(pack, slug, key);
					yield { address, english: text, entry: authoring?.[slug]?.[key] ?? null };
				}
			}
		}
	}

	/** English → addresses that hold it and have no translation yet. */
	vacantByEnglish() {
		const vacant = new Map();
		for (const { address, english, entry } of this.live()) {
			if (hasText(entry)) continue;
			if (!vacant.has(english)) vacant.set(english, []);
			vacant.get(english).push(address);
		}
		return vacant;
	}

	/** English → the distinct German it has been translated as, and where each came from. */
	germanByEnglish() {
		const german = new Map();
		for (const { address, english, entry } of this.live()) {
			if (!hasText(entry)) continue;
			if (!german.has(english)) german.set(english, new Map());
			const seen = german.get(english);
			if (!seen.has(entry.text.trim())) seen.set(entry.text.trim(), address);
		}
		return german;
	}

	/**
	 * Orphans whose English now lives in another document. Unique vacant target only: two documents
	 * holding the same English give no way to tell which one the words were written for.
	 */
	relocations() {
		const vacant = this.vacantByEnglish();
		const taken  = new Set();
		const moves  = [];

		for (const { address, entry } of this.orphans()) {
			if (!entry.source) continue;
			const targets = (vacant.get(entry.source) ?? []).filter(target => !target.equals(address));
			if (targets.length !== 1) continue;
			const target = targets[0];
			if (taken.has(target.label)) continue;
			taken.add(target.label);
			moves.push(new Relocation(address, target, entry));
		}
		return moves;
	}

	/**
	 * Untranslated strings whose English is already translated somewhere. Where that English has
	 * been translated two different ways, nothing is filled — the difference is the point, and a
	 * human picks.
	 */
	memoryFills() {
		const byEnglish = this.germanByEnglish();
		const fills     = [];
		const conflicts = [];

		for (const { address, english, entry } of this.live()) {
			if (hasText(entry)) continue;
			const candidates = byEnglish.get(english);
			if (!candidates?.size) continue;
			if (candidates.size > 1) {
				conflicts.push(new MemoryConflict(address, english, [...candidates.keys()]));
				continue;
			}
			const [[text, reusedFrom]] = [...candidates];
			fills.push(new MemoryFill(address, english, text, reusedFrom));
		}
		return { fills, conflicts };
	}

	/**
	 * Orphans every paragraph of which is already filed at a live key. The words are not lost by
	 * dropping these — they are all still in the corpus, just distributed across the keys that
	 * replaced the one the translator wrote against. Flagging them asks a human to re-file text that
	 * is already where it belongs.
	 *
	 * Paragraphs shorter than a sentence are ignored rather than matched: a short line turns up
	 * inside unrelated translations by coincidence, and coincidence is not coverage.
	 */
	redundantOrphans() {
		const live = new Set();
		for (const { entry } of this.live()) {
			if (hasText(entry)) for (const paragraph of paragraphsOf(entry.text)) live.add(paragraph);
		}

		const redundant = [];
		for (const { address, entry } of this.orphans()) {
			const paragraphs = paragraphsOf(entry.text);
			if (!paragraphs.length) continue;
			if (paragraphs.every(paragraph => live.has(paragraph))) redundant.push({ address, entry });
		}
		return redundant;
	}

	/** Applies relocations and fills to the authoring objects, returning what changed. */
	apply() {
		const moves = this.relocations();
		for (const { from, to, entry } of moves) {
			const target = this.packs.get(to.pack).authoring;
			target[to.slug] ??= {};
			target[to.slug][to.key] = { source: entry.source, text: entry.text };
			delete this.packs.get(from.pack).authoring[from.slug][from.key];
		}

		// Dropped after relocating, so a translation that was just moved into place counts as live
		// coverage for the orphan it came from.
		const redundant = this.redundantOrphans();
		for (const { address } of redundant) {
			delete this.packs.get(address.pack).authoring[address.slug][address.key];
		}

		// Fills are computed after the relocations are written in, so an address that just received a
		// relocated translation reads as translated and is never also filled over.
		const { fills, conflicts } = this.memoryFills();
		for (const fill of fills) {
			const target = this.packs.get(fill.address.pack).authoring;
			target[fill.address.slug] ??= {};
			target[fill.address.slug][fill.address.key] = { source: fill.english, text: fill.german };
		}
		return { relocations: moves, redundant, fills, conflicts };
	}
}

/**
 * Loads every translated pack for one language. Tag labels stay out: they are keyed by tag token
 * rather than by document, and are translated once for the whole system already.
 */
export async function corpusFor(lang, root = ".") {
	const packs = new Map();
	for (const pack of TRANSLATED_PACKS) {
		packs.set(pack, {
			english:   Corpus.englishBySlug(await englishCatalogForPack(pack, root)),
			authoring: await readAuthoring(lang, pack, root),
		});
	}
	return new Corpus(packs);
}
