// Item sheet for authoring custom `improvement` items — the steading-improvement catalog picks up
// world improvements alongside the compendium ones (FoundrySteadingImprovementRepository). Modeled on
// the arcanum/follower sheets: a rendered VIEW (the improvement as it appears on the steading, with an
// Edit button) ⇄ a data EDITOR. Full parity with ImprovementData: a `sortOrder` (where it lands in the
// catalog) and a single `choices` group (the improvement's requirement/track rows).
//
// The view and the steading sheet render an improvement through the SAME snapshot (ChoiceGroup) +
// improvement-group.hbs partial — one render path. The editor's choice-group reuses the shared
// choiceGroupEdit helpers + choiceGroupEditorMixin + choice-group-editor partial. The V2 form's
// submitOnChange auto-saves `name`/`system.*` form fields.
//
// First sheet on ApplicationV2. Expects the
// createStonetopItemSheetV2BaseClass() base, not the V1 ItemSheetBase.

import * as CG from "../utils/choiceGroupEdit.js";
import { activateChoiceGroupEditors } from "./choiceGroupEditorMixin.js";
import { buildChoiceGroup } from "../model/snapshot/character/buildChoiceGroup.js";
import { enrichRichTextTree } from "../utils/enrichRichText.js";

export function createStonetopImprovementSheetClass(Base) {
	return class StonetopImprovementSheet extends Base {
		static DEFAULT_OPTIONS = {
			classes: ["improvement"], // concatenated onto the base's ["stonetop", "sheet", "item"]
			position: { width: 600, height: 600 },
			actions: {
				toggleEditMode: StonetopImprovementSheet.#onToggleEditMode,
			},
		};

		static PARTS = {
			form: {
				template: "systems/stonetop/templates/item/improvement.hbs",
				// The part's single root element (.stonetop-improvement-sheet) is the scroll
				// container; "" is HandlebarsApplicationMixin's "the part root itself" selector.
				scrollable: [""],
			},
		};

		async _prepareContext(options) {
			const context = await super._prepareContext(options);
			// The catalog namespaces each improvement's track values by its choice group's slug, so
			// every custom improvement needs a stable, unique slug. Generate one once (not name-derived,
			// so a rename can't collide) and seed the choices group with the same slug.
			if (!this.item.system.slug) {
				const slug = `custom-improvement-${foundry.utils.randomID(8)}`;
				await this.item.update({ "system.slug": slug, "system.choices": CG.newGroup(slug) });
			}
			const sys = this.item.system;
			context.item = this.item;
			context.system = sys;
			context.editable = this.isEditable;
			context.choicesGroup = {
				slug:   sys.choices?.slug ?? sys.slug,
				cgPath: "system.choices",
				rows:   CG.buildRows(sys.choices),
			};

			// Rendered view — the SAME snapshot (ChoiceGroup) + improvement-group.hbs partial the steading
			// renders. Empty ChoiceValues → tracks show unchecked (a catalog improvement has no track
			// state of its own; that lives on each steading that adopts it).
			context.preview = buildChoiceGroup(sys.choices ?? { slug: sys.slug, list: [] });
			await enrichRichTextTree(context.preview, this.item?.getRollData?.() ?? {});

			// View-first: an authored improvement opens as the rendered view; a blank one (no rows yet)
			// opens in the editor. A locked (non-editable) item is always view-only.
			if (this._editMode === undefined) this._editMode = (sys.choices?.list?.length ?? 0) === 0;
			if (!this.isEditable) this._editMode = false;
			context.editMode = this._editMode;
			return context;
		}

		// Bound directly to the current editor controls, which every render replaces — so this
		// re-runs per render (NOT once in _onFirstRender).
		_onRender(context, options) {
			super._onRender(context, options);
			if (!this.isEditable) return;
			activateChoiceGroupEditors(this, this.element); // entry/pick row editing for the single choices group
		}

		// Edit/view toggle — only rendered when editable, so it needs no isEditable guard.
		static #onToggleEditMode(_event, target) {
			this._editMode = target.dataset.mode === "edit";
			this.render();
		}
	};
}
