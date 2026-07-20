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

	async clearValues(namespace) {
		const raw = { ...this._values.toRaw() };
		delete raw[namespace];
		await this._writer(raw);
		await this._publish({ namespace, values: new ChoiceValues(raw), kind: "clear" });
	}

	async _publish(fields) {
		if (!this._subscribers.length) return;
		const change = new ChoiceValueChange({ item: this._itemGetter?.() ?? null, ...fields });
		for (const subscriber of this._subscribers) await subscriber.handle(change);
	}
}
