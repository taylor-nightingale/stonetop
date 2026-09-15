// Item sheet for authoring a `steadfast` — the definition of a place (Stonetop, Barrier Pass) a
// steading begins from. It presents the SAME profile a live steading shows (ratings + resources /
// fortifications, assets & coinage, places of interest, neighbouring places, the resident name/trait
// pool) as one scrolling page, built by the shared StonetopSteadfast typed-item and rendered through
// the shared steading section partials — so the two sheets can't drift. Granted improvements resolve
// to a read-only list (a steadfast is a template with no track state); drag an improvement item on to
// grant it, × to revoke.

import { enrichRichTextTree } from "../utils/enrichRichText.js";
import { bindAll } from "../utils/bindAll.js";
import { bindConfirmedDeletes } from "../utils/bindConfirmedDeletes.js";

export function createStonetopSteadfastSheetClass(Base) {
	return class StonetopSteadfastSheet extends Base {
		static DEFAULT_OPTIONS = {
			// `steading` opts this item sheet into the shared steading profile styling.
			classes: ["steadfast", "steading"],
			position: { width: 720, height: 820 },
		};

		static PARTS = {
			form: {
				template: "systems/stonetop/templates/item/steadfast.hbs",
				scrollable: [""],
			},
		};

		get _steadfast() {
			return this.item.typedItem;
		}

		async _prepareContext(options) {
			const context = await super._prepareContext(options);
			context.item     = this.item;
			context.editable = this.isEditable;
			context.stonetop = await this._steadfast.buildSnapshot();
			await enrichRichTextTree(context.stonetop, this.item?.getRollData?.() ?? {});
			return context;
		}

		// The drop target is the sheet root, which persists across re-renders — wire once.
		// (V2 item sheets have no built-in DragDrop; V1 used the dragDrop option.)
		async _onFirstRender(context, options) {
			await super._onFirstRender(context, options);
			this.element.addEventListener("dragover", ev => ev.preventDefault());
			this.element.addEventListener("drop", ev => this._onDrop(ev));
		}

		// Direct bindings to the current editor controls — re-run per render (part content is replaced).
		_onRender(context, options) {
			super._onRender(context, options);
			if (!this.isEditable) return;
			const root = this.element;
			const s = this._steadfast;

			// Ratings (size / population / prosperity / defenses / fortunes / surplus). Size stores its
			// tier string; the others store a number. The selector is the tile partial's input class —
			// this sheet has no change router, so the two have to move together.
			bindAll(root, ".steading-attr-input[data-attr]", "change", async ev => {
				const { attr } = ev.currentTarget.dataset;
				const raw = ev.currentTarget.value;
				await s.attributes.setValue(attr, attr === "size" ? raw : parseInt(raw));
			});

			// Resources / fortifications (the lists backing Prosperity / Defenses)
			bindAll(root, ".stonetop-attr-extra-add", "click", async ev => {
				await s.attributes.addNewItemToAttribute(ev.currentTarget.dataset.attr);
			});
			bindConfirmedDeletes(root, ".stonetop-attr-extra-remove", async ev => {
				await s.attributes.removeItemFromAttribute(ev.currentTarget.dataset.attr, parseInt(ev.currentTarget.dataset.index));
			});
			bindAll(root, ".stonetop-attr-extra", "change", async ev => {
				const { attr, index } = ev.currentTarget.dataset;
				await s.attributes.updateItemOnAttribute(attr, parseInt(index), ev.currentTarget.value);
			});

			// Asset items + coinage
			bindAll(root, ".stonetop-asset-item-add", "click", async () => { await s.assets.addItem(); });
			bindConfirmedDeletes(root, ".stonetop-asset-item-remove", async ev => {
				await s.assets.removeItem(parseInt(ev.currentTarget.dataset.index));
			});
			bindAll(root, ".stonetop-asset-item", "change", async ev => {
				await s.assets.updateItem(parseInt(ev.currentTarget.dataset.index), ev.currentTarget.value);
			});
			bindAll(root, ".stonetop-coinage-purses", "change", async ev => {
				await s.assets.updatePurses(ev.currentTarget.dataset.title, parseInt(ev.currentTarget.value) || 0);
			});
			bindAll(root, ".stonetop-coinage-handfuls", "change", async ev => {
				await s.assets.updateHandfuls(ev.currentTarget.dataset.title, parseInt(ev.currentTarget.value) || 0);
			});
			bindAll(root, ".stonetop-coinage-coins", "change", async ev => {
				await s.assets.updateCoins(ev.currentTarget.dataset.title, parseInt(ev.currentTarget.value) || 0);
			});

			// Places of Interest
			bindAll(root, ".stonetop-place-add", "click", async () => { await s.placesOfInterest.addBlankPlace(); });
			bindAll(root, ".stonetop-place-field", "change", async ev => {
				await s.placesOfInterest.setPlaceValue(parseInt(ev.currentTarget.dataset.index), ev.currentTarget.value);
			});

			// Neighbouring places. Size is authored HERE and nowhere else — it is what the book calls
			// the place, so it belongs to the definition, and migrateNeighborPlaces keeps every
			// steading's copy in step with it. The steading sheet only reads the word.
			bindAll(root, ".stonetop-neighbor-place-note", "change", async ev => {
				await s.neighborPlaces.updateNote(ev.currentTarget.dataset.id, ev.currentTarget.value);
			});
			bindAll(root, ".steading-neighbor-size-select", "change", async ev => {
				await s.neighborPlaces.updateSize(ev.currentTarget.dataset.id, ev.currentTarget.value);
			});
			// And the travel times, for the same reason: the steading shows a time only once it has
			// one, so a row the book prints nothing for is given its time here or nowhere.
			bindAll(root, ".steading-neighbor-travel", "change", async ev => {
				await s.neighborPlaces.updateTravel(ev.currentTarget.dataset.id, ev.currentTarget.value);
			});

			// Resident name/trait pool
			bindAll(root, ".stonetop-steadfast-resident-names", "change", async ev => {
				await s.setResidentNames(ev.currentTarget.value);
			});
			bindAll(root, ".steading-npc-traits-source", "change", async ev => {
				await s.setResidentTraits(ev.currentTarget.value.split("\n").map(t => t.trim()).filter(Boolean));
			});

			// Granted improvements — revoke (× / right-click); grant is drag-drop via _onDrop.
			bindConfirmedDeletes(root, ".steadfast-improvement-remove", async ev => {
				await s.revokeImprovement(ev.currentTarget.dataset.slug);
			});
		}

		async _onDrop(event) {
			const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
			if (data?.type !== "Item") return;
			const item = await Item.implementation.fromDropData(data);
			if (item?.type !== "improvement") return;
			await this._steadfast.grantImprovement(item.system?.slug);
		}
	};
}
