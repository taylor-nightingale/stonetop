import { FrontOnOpen } from "../../../utils/front-on-open.js";
import { SPECIAL_ITEM_FOOTNOTE, relativeValueTooltip } from "../../../data/special-items.js";

/**
 * Lets the player add a handout "Special Item" (Weapons of War, Bronze Weapons,
 * Armor, etc.) to their character. Items live in the inventory compendium flagged
 * `special: true`; this picker lists them grouped by category and, on click,
 * invokes `onAdd(slug)` to record it on the actor.
 */
export class SpecialItemPickerDialog extends Application {
	constructor(catalog, onAdd, options = {}) {
		super(options);
		this._catalog = catalog;
		this._onAdd = onAdd;
		this._frontOnOpen = new FrontOnOpen(this);
	}

	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id: "stonetop-special-item-picker",
			title: "Add Special Item",
			template: "systems/stonetop/templates/dialogs/special-item-picker.hbs",
			width: 720,
			height: "auto",
			resizable: true,
			classes: ["stonetop", "stonetop-special-item-picker"],
		});
	}

	async _render(force, options) {
		await super._render(force, options);
		this._frontOnOpen.apply();
	}

	async close(options = {}) {
		this._frontOnOpen.stop();
		return super.close(options);
	}

	getData() {
		// Split into two columns; the second column begins at "Transport".
		// Decorate each item with a Relative Value tooltip for its Value cell.
		const decorate = group => ({
			category: group.category,
			items: group.items.map(i => ({ ...i, valueTooltip: relativeValueTooltip(i.value) })),
		});
		const splitAt = this._catalog.findIndex(g => g.category === "Transport");
		const idx = splitAt < 0 ? Math.ceil(this._catalog.length / 2) : splitAt;
		return {
			columns: [this._catalog.slice(0, idx).map(decorate), this._catalog.slice(idx).map(decorate)],
			footnote: SPECIAL_ITEM_FOOTNOTE,
		};
	}

	activateListeners(html) {
		super.activateListeners(html);
		this._frontOnOpen.start();
		const root = html[0];

		root.querySelectorAll(".stonetop-special-pick").forEach(btn => {
			btn.addEventListener("click", async () => {
				if (btn.disabled) return;
				btn.disabled = true;
				btn.classList.add("is-added");
				await this._onAdd(btn.dataset.slug);
			});
		});

		root.querySelector(".stonetop-special-picker-close")?.addEventListener("click", () => this.close());
	}
}
