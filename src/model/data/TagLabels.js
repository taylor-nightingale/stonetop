import { toSlug } from "../../utils/slug.js";

/**
 * What a tag chip READS, as opposed to what it IS.
 *
 * A tag token is its own identity and its own label at once: `hasGroupTag` matches on it, and
 * TagGlossary is keyed by it. Translating the stored token would therefore break the behaviour it
 * drives — a follower tagged `Gruppe` is no longer a group. So the token stays English wherever it
 * is stored, and only the rendered text is localized, through this.
 *
 * Labels live in `languages/<lang>.json` under `stonetop.tagLabels`, keyed by the slugified token.
 * English needs no entries at all: with none, every tag falls back to the token, which is already
 * the English label. That also means a tag is translated ONCE rather than once per follower, NPC or
 * arcanum that happens to carry it.
 */
export class TagLabels {
	_bySlug;
	_byLabel;

	constructor(bySlug = new Map()) {
		this._bySlug = bySlug;
		// Reverse index, for reading back what a person typed. First label wins if two tags somehow
		// share one, so the mapping stays deterministic.
		this._byLabel = new Map();
		for (const [token, label] of bySlug) {
			const key = toSlug(label);
			if (!this._byLabel.has(key)) this._byLabel.set(key, token);
		}
	}

	static fromTranslations(tree = {}) {
		const entries = Object.entries(tree ?? {})
			.filter(([, label]) => typeof label === "string" && label.trim())
			.map(([token, label]) => [toSlug(token), label.trim()]);
		return new TagLabels(new Map(entries));
	}

	get isEmpty() {
		return this._bySlug.size === 0;
	}

	/**
	 * The label to show for a token, or the token itself when nothing translates it — an unknown tag
	 * is not an error, the book says plainly that "others are certainly possible".
	 */
	labelFor(token) {
		const raw = String(token ?? "");
		if (!raw.trim()) return raw;
		return this._bySlug.get(toSlug(raw)) ?? raw;
	}

	/**
	 * The canonical token behind something a person typed.
	 *
	 * The chip shows a translated label, which invites typing that label — and a tag stored as
	 * "Gruppe" is not a group, and has no glossary definition either, because both are keyed by the
	 * token. So a typed value is mapped back before it is stored.
	 *
	 * Nothing here knows any particular tag: it reverses whatever `tagLabels` defines, so a tag that
	 * gains behaviour later needs no change. Unknown input is returned untouched — a custom tag in
	 * any language stays exactly what its author wrote.
	 */
	tokenFor(input) {
		const raw = String(input ?? "").trim();
		if (!raw) return String(input ?? "");

		// A trailing count belongs to the tag, not to its name ("Gruppe (3)"): map the name and put
		// the count back. Only group/horde use counts today, but nothing here depends on that.
		const counted = raw.match(/^(.*?)\s*\((\d+)\)$/u);
		if (counted) {
			const base = this.tokenFor(counted[1]);
			return `${base} (${counted[2]})`;
		}

		const slug = toSlug(raw);
		if (this._bySlug.has(slug)) return raw;              // already canonical
		return this._byLabel.get(slug) ?? raw;
	}

	/** The label in force. Empty until the language file is read at i18nInit. */
	static current = new TagLabels();
}
