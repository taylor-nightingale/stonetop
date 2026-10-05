import { LIST_LABELS } from "../../snapshot/steading/EffectChip.js";

/**
 * The words a choice on the improvement editor writes — a heading's rule, a result's mechanic.
 *
 * Every template is the author's to write, in the language files. One that is absent or empty writes
 * nothing, so an unwritten template can never put a key into an improvement's text: the author then
 * writes those words by hand, as for any result only the table can carry out.
 */
const KEY = "stonetop.improvement.wording";

export class ImprovementWording {
	constructor(i18n = game.i18n) {
		this._i18n = i18n;
	}

	/** A section heading's words for its rule, as the first section or a later one. */
	heading(rule, isFirst) {
		if (rule.kind === "none") return null;
		return this._say(`${KEY}.heading.${isFirst ? "first" : "later"}.${rule.kind}`, { count: rule.count });
	}

	/** A result's words for what the sheet does about it, or null where only the author can say it. */
	result(result) {
		const rating = key => this._label(`stonetop.steading.attr.${key}`);
		switch (result.does) {
			case "change": {
				const up = result.amount >= 0;
				return this._say(`${KEY}.result.${up ? "increase" : "decrease"}`, { rating: rating(result.rating), amount: Math.abs(result.amount) });
			}
			case "list":
				return this._say(`${KEY}.result.list`, { entry: result.entry, list: this._label(LIST_LABELS[result.list] ?? "") });
			case "set":
				return this._say(`${KEY}.result.set`, { rating: rating(result.rating), value: result.setValue });
			default:
				return null;
		}
	}

	/**
	 * A result after a change to its choices: its words follow the choice while they are still the
	 * generated ones (or there are none yet), and stay as they are once the author has written them.
	 */
	follow(before, after) {
		const said = this.result(before);
		const says = this.result(after);
		const generated = before.text === "" || (said !== null && before.text === said);
		return generated && says !== null ? after.withText(says) : after;
	}

	_say(key, data) {
		if (!this._i18n.has(key) || !this._i18n.localize(key)) return null;
		return this._i18n.format(key, data);
	}

	_label(key) {
		return this._i18n.has(key) ? this._i18n.localize(key) : "";
	}
}
