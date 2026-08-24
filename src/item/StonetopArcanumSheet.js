// Item sheet for authoring custom `arcanum` items. Both sides carry header chrome (item, tags/resource) +
// a `choices` ARRAY of groups; the back adds the two fields that make it an ArcanumBack rather than an
// ArcanumFront — its own title (the mystery's name) and an itemSameAsFront checkbox. The FRONT has no
// title field: the document name in the header IS its heading. The body is entirely choices — a text
// entry is the description, □ tracks / follower & move grants / section headers are all entries. Each
// side's groups reuse the shared choiceGroupEdit helpers + choiceGroupEditorMixin + choice-group-editor
// partial (same array editor the Insert sheet uses).
//
// front/back are opaque ObjectFields: nested writes (name= inputs, the cg mixin's whole-array
// `item.update({"system.front.choices": [...]})`) rely on Foundry's recursive merge to preserve siblings.
// _prepareContext seeds a new arcanum's front/back with default choices so it opens as a usable template.

import * as CG from "../utils/choiceGroupEdit.js";
import { activateChoiceGroupEditors } from "./choiceGroupEditorMixin.js";
import { bindAll } from "../utils/bindAll.js";
import { Arcanum } from "../model/data/character/Arcanum.js";
import { ArcanumSnapshotBuilder, ArcanumRenderContext } from "../model/snapshot/character/CharacterSnapshot.js";
import { enrichRichTextTree } from "../utils/enrichRichText.js";
import { GrantRegistry } from "./GrantRegistry.js";
import { Tags } from "../model/data/Tags.js";
import { TAG_CHIP_ACTIONS, tagChipChangeHandlers } from "../actors/tagChips.js";
import { ChangeActionRouter } from "../utils/ChangeActionRouter.js";

const BLANK_ITEM     = () => ({ name: "", weight: 1, tagList: Tags.gear(null).toRaw(), note: null, inventoryColumn: null, twoCol: false, resource: null });
const BLANK_RESOURCE = () => ({ max: 1, maxStat: null, title: null, labels: [] });

// "Entirely blank" = no authored content on either side (name is ignored — a freshly created item
// always carries a default name, and it is also the front's heading). A blank arcanum opens straight in
// edit mode (nothing to view yet).
function isArcanumBlank(front = {}, back = {}) {
	const has = v => v != null && v !== "" && !(Array.isArray(v) && v.length === 0);
	return !(
		front.item != null || front.resource != null || has(front.choices) ||
		has(back.title)    || back.item      != null || back.resource != null || has(back.choices)
	);
}

// Sensible starting content so a new arcanum opens as an editable template, not an overwhelming blank
// form. Front: a description entry + a 4-mark track. Back: a "Moves" group granting one placeholder move
// and a "Consequences" group with two samples.
const DEFAULT_FRONT_CHOICES = (slug) => [{
	slug, list: [
		{ type: "entry", content: { title: null, text: "Example description that tells you to mark 1:" } },
		{ type: "entry", slug: "marks", content: { title: null, text: null }, track: { max: 4 } },
	],
}];
const DEFAULT_BACK_CHOICES = () => [
	{ slug: "moves", title: "Moves", list: [
		{ type: "entry", slug: "clash", content: { title: null, text: null }, track: { max: 1 }, grants: [{ type: "move", slug: "clash", locations: ["inline"] }] },
	] },
	{ slug: "consequences", title: "Consequences", list: [
		{ type: "entry", slug: "c1", content: { title: null, text: "Sample consequence 1" }, track: { max: 1 } },
		{ type: "entry", slug: "c2", content: { title: null, text: "Sample consequence 2" }, track: { max: 1 } },
	] },
];

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
				...TAG_CHIP_ACTIONS,
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
			// One-time initialisation: a stable slug + both sides seeded with sensible default choices (so a
			// new arcanum is a usable template). `seeded` opens it straight in edit mode.
			const init = {};
			const slug = this.item.system.slug ?? `custom-arcanum-${foundry.utils.randomID(8)}`;
			if (!this.item.system.slug)          init["system.slug"]  = slug;
			if (this.item.system.front == null)  init["system.front"] = { choices: DEFAULT_FRONT_CHOICES(slug) };
			if (this.item.system.back  == null)  init["system.back"]  = { itemSameAsFront: true, choices: DEFAULT_BACK_CHOICES() };
			const seeded = init["system.front"] != null || init["system.back"] != null;
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
			// Chip pickers for the two item tag lists, keyed by the path each writes back to — the
			// same picker the inventory and creature sheets use.
			context.frontItemTags = Tags.gear(front.item?.tagList).picker;
			context.backItemTags  = Tags.gear(back.item?.tagList).picker;
			// Both sides are an ordered ARRAY of choice groups, each edited via the shared choice-group editor
			// (mirrors the Insert sheet). A freshly-added, still-empty group must still render its editor.
			const sideGroups = (sideKey, groups) => (groups ?? []).map((grp, i) => ({
				index: i, slug: grp.slug, title: grp.title ?? null,
				cgPath: `system.${sideKey}.choices.${i}`, rows: CG.buildRows(grp),
			}));
			context.frontChoiceGroups = sideGroups("front", front.choices);
			context.backChoiceGroups  = sideGroups("back",  back.choices);

			// Live preview — the SAME snapshot builder + arcanum-cards.hbs partial the character uses.
			this._previewFlipped ??= false;
			const arcanum = new Arcanum({
				slug: sys.slug, major: sys.major, name: this.item.name, img: this.item.img, front, back,
			});
			context.preview        = [ArcanumSnapshotBuilder.fromArcanum(arcanum, new ArcanumRenderContext({ flipped: this._previewFlipped }))];
			// Inline follower/move grants are slug references choice-row resolves against
			// stonetop.followers.bySlug / stonetop.moves.bySlug at render. The character supplies those from
			// its owned items; here we resolve the arcanum's own grants from the compendium + world so the
			// preview renders them too (both sides, so a flip shows either).
			const card = context.preview[0];
			context.stonetop = await GrantRegistry.fromChoiceGroups([...(card.front?.choices ?? []), ...(card.back?.choices ?? [])]);
			await enrichRichTextTree(context.preview, this.item?.getRollData?.() ?? {});
			await enrichRichTextTree(context.stonetop, this.item?.getRollData?.() ?? {});
			// The non-editable description view ({{else}} branch) renders the SAME enriched front/back
			// RichText the preview card uses — no separate {{md}} render path.
			context.previewCard    = context.preview[0];
			context.previewFlipped = this._previewFlipped;

			// View-first: an existing arcanum opens as a rendered card with an Edit button; a brand-new one
			// (just seeded with defaults) or an otherwise-blank one opens in the editor. Locked = view-only.
			if (this._editMode === undefined) this._editMode = seeded || isArcanumBlank(front, back);
			if (!this.isEditable) this._editMode = false;
			context.editMode = this._editMode;
			return context;
		}

		// Direct bindings to the current editor controls — re-run per render (part content is replaced).
		// (Flip + edit/view toggle are data-action buttons — see DEFAULT_OPTIONS.actions.)
		// A card has two tag lists (front item, back item), so the chip wrap carries the document path
		// it writes back to rather than a bare field name.
		toggleTag(wrap, value) {
			const path = wrap?.field;
			if (!value || !path) return;
			const tags = Tags.gear(foundry.utils.getProperty(this.item, path)).toggle(value);
			return this.item.update({ [path]: tags.toRaw() });
		}

		async _onFirstRender(context, options) {
			await super._onFirstRender(context, options);
			new ChangeActionRouter(tagChipChangeHandlers(this), { when: () => this.isEditable })
				.attach(this.element);
		}

		_onRender(context, options) {
			super._onRender(context, options);
			if (!this.isEditable) return;
			const root = this.element;

			activateChoiceGroupEditors(this, root); // edits each front.choices[i] / back.choices[i] group

			// Both sides' `choices` are ARRAYS of groups — add appends a new group, remove splices by index
			// (whole-array atomic writes, mirroring the Insert sheet). `data-side` picks front/back.
			const sideChoices = side => this.item.system[side]?.choices ?? [];
			bindAll(root, ".arcanum-group-add", "click", ev => {
				const side = ev.currentTarget.dataset.side;
				this.item.update({ [`system.${side}.choices`]: [...sideChoices(side), CG.newGroup(`choices-${sideChoices(side).length}`)] });
			});
			bindAll(root, ".arcanum-group-remove", "click", ev => {
				const side = ev.currentTarget.dataset.side;
				const arr = [...sideChoices(side)]; arr.splice(Number(ev.currentTarget.dataset.index), 1);
				this.item.update({ [`system.${side}.choices`]: arr });
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
