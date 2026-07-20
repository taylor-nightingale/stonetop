// Item sheet for authoring custom `possession` (special possession) items — full parity with
// PossessionData. Rich description, an optional resource pool/track, a single `choices` group, a
// list of granted outfit items, and a uses-scaling rule (per-even-level / per-move). The choices
// group reuses the shared choiceGroupEdit helpers + choiceGroupEditorMixin + choice-group-editor
// partial; the resource block reuses the arcanum-resource partial (generic). The V2 form's
// submitOnChange auto-saves `name`/`system.*` inputs, including the <prose-mirror> description.
//
// `system.resource` / `system.scaling` are opaque ObjectFields: scalar `name=`-input writes (e.g.
// resource.max, scaling.perEvenLevel) rely on Foundry's recursive merge to preserve siblings;
// whole-object toggles write the field directly. `system.outfitItems` / `system.scaling.perMove`
// are arrays — every edit (add/remove AND per-field) rewrites the whole array via a change handler,
// since name=-bound array inputs would be mangled into {0:…} objects by form expansion.

import * as CG from "../utils/choiceGroupEdit.js";
import { activateChoiceGroupEditors } from "./choiceGroupEditorMixin.js";
import { bindAll } from "../utils/bindAll.js";
import { itemDescriptionRich } from "./itemDescriptionRich.js";
import { enrichRichTextTree } from "../utils/enrichRichText.js";

const BLANK_RESOURCE   = () => ({ max: 1, maxStat: null, title: null, labels: [] });
const BLANK_OUTFIT_ITEM = () => ({ slug: "", name: "", weight: 0, inventoryColumn: "regular" });
const BLANK_SCALING    = () => ({ perEvenLevel: null, perMove: [] });
const BLANK_PER_MOVE   = () => ({ moveSlug: "", amount: 1 });

export function createStonetopPossessionSheetClass(Base) {
	return class StonetopPossessionSheet extends Base {
		static DEFAULT_OPTIONS = {
			classes: ["possession"],
			position: { width: 600, height: 720 },
		};

		static PARTS = {
			form: {
				template: "systems/stonetop/templates/item/possession.hbs",
				scrollable: [""],
			},
		};

		async _prepareContext(options) {
			const context = await super._prepareContext(options);
			// Possessions are referenced by a stable slug — playbook grants list them and granted
			// outfit items are sourced as `possession:<slug>`, so it must survive a rename. Generate a
			// random one once if missing (not name-derived), mirroring the insert sheet.
			if (!this.item.system.slug) {
				await this.item.update({ "system.slug": `custom-possession-${foundry.utils.randomID(8)}` });
			}
			const sys = this.item.system;
			context.item      = this.item;
			context.editable  = this.isEditable;
			context.system    = sys;
			context.choicesRows = sys.choices ? CG.buildRows(sys.choices) : null;
			context.rich = itemDescriptionRich(sys);
			await enrichRichTextTree(context.rich, this.item?.getRollData?.() ?? {});
			return context;
		}

		// Direct bindings to the current editor controls — re-run per render (part content is replaced).
		_onRender(context, options) {
			super._onRender(context, options);
			if (!this.isEditable) return;
			const root = this.element;

			activateChoiceGroupEditors(this, root); // entry/pick row editing for the single choices group

			// Choices group lifecycle — a single group at system.choices (null when absent).
			bindAll(root, ".possession-choices-add-group", "click", () =>
				this.item.update({ "system.choices": CG.newGroup(this.item.system.slug) }));
			bindAll(root, ".possession-choices-remove-group", "click", () =>
				this.item.update({ "system.choices": null }));

			// Optional resource (a pool / track) — toggle on/off + labels list (shared with arcanum).
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

			// Top-level granted outfit items — bespoke list editor. Both add/remove AND per-field
			// edits rewrite the whole array (never name=-bound: Foundry's form expansion would turn
			// the ArrayField into a {0:…,1:…} object).
			const outfit    = () => foundry.utils.deepClone(this.item.system.outfitItems ?? []);
			const setOutfit = list => this.item.update({ "system.outfitItems": list });
			bindAll(root, ".possession-outfit-add", "click", () => {
				const list = outfit(); list.push(BLANK_OUTFIT_ITEM()); setOutfit(list);
			});
			bindAll(root, ".possession-outfit-remove", "click", ev => {
				const list = outfit(); list.splice(Number(ev.currentTarget.dataset.index), 1); setOutfit(list);
			});
			bindAll(root, ".possession-outfit-field", "change", ev => {
				const el = ev.currentTarget;
				const list = outfit();
				const item = list[Number(el.dataset.index)];
				if (!item) return;
				item[el.dataset.field] = el.type === "number" ? (el.value ? Number(el.value) : 0) : el.value;
				setOutfit(list);
			});

			// Uses-scaling — toggle on/off, plus a per-move list (whole-array writes).
			bindAll(root, ".possession-scaling-toggle", "click", () => {
				const has = this.item.system.scaling != null;
				this.item.update({ "system.scaling": has ? null : BLANK_SCALING() });
			});
			const perMove    = () => foundry.utils.deepClone(this.item.system.scaling?.perMove ?? []);
			const setPerMove = list => this.item.update({ "system.scaling.perMove": list });
			bindAll(root, ".possession-scaling-move-add", "click", () => {
				const list = perMove(); list.push(BLANK_PER_MOVE()); setPerMove(list);
			});
			bindAll(root, ".possession-scaling-move-remove", "click", ev => {
				const list = perMove(); list.splice(Number(ev.currentTarget.dataset.index), 1); setPerMove(list);
			});
			bindAll(root, ".possession-scaling-move-field", "change", ev => {
				const el = ev.currentTarget;
				const list = perMove();
				const row = list[Number(el.dataset.index)];
				if (!row) return;
				row[el.dataset.field] = el.dataset.field === "amount" ? (el.value ? Number(el.value) : 0) : el.value;
				setPerMove(list);
			});
		}
	};
}
