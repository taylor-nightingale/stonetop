import { ChoiceGroupController } from "./ChoiceGroupController.js";

export class CharacterAppearance {
	constructor(flags) {
		this._controller = new ChoiceGroupController(flags);
	}

	async selectOption(slug, siblingSlugsCsv) {
		await this._controller.selectOption("appearance", slug, siblingSlugsCsv);
	}

	buildSnapshot(groupData) {
		if (!groupData) return [];
		return this._controller.buildGroup(groupData).list;
	}
}
