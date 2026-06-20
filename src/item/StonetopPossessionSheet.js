// Item sheet for authoring custom `possession` (special possession) items — full parity with
// PossessionData. Rich description, an optional resource pool/track, a single `choices` group, a
// list of granted outfit items, and a uses-scaling rule (per-even-level / per-move). The choices
// group reuses the shared choiceGroupEdit helpers + choiceGroupEditorMixin + choice-group-editor
// partial; the resource block reuses the arcanum-resource partial (generic). Foundry's ItemSheet
// auto-saves `name`/`system.*` form inputs and auto-activates the `data-edit` rich editor.
//
// `system.resource` / `system.scaling` are opaque ObjectFields: scalar `name=`-input writes (e.g.
// resource.max, scaling.perEvenLevel) rely on Foundry's recursive merge to preserve siblings;
// whole-object toggles write the field directly. `system.outfitItems` / `system.scaling.perMove`
// are arrays — every edit (add/remove AND per-field) rewrites the whole array via a change handler,
// since name=-bound array inputs would be mangled into {0:…} objects by form expansion.

import * as CG from "../utils/choiceGroupEdit.js";
import { activateChoiceGroupEditors } from "./choiceGroupEditorMixin.js";

const BLANK_RESOURCE   = () => ({ max: 1, maxStat: null, title: null, labels: [] });
const BLANK_OUTFIT_ITEM = () => ({ slug: "", name: "", weight: 0, inventoryColumn: "regular" });
const BLANK_SCALING    = () => ({ perEvenLevel: null, perMove: [] });
const BLANK_PER_MOVE   = () => ({ moveSlug: "", amount: 1 });

export function createStonetopPossessionSheetClass(Base) {
	return class StonetopPossessionSheet extends Base {
		static get defaultOptions() {
			return foundry.utils.mergeObject(super.defaultOptions, {
				classes: ["stonetop", "sheet", "item", "possession"],
				width:  600,
				height: 720,
				resizable: true,
			});
		}

		get template() {
			return "systems/stonetop/templates/item/possession.hbs";
		}

		async getData() {
			const context = await super.getData();
			// Possessions are referenced by a stable slug — playbook grants list them and granted
			// outfit items are sourced as `possession:<slug>`, so it must survive a rename. Generate a
			// random one once if missing (not name-derived), mirroring the insert sheet.
			if (!this.item.system.slug) {
				await this.item.update({ "system.slug": `custom-possession-${foundry.utils.randomID(8)}` });
			}
			const sys = this.item.system;
			context.system    = sys;
			context.choicesRows = sys.choices ? CG.buildRows(sys.choices) : null;
			return context;
		}

		activateListeners(html) {
			super.activateListeners(html);
			if (!this.isEditable) return;

			activateChoiceGroupEditors(this, html); // entry/pick row editing for the single choices group

			// Choices group lifecycle — a single group at system.choices (null when absent).
			html.find(".possession-choices-add-group").on("click", () =>
				this.item.update({ "system.choices": CG.newGroup("choices") }));
			html.find(".possession-choices-remove-group").on("click", () =>
				this.item.update({ "system.choices": null }));

			// Optional resource (a pool / track) — toggle on/off + labels list (shared with arcanum).
			html.find(".arcanum-resource-toggle").on("click", ev => {
				const path = ev.currentTarget.dataset.path;
				const has  = foundry.utils.getProperty(this.item, path) != null;
				this.item.update({ [path]: has ? null : BLANK_RESOURCE() });
			});
			html.find(".arcanum-resource-labels").on("change", ev => {
				const path   = ev.currentTarget.dataset.path;
				const labels = ev.currentTarget.value ? ev.currentTarget.value.split(",").map(s => s.trim()).filter(Boolean) : [];
				this.item.update({ [`${path}.labels`]: labels });
			});

			// Top-level granted outfit items — bespoke list editor. Both add/remove AND per-field
			// edits rewrite the whole array (never name=-bound: Foundry's form expansion would turn
			// the ArrayField into a {0:…,1:…} object).
			const outfit    = () => foundry.utils.deepClone(this.item.system.outfitItems ?? []);
			const setOutfit = list => this.item.update({ "system.outfitItems": list });
			html.find(".possession-outfit-add").on("click", () => {
				const list = outfit(); list.push(BLANK_OUTFIT_ITEM()); setOutfit(list);
			});
			html.find(".possession-outfit-remove").on("click", ev => {
				const list = outfit(); list.splice(Number(ev.currentTarget.dataset.index), 1); setOutfit(list);
			});
			html.find(".possession-outfit-field").on("change", ev => {
				const el = ev.currentTarget;
				const list = outfit();
				const item = list[Number(el.dataset.index)];
				if (!item) return;
				item[el.dataset.field] = el.type === "number" ? (el.value ? Number(el.value) : 0) : el.value;
				setOutfit(list);
			});

			// Uses-scaling — toggle on/off, plus a per-move list (whole-array writes).
			html.find(".possession-scaling-toggle").on("click", () => {
				const has = this.item.system.scaling != null;
				this.item.update({ "system.scaling": has ? null : BLANK_SCALING() });
			});
			const perMove    = () => foundry.utils.deepClone(this.item.system.scaling?.perMove ?? []);
			const setPerMove = list => this.item.update({ "system.scaling.perMove": list });
			html.find(".possession-scaling-move-add").on("click", () => {
				const list = perMove(); list.push(BLANK_PER_MOVE()); setPerMove(list);
			});
			html.find(".possession-scaling-move-remove").on("click", ev => {
				const list = perMove(); list.splice(Number(ev.currentTarget.dataset.index), 1); setPerMove(list);
			});
			html.find(".possession-scaling-move-field").on("change", ev => {
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
