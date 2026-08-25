import { blocksFromStored } from "./Advice.js";

/**
 * Book I's reference sidebars — the "what IS this" text that belongs beside a topic's advice.
 *
 * The steading's coinage panel is the case this exists for: its ? answers "how do we get more coin"
 * from the "If you want to…" spread (pp. 98-101), but the three fields under it are labelled Purses,
 * Handfuls and Coins, and nothing on the sheet says a handful is about ten coins. That is the Coins
 * sidebar (printed p. 93) — a different page of the book, so a separate lookup, shown in the same
 * window rather than behind a second button.
 *
 * Stored under `stonetop.reference` in `languages/en.json`, in the same `{ title, blocks }` shape as
 * advice (and rendered by the same template), written there by scripts/import/build-items.js.
 */
export class ReferenceSidebar {
	constructor(key, title, blocks = []) {
		this.key    = key;
		this.title  = title;
		this.blocks = blocks;
	}

	static fromStored(key, raw) {
		return new ReferenceSidebar(key, String(raw?.title ?? ""), blocksFromStored(raw));
	}
}

/**
 * The sidebars in force, looked up by the SAME key as the advice topic they accompany — a topic with
 * no sidebar is the normal case, and simply shows advice alone.
 */
export class Reference {
	constructor(sections = []) {
		this.byKey = new Map(sections.map(s => [s.key, s]));
	}

	/** Read out of a localization tree — `game.i18n.translations.stonetop.reference`. */
	static fromTranslations(tree = {}) {
		return new Reference(Object.entries(tree ?? {}).map(([key, raw]) => ReferenceSidebar.fromStored(key, raw)));
	}

	/** @returns {ReferenceSidebar|null} */
	lookup(key) {
		return this.byKey.get(key) ?? null;
	}

	/** Empty until the language file is read at i18nInit, so a dialog opened before then shows advice alone. */
	static current = new Reference();
}
