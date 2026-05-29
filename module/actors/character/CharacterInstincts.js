import { ChoiceGroupController } from "./ChoiceGroupController.js";

export class CharacterInstincts {
	constructor(flags) {
		this._flags      = flags;
		this._controller = new ChoiceGroupController(flags);
	}

	get _custom() { return this._flags.getFlag("custom") ?? ""; }

	async selectOption(slug, siblingSlugsCsv) {
		await this._controller.selectOption("instinct", slug, siblingSlugsCsv);
		await this._flags.setFlag("custom", "");
	}

	async selectCustom(text) {
		await this._controller.clearValues();
		await this._flags.setFlag("custom", text);
	}

	buildSnapshot(instinctData) {
		if (!instinctData) return { group: null, selected: null };
		const group = this._controller.buildGroup(instinctData);
		const checkedOption = group.list[0]?.options?.find(o => o.checked) ?? null;
		const selected = checkedOption
			? `${checkedOption.text} — ${checkedOption.description}`
			: (this._custom || null);
		return { group, selected };
	}
}
