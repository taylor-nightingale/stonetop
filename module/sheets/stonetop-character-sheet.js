export function createStonetopCharacterSheetClass(BaseSheet) {
	return class StonetopCharacterSheet extends BaseSheet {
		static get defaultOptions() {
			return foundry.utils.mergeObject(super.defaultOptions, {
				classes: ["pbta", "stonetop", "sheet", "actor", "character"],
				width: 720,
				height: 800,
			});
		}

		get template() {
			return "modules/stonetop/templates/actor/character-sheet.hbs";
		}

		async getData(options = {}) {
			const context = await super.getData(options);
			return context;
		}
	};
}
