// Item sheet for authoring a `steadfast` — the definition of a place (Stonetop, Barrier Pass) a
// steading begins from. It presents the SAME profile a live steading shows (ratings + resources /
// fortifications, assets & coinage, places of interest, neighbouring places, the resident name/trait
// pool) as one scrolling page, built by the shared StonetopSteadfast typed-item and rendered through
// the shared steading section partials — so the two sheets can't drift. Granted improvements resolve
// to a read-only list (a steadfast is a template with no track state); drag an improvement item on to
// grant it, × to revoke.

import { enrichRichTextTree } from "../utils/enrichRichText.js";
import { confirmDelete } from "../utils/confirmDelete.js";

export function createStonetopSteadfastSheetClass(Base) {
	return class StonetopSteadfastSheet extends Base {
		static get defaultOptions() {
			return foundry.utils.mergeObject(super.defaultOptions, {
				classes: ["stonetop", "sheet", "item", "steadfast"],
				width:  720,
				height: 820,
				resizable: true,
				scrollY: [".window-content"],
				submitOnChange: true,
				dragDrop: [{ dragSelector: null, dropSelector: "form" }],
			});
		}

		get template() {
			return "systems/stonetop/templates/item/steadfast.hbs";
		}

		get _steadfast() {
			return this.item.typedItem;
		}

		async getData() {
			const context = await super.getData();
			context.stonetop = await this._steadfast.buildSnapshot();
			await enrichRichTextTree(context.stonetop, this.item?.getRollData?.() ?? {});
			return context;
		}

		activateListeners(html) {
			super.activateListeners(html);
			if (!this.isEditable) return;

			const s = this._steadfast;

			// Destructive deletes route through the shared confirm gate: left-click asks first (showing the
			// row's `data-name`), right-click skips — same convention as the steading and character sheets.
			const withConfirm = (selector, run) => {
				html.find(selector)
					.on("click", async ev => { if (await confirmDelete(ev.currentTarget.dataset.name)) await run(ev); })
					.on("contextmenu", async ev => { ev.preventDefault(); await run(ev); });
			};

			// Ratings (size / population / prosperity / defenses). Size stores its tier string; the ±N
			// ratings store a number.
			html.find(".steading-box-input[data-attr]").on("change", async ev => {
				const { attr } = ev.currentTarget.dataset;
				const raw = ev.currentTarget.value;
				await s.attributes.setValue(attr, attr === "size" ? raw : parseInt(raw));
			});

			// Resources / fortifications (the lists backing Prosperity / Defenses)
			html.find(".stonetop-attr-extra-add").on("click", async ev => {
				await s.attributes.addNewItemToAttribute(ev.currentTarget.dataset.attr);
			});
			withConfirm(".stonetop-attr-extra-remove", async ev => {
				await s.attributes.removeItemFromAttribute(ev.currentTarget.dataset.attr, parseInt(ev.currentTarget.dataset.index));
			});
			html.find(".stonetop-attr-extra").on("change", async ev => {
				const { attr, index } = ev.currentTarget.dataset;
				await s.attributes.updateItemOnAttribute(attr, parseInt(index), ev.currentTarget.value);
			});

			// Asset items + coinage
			html.find(".stonetop-asset-item-add").on("click", async () => { await s.assets.addItem(); });
			withConfirm(".stonetop-asset-item-remove", async ev => {
				await s.assets.removeItem(parseInt(ev.currentTarget.dataset.index));
			});
			html.find(".stonetop-asset-item").on("change", async ev => {
				await s.assets.updateItem(parseInt(ev.currentTarget.dataset.index), ev.currentTarget.value);
			});
			html.find(".stonetop-coinage-purses").on("change", async ev => {
				await s.assets.updatePurses(ev.currentTarget.dataset.title, parseInt(ev.currentTarget.value) || 0);
			});
			html.find(".stonetop-coinage-handfuls").on("change", async ev => {
				await s.assets.updateHandfuls(ev.currentTarget.dataset.title, parseInt(ev.currentTarget.value) || 0);
			});
			html.find(".stonetop-coinage-coins").on("change", async ev => {
				await s.assets.updateCoins(ev.currentTarget.dataset.title, parseInt(ev.currentTarget.value) || 0);
			});

			// Places of Interest
			html.find(".stonetop-place-add").on("click", async () => { await s.placesOfInterest.addBlankPlace(); });
			html.find(".stonetop-place-field").on("change", async ev => {
				await s.placesOfInterest.setPlaceValue(parseInt(ev.currentTarget.dataset.index), ev.currentTarget.value);
			});

			// Neighbouring places (note per place)
			html.find(".stonetop-neighbor-place-note").on("change", async ev => {
				await s.neighborPlaces.updateNote(ev.currentTarget.dataset.id, ev.currentTarget.value);
			});

			// Resident name/trait pool
			html.find(".stonetop-steadfast-resident-names").on("change", async ev => {
				await s.setResidentNames(ev.currentTarget.value);
			});
			html.find(".steading-npc-traits-source").on("change", async ev => {
				await s.setResidentTraits(ev.currentTarget.value.split("\n").map(t => t.trim()).filter(Boolean));
			});

			// Granted improvements — revoke (× / right-click); grant is drag-drop via _onDrop.
			withConfirm(".steadfast-improvement-remove", async ev => {
				await s.revokeImprovement(ev.currentTarget.dataset.slug);
			});
		}

		async _onDrop(event) {
			const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
			if (data?.type !== "Item") return super._onDrop?.(event);
			const item = await Item.implementation.fromDropData(data);
			if (item?.type !== "improvement") return;
			await this._steadfast.grantImprovement(item.system?.slug);
		}
	};
}
