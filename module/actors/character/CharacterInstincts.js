import { ChoiceGroup, ChoiceValues } from "../../model/snapshot/character/ChoiceGroup.js";

export class CharacterInstincts {
	constructor(flags) {
		this._flags = flags;
	}

	get _values() { return new ChoiceValues(this._flags.getFlag("values") ?? {}); }
	get _custom()  { return this._flags.getFlag("custom") ?? ""; }

	async selectOption(slug, siblingSlugsCsv) {
		let values = this._values;
		if (siblingSlugsCsv) {
			for (const sib of siblingSlugsCsv.split(",")) values = values.set("instinct", sib, 0);
		}
		values = values.set("instinct", slug, 1);
		await this._flags.setFlag("values", values.toRaw());
		await this._flags.setFlag("custom", "");
	}

	async selectCustom(text) {
		await this._flags.setFlag("values", {});
		await this._flags.setFlag("custom", text);
	}

	buildSnapshot(instinctData) {
		if (!instinctData) return { group: null, selected: null };
		const group = ChoiceGroup.fromPackData(instinctData, this._values);
		const checkedOption = group.list[0]?.options?.find(o => o.checked) ?? null;
		const selected = checkedOption
			? `${checkedOption.text} — ${checkedOption.description}`
			: (this._custom || null);
		return { group, selected };
	}
}
