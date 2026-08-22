// Item sheet for authoring `outfitItem` items — the inventory rows a character (or follower) can
// carry. The outfit repository picks up world items alongside the compendium ones
// (FoundryOutfitItemRepository), so anything authored here shows up in the inventory tab.
//
// Modeled on the improvement/arcanum sheets: a rendered VIEW (the row exactly as it appears in the
// inventory, with an Edit button) ⇄ a data EDITOR. The view renders through the SAME snapshot
// (toOutfitItemSnapshot) + outfit-item-row.hbs partial the character and follower inventories use —
// one render path. The V2 form's submitOnChange auto-saves `name`/`system.*` inputs.
//
// `system.resource` / `system.armor` are opaque ObjectFields. The resource block reuses the generic
// arcanum-resource partial (scalar `name=`-input writes rely on Foundry's recursive merge; the
// whole-object toggle writes the field directly). Armor is NOT name=-bound: an emptied number input
// would submit "" and `calculateArmor` treats any non-null as a number, so its fields go through a
// change handler that writes the whole object with ""→null.

import { bindAll } from "../utils/bindAll.js";
import { OutfitItem } from "../model/data/character/OutfitItem.js";
import { ResourceController } from "../actors/character/ResourceController.js";
import { toOutfitItemSnapshot } from "../model/snapshot/character/outfitSections.js";
import { enrichRichTextTree } from "../utils/enrichRichText.js";

const BLANK_RESOURCE = () => ({ max: 1, maxStat: null, title: null, labels: [] });
const BLANK_ARMOR    = () => ({ base: null, modifier: null });

export function createStonetopOutfitItemSheetClass(Base) {
	return class StonetopOutfitItemSheet extends Base {
		static DEFAULT_OPTIONS = {
			classes: ["outfit-item"], // concatenated onto the base's ["stonetop", "sheet", "item"]
			position: { width: 520, height: 620 },
			actions: {
				toggleEditMode: StonetopOutfitItemSheet.#onToggleEditMode,
			},
		};

		static PARTS = {
			form: {
				template: "systems/stonetop/templates/item/outfit-item.hbs",
				scrollable: [""],
			},
		};

		async _prepareContext(options) {
			const context = await super._prepareContext(options);
			// Inventory state (which rows are checked, each resource's pip count) is keyed by slug on
			// the character, so every outfit item needs a stable, unique one. Generate it once and not
			// from the name, so a rename can't orphan a character's state or collide with a pack item.
			// Read BEFORE stamping — the stamp below would otherwise make every item look authored.
			const isNew = !this.item.system.slug;
			if (this.isEditable && isNew) {
				await this.item.update({ "system.slug": `custom-outfit-${foundry.utils.randomID(8)}` });
			}
			const sys = this.item.system;
			context.item     = this.item;
			context.system   = sys;
			context.editable = this.isEditable;

			// Rendered view — the same snapshot + partial the inventory renders. Unchecked with an
			// empty resource track: a catalog item carries no per-character state of its own.
			context.preview = toOutfitItemSnapshot(
				OutfitItem.fromDocument(this.item),
				false,
				ResourceController.build(sys.resource, 0),
			);
			await enrichRichTextTree(context.preview, this.item?.getRollData?.() ?? {});

			// View-first: an authored item opens as the rendered row; a brand-new one (no slug yet, so
			// nothing has been authored) opens in the editor. A locked item is always view-only.
			if (this._editMode === undefined) this._editMode = isNew;
			if (!this.isEditable) this._editMode = false;
			context.editMode = this._editMode;
			return context;
		}

		// Bound directly to the current editor controls, which every render replaces — so this
		// re-runs per render
		_onRender(context, options) {
			super._onRender(context, options);
			if (!this.isEditable) return;
			const root = this.element;

			// Optional resource (a pool / track, e.g. Supplies' 6 uses) — shared with arcanum.
			bindAll(root, ".arcanum-resource-toggle", "click", ev => {
				const path = ev.currentTarget.dataset.path;
				const has  = foundry.utils.getProperty(this.item, path) != null;
				this.item.update({ [path]: has ? null : BLANK_RESOURCE() });
			});
			bindAll(root, ".arcanum-resource-labels", "change", ev => {
				const path   = ev.currentTarget.dataset.path;
				const labels = ev.currentTarget.value ? ev.currentTarget.value.split(",").map(s => s.trim()).filter(Boolean) : [];
				this.item.update({ [`${path}.labels`]: labels });
			});

			// Optional armor contribution — CharacterInventory.calculateArmor takes the HIGHEST `base`
			// of the checked items and adds every `modifier` to it. A blank field means "doesn't
			// contribute", so it must persist as null, never "" or 0.
			bindAll(root, ".outfit-armor-toggle", "click", () => {
				const has = this.item.system.armor != null;
				this.item.update({ "system.armor": has ? null : BLANK_ARMOR() });
			});
			bindAll(root, ".outfit-armor-field", "change", ev => {
				const el    = ev.currentTarget;
				const armor = { ...BLANK_ARMOR(), ...(this.item.system.armor ?? {}) };
				armor[el.dataset.field] = el.value === "" ? null : Number(el.value);
				this.item.update({ "system.armor": armor });
			});
		}

		// Edit/view toggle — only rendered when editable, so it needs no isEditable guard.
		static #onToggleEditMode(_event, target) {
			this._editMode = target.dataset.mode === "edit";
			this.render();
		}
	};
}
