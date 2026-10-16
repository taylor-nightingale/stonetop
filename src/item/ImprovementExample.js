/**
 * The improvement a new one starts as: a small, made-up example, every line of it the author's to
 * change. Its words live in the language files.
 *
 * A line or result whose words are not written is left out — and a result's mechanic with it, since
 * a result with no words would still do something nobody can see.
 */
const KEY = "stonetop.improvement.example";

export class ImprovementExample {
	constructor(i18n = game.i18n) {
		this._i18n = i18n;
	}

	get name() { return this._words("name"); }

	system(slug) {
		const list = [];
		const line = key => { const text = this._words(key); if (text) list.push({ type: "entry", content: { title: null, text }, track: null }); };
		const requirements = [];
		const requirement = key => {
			const text = this._words(key);
			if (!text) return;
			const rowSlug = `entry-${requirements.length}`;
			requirements.push(rowSlug);
			list.push({ type: "entry", slug: rowSlug, content: { title: null, text }, track: { max: 1 } });
		};
		line("line");
		line("heading");
		requirement("requirementOne");
		requirement("requirementTwo");

		const effects = [];
		const completion = this._words("completion");
		if (completion) effects.push({ when: { kind: "completed" }, change: { target: "fortunes", amount: 1 }, text: completion });
		const henceforth = this._words("henceforth");
		if (henceforth) effects.push({ when: { kind: "turn", seasons: ["spring"] }, text: henceforth });

		return { slug, choices: { slug, list }, requires: { all: requirements }, effects };
	}

	_words(key) {
		const full = `${KEY}.${key}`;
		return this._i18n.has(full) && this._i18n.localize(full) ? this._i18n.localize(full) : null;
	}
}
