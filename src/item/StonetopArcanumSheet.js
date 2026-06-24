// Item sheet for authoring custom `arcanum` items — full parity with ArcanumData. Front (title, item,
// rich description, unlock track) + back (title, item / itemSameAsFront, rich description, resource,
// choices; major-only: mystery moves, consequences, unlockAt) + major/weight. The three choice groups
// (front.unlock, back.choices, back.consequences) reuse the shared choiceGroupEdit helpers +
// choiceGroupEditorMixin + choice-group-editor partial; the mystery-moves list uses arcanumMoveEdit.
// Foundry's ItemSheet auto-saves `name`/`system.*` form inputs and auto-activates the `data-edit`
// rich editors.
//
// front/back are opaque ObjectFields: nested writes (name= inputs, data-edit, the cg mixin's
// `item.update({"system.front.unlock": group})`) rely on Foundry's recursive merge to preserve
// siblings. getData initialises front/back to {} so there is always a merge target.

import * as CG from "../utils/choiceGroupEdit.js";
import * as AME from "../utils/arcanumMoveEdit.js";
import { activateChoiceGroupEditors } from "./choiceGroupEditorMixin.js";
import { Arcanum } from "../model/data/character/Arcanum.js";
import { buildArcanumSnapshot } from "../actors/character/arcanumSnapshot.js";
import { enrichRichTokens } from "../utils/enrichGameText.js";

const BLANK_ITEM     = () => ({ name: "", weight: 1, tags: null, note: null, inventoryColumn: null, twoCol: false, resource: null });
const BLANK_RESOURCE = () => ({ max: 1, maxStat: null, title: null, labels: [] });

// "Entirely blank" = no authored content on either side (name is ignored — a freshly created item
// always carries a default name). A blank arcanum opens straight in edit mode (nothing to view yet).
function isArcanumBlank(front = {}, back = {}) {
	const has = v => v != null && v !== "" && !(Array.isArray(v) && v.length === 0);
	return !(
		has(front.title) || has(front.description) || front.item != null || front.unlock != null ||
		has(back.title)  || has(back.description)  || back.item  != null || back.resource != null ||
		back.choices != null || (back.moves && back.moves.length) || back.consequences != null
	);
}

export function createStonetopArcanumSheetClass(Base) {
	return class StonetopArcanumSheet extends Base {
		static get defaultOptions() {
			return foundry.utils.mergeObject(super.defaultOptions, {
				classes: ["stonetop", "sheet", "item", "arcanum"],
				width:  980,
				height: 760,
				resizable: true,
			});
		}

		get template() {
			return "systems/stonetop/templates/item/arcanum.hbs";
		}

		async _render(force, options) {
			await super._render(force, options);
			// FormApplication._disableFields() disables EVERY button on a non-editable sheet (a locked
			// compendium arcanum). The flip / view-toggle buttons are pure view state, not edits — keep
			// them clickable so a locked arcanum can still show its back.
			this.element?.[0]
				?.querySelectorAll(".arcanum-preview-flip, .arcanum-edit-toggle")
				.forEach(btn => { btn.disabled = false; });
			// The preview card renders descriptions through {{md}}; upgrade explicit [[ ]] rolls /
			// @UUID links the same way the character sheet does.
			await enrichRichTokens(this.element?.[0], { rollData: this.item?.getRollData?.() ?? {} });
		}

		async getData() {
			const context = await super.getData();
			// One-time initialisation: a stable slug + front/back as objects (so nested edits merge).
			const init = {};
			if (!this.item.system.slug)          init["system.slug"]  = `custom-arcanum-${foundry.utils.randomID(8)}`;
			if (this.item.system.front == null)  init["system.front"] = {};
			if (this.item.system.back  == null)  init["system.back"]  = {};
			if (Object.keys(init).length) await this.item.update(init);

			const sys   = this.item.system;
			const front = sys.front ?? {};
			const back  = sys.back  ?? {};
			context.system   = sys;
			context.major    = !!sys.major;
			context.front    = front;
			context.back     = back;
			context.frontItem = front.item ?? null;
			context.backItem  = back.item  ?? null;
			// Whether each choice group EXISTS (so a freshly-added, still-empty group renders its editor —
			// `{{#if rows}}` would be false for an empty array). Rows may be [] for an empty group.
			context.hasUnlock        = front.unlock      != null;
			context.hasBackChoices   = back.choices      != null;
			context.hasConsequences  = back.consequences != null;
			context.unlockRows       = front.unlock      ? CG.buildRows(front.unlock)      : [];
			context.backChoiceRows   = back.choices      ? CG.buildRows(back.choices)      : [];
			context.consequenceRows  = back.consequences ? CG.buildRows(back.consequences) : [];
			context.mysteryMoves     = back.moves ?? [];

			// Live preview — the SAME snapshot builder + arcanum-cards.hbs partial the character uses.
			this._previewFlipped ??= false;
			const arcanum = new Arcanum({
				slug: sys.slug, major: sys.major, name: this.item.name, img: this.item.img, front, back,
			});
			context.preview        = [buildArcanumSnapshot(arcanum, { flipped: this._previewFlipped })];
			context.previewFlipped = this._previewFlipped;

			// View-first: an existing arcanum opens as a rendered card with an Edit button; a blank one
			// opens in the editor. A locked (non-editable) item is always view-only.
			if (this._editMode === undefined) this._editMode = isArcanumBlank(front, back);
			if (!this.isEditable) this._editMode = false;
			context.editMode = this._editMode;
			return context;
		}

		activateListeners(html) {
			super.activateListeners(html);

			// Flip + edit/view toggle must work even on a locked (non-editable) compendium arcanum.
			html.find(".arcanum-preview-flip").on("click", () => {
				this._previewFlipped = !this._previewFlipped;
				this.render(false);
			});
			html.find(".arcanum-edit-toggle").on("click", ev => {
				this._editMode = ev.currentTarget.dataset.mode === "edit";
				this.render(false);
			});

			if (!this.isEditable) return;

			activateChoiceGroupEditors(this, html); // edits front.unlock / back.choices / back.consequences

			// Choice-group lifecycle (create / remove a whole group at a given path).
			const setGroup = (path, group) => this.item.update({ [path]: group });
			html.find(".arcanum-group-add").on("click", ev =>
				setGroup(ev.currentTarget.dataset.path, CG.newGroup(ev.currentTarget.dataset.slug || "choices")));
			html.find(".arcanum-group-remove").on("click", ev =>
				setGroup(ev.currentTarget.dataset.path, null));

			// Optional item definition (front.item / back.item) — toggle on/off.
			html.find(".arcanum-item-toggle").on("click", ev => {
				const path = ev.currentTarget.dataset.path;
				const has  = foundry.utils.getProperty(this.item, path) != null;
				this.item.update({ [path]: has ? null : { ...BLANK_ITEM(), name: this.item.name } });
			});

			// Optional resource (a pool / track) at the given base path — toggle on/off + labels list.
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

			// Mystery moves (back.moves) — bespoke list editor (whole-array writes).
			const moves    = () => this.item.system.back?.moves ?? [];
			const setMoves = list => this.item.update({ "system.back.moves": list });
			const idx      = ev => Number(ev.currentTarget.dataset.index);
			html.find(".arcanum-move-add").on("click",            ()  => setMoves(AME.addMove(moves())));
			html.find(".arcanum-move-remove").on("click",         ev  => setMoves(AME.removeMove(moves(), idx(ev))));
			html.find(".arcanum-move-up").on("click",             ev  => setMoves(AME.moveMove(moves(), idx(ev), -1)));
			html.find(".arcanum-move-down").on("click",           ev  => setMoves(AME.moveMove(moves(), idx(ev), 1)));
			html.find(".arcanum-move-toggle-tracker").on("click", ev  => setMoves(AME.toggleTracker(moves(), idx(ev))));
			html.find(".arcanum-move-field").on("change", ev => {
				const el = ev.currentTarget;
				const value = el.type === "number" ? (el.value ? Number(el.value) : null) : (el.value || null);
				setMoves(AME.setMoveField(moves(), { index: Number(el.dataset.index), field: el.dataset.field, value }));
			});
		}
	};
}
