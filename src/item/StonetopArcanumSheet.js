// Item sheet for authoring custom `arcanum` items — full parity with ArcanumData. Front (title, item,
// rich description, unlock track) + back (title, item / itemSameAsFront, rich description, resource,
// choices; major-only: mystery moves, consequences, unlockAt) + major/weight. The three choice groups
// (front.unlock, back.choices, back.consequences) reuse the shared choiceGroupEdit helpers +
// choiceGroupEditorMixin + choice-group-editor partial; the mystery-moves list uses arcanumMoveEdit.
// The V2 form's submitOnChange auto-saves `name`/`system.*` inputs, including the two named
// <prose-mirror> descriptions.
//
// front/back are opaque ObjectFields: nested writes (name= inputs, prose-mirror, the cg mixin's
// `item.update({"system.front.unlock": group})`) rely on Foundry's recursive merge to preserve
// siblings. _prepareContext initialises front/back to {} so there is always a merge target.

import * as CG from "../utils/choiceGroupEdit.js";
import * as AME from "../utils/arcanumMoveEdit.js";
import { activateChoiceGroupEditors } from "./choiceGroupEditorMixin.js";
import { bindAll } from "../utils/bindAll.js";
import { Arcanum } from "../model/data/character/Arcanum.js";
import { ArcanumSnapshotBuilder, ArcanumRenderContext } from "../model/snapshot/character/CharacterSnapshot.js";
import { MoveSnapshotBuilder } from "../model/snapshot/character/MoveSnapshot.js";
import { FoundryMoveRepository } from "../actors/character/repositories/FoundryMoveRepository.js";
import { enrichRichTextTree } from "../utils/enrichRichText.js";

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
		static DEFAULT_OPTIONS = {
			classes: ["arcanum"],
			position: { width: 980, height: 760 },
			actions: {
				// Both fire on a locked (non-editable) compendium arcanum too: the buttons carry
				// data-view-state, which the base's _toggleDisabled keeps enabled.
				flipPreview:    StonetopArcanumSheet.#onFlipPreview,
				toggleEditMode: StonetopArcanumSheet.#onToggleEditMode,
			},
		};

		static PARTS = {
			form: {
				template: "systems/stonetop/templates/item/arcanum.hbs",
				scrollable: [""],
			},
		};

		static #onFlipPreview() {
			this._previewFlipped = !this._previewFlipped;
			this.render();
		}

		static #onToggleEditMode(_event, target) {
			this._editMode = target.dataset.mode === "edit";
			this.render();
		}

		async _prepareContext(options) {
			const context = await super._prepareContext(options);
			context.item     = this.item;
			context.editable = this.isEditable;
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
			// Major arcana reference mystery moves by slug; resolve them read-only so a locked canonical
			// arcanum still previews its moves (custom arcana author inline back.moves → moveSnapshots null).
			const moveSlugs = back.moveSlugs ?? [];
			const resolved  = moveSlugs.length ? await new FoundryMoveRepository().getMovesBySlugs(moveSlugs) : [];
			const moveSnapshots = resolved.length
				? resolved.map(m => MoveSnapshotBuilder.forArcanumMystery({ id: m.slug, name: m.name, text: m.description }))
				: null;
			context.preview        = [ArcanumSnapshotBuilder.fromArcanum(arcanum, new ArcanumRenderContext({ flipped: this._previewFlipped, moveSnapshots }))];
			// Inline follower rows are slug references resolved against the character's followers.bySlug at
			// render; an item-sheet preview has no such registry, so those rows simply show nothing here.
			await enrichRichTextTree(context.preview, this.item?.getRollData?.() ?? {});
			// The non-editable description view ({{else}} branch) renders the SAME enriched front/back
			// RichText the preview card uses — no separate {{md}} render path.
			context.previewCard    = context.preview[0];
			context.previewFlipped = this._previewFlipped;

			// View-first: an existing arcanum opens as a rendered card with an Edit button; a blank one
			// opens in the editor. A locked (non-editable) item is always view-only.
			if (this._editMode === undefined) this._editMode = isArcanumBlank(front, back);
			if (!this.isEditable) this._editMode = false;
			context.editMode = this._editMode;
			return context;
		}

		// Direct bindings to the current editor controls — re-run per render (part content is replaced).
		// (Flip + edit/view toggle are data-action buttons — see DEFAULT_OPTIONS.actions.)
		_onRender(context, options) {
			super._onRender(context, options);
			if (!this.isEditable) return;
			const root = this.element;

			activateChoiceGroupEditors(this, root); // edits front.unlock / back.choices / back.consequences

			// Choice-group lifecycle (create / remove a whole group at a given path).
			const setGroup = (path, group) => this.item.update({ [path]: group });
			bindAll(root, ".arcanum-group-add", "click", ev =>
				setGroup(ev.currentTarget.dataset.path, CG.newGroup(ev.currentTarget.dataset.slug || this.item.system.slug)));
			bindAll(root, ".arcanum-group-remove", "click", ev =>
				setGroup(ev.currentTarget.dataset.path, null));

			// Optional item definition (front.item / back.item) — toggle on/off.
			bindAll(root, ".arcanum-item-toggle", "click", ev => {
				const path = ev.currentTarget.dataset.path;
				const has  = foundry.utils.getProperty(this.item, path) != null;
				this.item.update({ [path]: has ? null : { ...BLANK_ITEM(), name: this.item.name } });
			});

			// Optional resource (a pool / track) at the given base path — toggle on/off + labels list.
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

			// Mystery moves (back.moves) — bespoke list editor (whole-array writes).
			const moves    = () => this.item.system.back?.moves ?? [];
			const setMoves = list => this.item.update({ "system.back.moves": list });
			const idx      = ev => Number(ev.currentTarget.dataset.index);
			bindAll(root, ".arcanum-move-add", "click",            ()  => setMoves(AME.addMove(moves())));
			bindAll(root, ".arcanum-move-remove", "click",         ev  => setMoves(AME.removeMove(moves(), idx(ev))));
			bindAll(root, ".arcanum-move-up", "click",             ev  => setMoves(AME.moveMove(moves(), idx(ev), -1)));
			bindAll(root, ".arcanum-move-down", "click",           ev  => setMoves(AME.moveMove(moves(), idx(ev), 1)));
			bindAll(root, ".arcanum-move-toggle-tracker", "click", ev  => setMoves(AME.toggleTracker(moves(), idx(ev))));
			bindAll(root, ".arcanum-move-field", "change", ev => {
				const el = ev.currentTarget;
				const value = el.type === "number" ? (el.value ? Number(el.value) : null) : (el.value || null);
				setMoves(AME.setMoveField(moves(), { index: Number(el.dataset.index), field: el.dataset.field, value }));
			});
		}
	};
}
