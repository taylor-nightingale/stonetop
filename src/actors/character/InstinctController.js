import { rich } from "../../model/snapshot/RichText.js";

/**
 * A choice group whose options and free-text box are mutually exclusive: picking an option clears the
 * write-in, and writing in clears the pick. Both the playbook and an insert have one.
 *
 * It wraps a ChoiceGroupController and answers the same three methods with the same signatures, so
 * anything routing a choice write can use either without knowing which it holds. The namespace comes
 * from the caller — it is the group's slug, exactly as for any other group.
 */
export class InstinctController {
	constructor(ctrl) { this._ctrl = ctrl; }

	async selectOption(namespace, slug, siblingSlugsCsv) {
		await this._ctrl.selectOption(namespace, slug, siblingSlugsCsv);
		await this._ctrl.setText(namespace, "__custom", "");
	}

	async setCount(namespace, optionSlug, count) {
		await this._ctrl.setCount(namespace, optionSlug, count);
	}

	async setText(namespace, optionSlug, text) {
		if (optionSlug === "__custom") await this._ctrl.clearValues(namespace);
		await this._ctrl.setText(namespace, optionSlug, text);
	}

	/** Writing a custom instinct replaces any picked option outright. */
	async selectCustom(namespace, text) {
		await this._ctrl.clearValues(namespace);
		await this._ctrl.setText(namespace, "__custom", text);
	}

	static computeSelected(instinctGroup, choiceValues) {
		const checked = instinctGroup?.list[0]?.options?.find(o => o.checked) ?? null;
		// option.text/description may be a RichText or a bare string; rich() normalizes either to its
		// raw markdown for this computed display label (it lands in the custom-instinct text box).
		if (checked) {
			const text = rich(checked.text).raw;
			const desc = rich(checked.description).raw;
			return desc ? `${text} — ${desc}` : text;
		}
		return choiceValues.toRaw()?.instinct?.__custom || null;
	}
}
