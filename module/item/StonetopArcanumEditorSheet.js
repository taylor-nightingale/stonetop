// Player-facing AUTHORING sheet for a custom arcanum. The fork's other move sheets are the
// read-only arcanum *reader* (StonetopArcanumSheet) and the GM move editor (StonetopMoveSheet);
// this one lets a player build their OWN arcanum, created via the character sheet's
// "Create Custom Arcanum" button.
//
// A custom arcanum is just a world `move` item with `system.moveType:"arcanum"` carrying the SAME
// `flags.stonetop.{slug,front,back}` payload the shipped pack arcana use (see MinorArcanum +
// FoundryArcanaRepository, which resolves world items by slug). So everything the character sheet
// already does for pack arcana — interactive ◇/○/□ tracks, flip, item/resource, the back mystery
// move — works for an authored one with zero changes to the read path.
//
// Scope is the fork's MinorArcanum shape (titles, descriptions, a per-side item, a back resource
// and mystery move). The slug-keyed unlock-requirement and back-option LIST mechanics aren't
// authored here (they're rare for custom content and would need the choice-group editor); a custom
// author expresses those as prose plus ◇/○/□ tracks in the descriptions. We always emit a valid
// payload (`front.unlock = {description, requirements:[]}`, `back.options = []`) so the reader
// never trips on a missing field.

import { ITEM_FLAG_SCOPE } from "../actors/character/StonetopFlags.js";

const COLUMN_OPTIONS = ["arcana", "regular", "small"];
const STAT_OPTIONS   = ["", "str", "dex", "con", "int", "wis", "cha"];

const _num = (v, fallback = 0) => {
	const n = Number(v);
	return Number.isFinite(n) ? n : fallback;
};
const _str = v => (typeof v === "string" ? v.trim() : "");
const _list = v => String(v ?? "").split(",").map(s => s.trim()).filter(Boolean);

// A per-side arcanum item ({name, weight, note, inventoryColumn, resource}) from the form, or null
// when the user left its name blank. Presence is derived from content (like buildMoveUpdate's
// resource/requirement) rather than a separate toggle the author could forget to tick. The item's
// own resource isn't authored here (the back resource covers the common charge-track case).
function _itemFrom(flat, prefix) {
	const name = _str(flat[`${prefix}.name`]);
	if (!name) return null;
	return {
		name,
		weight:          _num(flat[`${prefix}.weight`], 0),
		note:            _str(flat[`${prefix}.note`]) || null,
		inventoryColumn: flat[`${prefix}.inventoryColumn`] || "arcana",
		resource:        null,
	};
}

/**
 * Build the custom-arcanum document update from this editor's flat form data. Pure + exported so it
 * can be unit-tested without Foundry. Writes the complete front/back flag objects every time (the
 * editor manages every key in them) so the document update's deep merge can't leave a stale
 * sub-field behind; the sibling `slug` flag is left untouched and preserved by the merge.
 *
 * @param {Record<string, unknown>} flat  Flattened form data (e.g. "front.title": "…").
 * @returns {object}  A document.update() payload.
 */
export function buildArcanumFlagsUpdate(flat) {
	const front = {
		title:       _str(flat["front.title"]),
		description: flat["front.description"] ?? "",
		item:        _itemFrom(flat, "front.item"),
		unlock:      { description: flat["front.unlock.description"] ?? "", requirements: [] },
	};

	// Back resource — present when given a title, a positive/stat max, or any labels.
	const resTitle   = _str(flat["back.resource.title"]);
	const resMax     = _num(flat["back.resource.max"], 0);
	const resMaxStat = _str(flat["back.resource.maxStat"]) || null;
	const resLabels  = _list(flat["back.resource.labels"]);
	const resource   = (resTitle || resMax > 0 || resMaxStat || resLabels.length)
		? { max: resMax, maxStat: resMaxStat, title: resTitle || null, labels: resLabels }
		: null;

	// Back mystery move — present when given a name.
	const moveName = _str(flat["back.move.name"]);
	const move = moveName
		? { name: moveName, rollType: _str(flat["back.move.rollType"]) || null, description: flat["back.move.description"] ?? "" }
		: null;

	const back = {
		title:       _str(flat["back.title"]),
		description: flat["back.description"] ?? "",
		item:        _itemFrom(flat, "back.item"),
		resource,
		move,
		options:     [],
	};

	return {
		name: _str(flat.name) || front.title || "Custom Arcanum",
		system: { moveType: "arcanum" },
		[`flags.${ITEM_FLAG_SCOPE}.front`]: front,
		[`flags.${ITEM_FLAG_SCOPE}.back`]:  back,
	};
}

export function createStonetopArcanumEditorSheetClass(BaseItemSheet) {
	return class StonetopArcanumEditorSheet extends BaseItemSheet {
		static get defaultOptions() {
			return foundry.utils.mergeObject(super.defaultOptions, {
				classes:   ["stonetop", "sheet", "item", "stonetop-move-editor", "stonetop-arcanum-editor"],
				width:     540,
				height:    760,
				template:  "systems/stonetop/templates/item/arcanum-editor.hbs",
				resizable: true,
			});
		}

		async getData() {
			const data  = await super.getData();
			const flags = this.item.flags?.[ITEM_FLAG_SCOPE] ?? {};
			data.item  = this.item;
			data.slug  = flags.slug ?? "";
			data.front = flags.front ?? { title: "", description: "", item: null, unlock: { description: "", requirements: [] } };
			data.back  = flags.back  ?? { title: "", description: "", item: null, resource: null, move: null, options: [] };
			data.columnOptions = COLUMN_OPTIONS;
			data.statOptions   = STAT_OPTIONS;
			// Pre-join so the template needn't depend on a `join` Handlebars helper.
			data.backResourceLabels = (data.back.resource?.labels ?? []).join(", ");
			return data;
		}

		async _updateObject(_event, formData) {
			return this.item.update(buildArcanumFlagsUpdate(formData));
		}
	};
}
