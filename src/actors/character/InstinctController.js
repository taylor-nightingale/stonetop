export class InstinctController {
	constructor(ctrl) { this._ctrl = ctrl; }

	async selectOption(slug, siblingSlugsCsv) {
		await this._ctrl.selectOption("instinct", slug, siblingSlugsCsv);
		await this._ctrl.setText("instinct", "__custom", "");
	}

	async selectCustom(text) {
		await this._ctrl.clearValues("instinct");
		await this._ctrl.setText("instinct", "__custom", text);
	}

	async setText(optionSlug, text) {
		if (optionSlug === "__custom") await this._ctrl.clearValues("instinct");
		await this._ctrl.setText("instinct", optionSlug, text);
	}

	static computeSelected(instinctGroup, choiceValues) {
		const checked = instinctGroup?.list[0]?.options?.find(o => o.checked) ?? null;
		if (checked) return `${checked.text} — ${checked.description}`;
		return choiceValues.toRaw()?.instinct?.__custom || null;
	}
}
