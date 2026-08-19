const TEMPLATE = "systems/stonetop/templates/actor/partials/add-inventory-item-dialog.hbs";

/** What the add-item dialog collected. Small items are always weight 1. */
export class NewInventoryItem {
	constructor(name, weight, isRegular) {
		this.name = name;
		this.weight = weight;
		this.isRegular = isRegular;
	}

	static regular(name, weight) {
		return new NewInventoryItem(name, weight, true);
	}

	static small(name) {
		return new NewInventoryItem(name, 1, false);
	}
}

/**
 * Asks for a new custom inventory item.
 *
 * The regular and small columns differ only in whether a weight is collected, so one dialog covers
 * both and answers with a NewInventoryItem — or null when the player dismissed it or left the name
 * blank, which the caller treats identically.
 */
export class AddInventoryItemDialog {
	constructor({ renderTemplate, prompt, localize } = {}) {
		this._renderTemplate = renderTemplate
			?? ((path, data) => foundry.applications.handlebars.renderTemplate(path, data));
		this._prompt = prompt ?? (config => foundry.applications.api.DialogV2.prompt(config));
		this._localize = localize ?? (key => game.i18n.localize(key));
	}

	/** @returns {Promise<NewInventoryItem|null>} */
	async show({ isRegular }) {
		const content = await this._renderTemplate(TEMPLATE, { isRegular });
		const result = await this._prompt({
			window: {
				title: this._localize(isRegular ? "stonetop.inventory.addItem" : "stonetop.inventory.addSmallItem"),
			},
			content,
			ok: {
				label: this._localize("stonetop.inventory.addItemConfirm"),
				callback: (_event, button) => ({
					name:   button.form.elements.name.value.trim(),
					weight: isRegular ? (parseInt(button.form.elements.weight?.value) || 1) : 1,
				}),
			},
			rejectClose: false,
		});
		if (!result?.name) return null; // dismissed or blank
		return isRegular
			? NewInventoryItem.regular(result.name, result.weight)
			: NewInventoryItem.small(result.name);
	}
}
