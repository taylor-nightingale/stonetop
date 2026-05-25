import { ChoiceOption, ChoiceRow } from "../../model/snapshot/character/ChoiceGroup.js";

export class CharacterAppearance {
	constructor(flags) {
		this._flags = flags;
	}

	get saved() {
		return this._flags.getFlag("selected") ?? {};
	}

	async select(rowKey, slug) {
		const current = this.saved;
		await this._flags.setFlag("selected", { ...current, [rowKey]: slug });
	}

	buildSnapshot(appearanceData) {
		const saved = this.saved;
		return (appearanceData ?? []).map((row, i) => new ChoiceRow(
			(row.options ?? []).map(o => new ChoiceOption(o.slug, { text: o.text, checked: saved?.[i] === o.slug })),
			{ inline: row.inline ?? true, rowKey: i, radio: true },
		));
	}
}
