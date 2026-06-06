import { ChoiceValues } from "../../model/snapshot/character/ChoiceGroup.js";

export class ChoiceGroupController {
	constructor({ reader, writer, definitionGetter, handlers = [] }) {
		this._reader           = reader;
		this._writer           = writer;
		this._definitionGetter = definitionGetter;
		this._handlers         = handlers;
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
				await this._fireSideEffects(namespace, sib, 0, newValues);
		}
		await this._fireSideEffects(namespace, slug, 1, newValues);
	}

	async setCount(namespace, optionSlug, count) {
		const newValues = this._values.set(namespace, optionSlug, count);
		await this._writer(newValues.toRaw());
		await this._fireSideEffects(namespace, optionSlug, count, newValues);
	}

	async setText(namespace, optionSlug, text) {
		const newValues = this._values.set(namespace, optionSlug, text);
		await this._writer(newValues.toRaw());
	}

	async clearValues(namespace) {
		const raw = { ...this._values.toRaw() };
		delete raw[namespace];
		await this._writer(raw);
	}

	async _fireSideEffects(namespace, optionSlug, count, newValues) {
		if (!this._handlers.length) return;
		const def = this._definitionGetter?.(namespace);
		if (!def) return;

		let target = null;
		for (const row of def.list ?? []) {
			if (row.slug === optionSlug) { target = row; break; }
			for (const opt of row.options ?? []) {
				if (opt.slug === optionSlug) { target = opt; break; }
			}
			if (target) break;
		}
		if (!target) return;

		for (const handler of this._handlers) {
			await handler.apply(target, namespace, optionSlug, count, newValues);
		}
	}
}
