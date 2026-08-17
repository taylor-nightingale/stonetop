import { ChoiceValues } from "../../model/snapshot/character/ChoiceGroup.js";
import { ChoiceValueChange } from "../../model/data/ChoiceValueChange.js";

/**
 * Persists one choice-value store and announces every write. It does not know what any effect needs:
 * it publishes a ChoiceValueChange and each subscriber resolves what it cares about. Adding an effect
 * therefore touches no code here.
 */
export class ChoiceGroupController {
	constructor({ reader, writer, itemGetter, subscribers = [] }) {
		this._reader      = reader;
		this._writer      = writer;
		this._itemGetter  = itemGetter;
		this._subscribers = subscribers;
	}

	get _values() { return new ChoiceValues(this._reader()); }

	async selectOption(namespace, slug, siblingSlugsCsv) {
		const prevValues = this._values;
		let values = prevValues;
		const siblings = siblingSlugsCsv
			? siblingSlugsCsv.split(",").filter(s => s !== slug)
			: [];
		for (const sib of siblings) values = values.set(namespace, sib, 0);
		const newValues = values.set(namespace, slug, 1);
		await this._writer(newValues.toRaw());
		for (const sib of siblings) {
			if (prevValues.getCount(namespace, sib) > 0)
				await this._publish({ namespace, optionSlug: sib, count: 0, values: newValues, kind: "count" });
		}
		await this._publish({ namespace, optionSlug: slug, count: 1, values: newValues, kind: "count" });
	}

	async setCount(namespace, optionSlug, count) {
		const newValues = this._values.set(namespace, optionSlug, count);
		await this._writer(newValues.toRaw());
		await this._publish({ namespace, optionSlug, count, values: newValues, kind: "count" });
	}

	async setText(namespace, optionSlug, text) {
		const newValues = this._values.set(namespace, optionSlug, text);
		await this._writer(newValues.toRaw());
		await this._publish({ namespace, optionSlug, values: newValues, kind: "text" });
	}

	// Written as a deletion key rather than as the map minus the namespace: Foundry MERGES an update into
	// the stored object, so a key left out of the new map is not removed — it survives, and the cleared
	// group comes back as if nothing happened.
	async clearValues(namespace) {
		const remaining = this._values.without(namespace);
		await this._writer({ [`-=${namespace}`]: null });
		await this._publish({ namespace, values: remaining, kind: "clear" });
	}

	async _publish(fields) {
		if (!this._subscribers.length) return;
		const change = new ChoiceValueChange({ item: this._itemGetter?.() ?? null, ...fields });
		for (const subscriber of this._subscribers) await subscriber.handle(change);
	}
}

/**
 * Apply a pick the way the rendered row describes it: a row that named siblings is a "pick N of
 * these", so choosing releases the rest; a lone checkbox just sets or clears its own count.
 *
 * A free function rather than a method, because ChoiceGroupController is duck-typed — InstinctController
 * stands in for it by answering the same three methods — and this is a composition of two of them, not
 * a fourth thing every stand-in would have to reimplement identically.
 */
export async function applyPick(controller, target, checked = true) {
	return target.siblingsCsv
		? controller.selectOption(target.group, target.option, target.siblingsCsv)
		: controller.setCount(target.group, target.option, checked ? 1 : 0);
}

