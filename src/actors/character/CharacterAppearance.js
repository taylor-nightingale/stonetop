export class CharacterAppearance {
	constructor(flags, choiceController) {
		this._controller = choiceController;
	}

	async selectOption(slug, siblingSlugsCsv) {
		await this._controller.selectOption("appearance", slug, siblingSlugsCsv);
	}

	async buildSnapshot(groupData) {
		if (!groupData) return [];
		await this._controller.addGroup("appearance", groupData);
		return this._controller.buildGroupSnapshot("appearance").list;
	}
}
