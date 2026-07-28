// Item sheet for authoring custom `arcanum` items — full parity with ArcanumData. Front (title, item,
// rich description, unlock track) + back (title, item / itemSameAsFront, rich description, resource,
// choices; major-only: mystery moves, consequences, unlockAt) + major/weight. The three choice groups
// (front.unlock, back.choices, back.consequences) reuse the shared choiceGroupEdit helpers +
// choiceGroupEditorMixin + choice-group-editor partial. Moves are choice-group entries that grant a move.
// The V2 form's submitOnChange auto-saves `name`/`system.*` inputs, including the two named
// <prose-mirror> descriptions.
//
// front/back are opaque ObjectFields: nested writes (name= inputs, prose-mirror, the cg mixin's
// `item.update({"system.front.unlock": group})`) rely on Foundry's recursive merge to preserve
// siblings. _prepareContext initialises front/back to {} so there is always a merge target.

import * as CG from "../utils/choiceGroupEdit.js";
import { activateChoiceGroupEditors } from "./choiceGroupEditorMixin.js";
import { bindAll } from "../utils/bindAll.js";
import { Arcanum } from "../model/data/character/Arcanum.js";
import { ArcanumSnapshotBuilder, ArcanumRenderContext } from "../model/snapshot/character/CharacterSnapshot.js";
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
		has(back.choices)
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
			// The front unlock is a single group; the back is an ordered ARRAY of groups (spells / moves /
			// followers / consequences), each edited via the shared choice-group editor (mirrors the Insert
			// sheet). A freshly-added, still-empty group must still render its editor, so pass the groups.
			context.hasUnlock        = front.unlock != null;
			context.unlockRows       = front.unlock ? CG.buildRows(front.unlock) : [];
			context.backChoiceGroups = (back.choices ?? []).map((grp, i) => ({
				index: i, slug: grp.slug, title: grp.title ?? null,
				cgPath: `system.back.choices.${i}`, rows: CG.buildRows(grp),
			}));

			// Live preview — the SAME snapshot builder + arcanum-cards.hbs partial the character uses.
			this._previewFlipped ??= false;
			const arcanum = new Arcanum({
				slug: sys.slug, major: sys.major, name: this.item.name, img: this.item.img, front, back,
			});
			context.preview        = [ArcanumSnapshotBuilder.fromArcanum(arcanum, new ArcanumRenderContext({ flipped: this._previewFlipped }))];
			// Inline follower/move grants are slug references resolved against the character's
			// followers.bySlug / moves.bySlug at render; an item-sheet preview has no such registry, so those
			// grants simply show nothing here.
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

			activateChoiceGroupEditors(this, root); // edits front.unlock + each back.choices[i] group

			// front.unlock is a single group (create / remove at a fixed path).
			const setGroup = (path, group) => this.item.update({ [path]: group });
			bindAll(root, ".arcanum-group-add", "click", ev =>
				setGroup(ev.currentTarget.dataset.path, CG.newGroup(ev.currentTarget.dataset.slug || this.item.system.slug)));
			bindAll(root, ".arcanum-group-remove", "click", ev =>
				setGroup(ev.currentTarget.dataset.path, null));

			// back.choices is an ARRAY of groups — add appends a new group, remove splices by index
			// (whole-array atomic writes, mirroring the Insert sheet).
			const backChoices = () => this.item.system.back?.choices ?? [];
			bindAll(root, ".arcanum-back-group-add", "click", () =>
				this.item.update({ "system.back.choices": [...backChoices(), CG.newGroup(`choices-${backChoices().length}`)] }));
			bindAll(root, ".arcanum-back-group-remove", "click", ev => {
				const arr = [...backChoices()]; arr.splice(Number(ev.currentTarget.dataset.index), 1);
				this.item.update({ "system.back.choices": arr });
			});

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
		}
	};
}
