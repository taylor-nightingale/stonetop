// System data model for the "move" Item subtype. template.json declared only a
// handful of these fields; the rest were stored loosely (template.json never
// strips unknown keys). A data model DOES strip unknown keys, so every field a
// move actually stores is enumerated here.
//
// The rich, irregularly-shaped sub-objects (asterisk / requirement / resource /
// moveResults) are kept as ObjectFields so their interior is preserved verbatim
// and — crucially — they default to null rather than {}. Code such as
// MoveDefinition treats `system.resource` truthily, so an empty {} default would
// wrongly give every move a resource track.
import { looseObject } from "./fields.js";

const fields = foundry.data.fields;

export class MoveModel extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			description:     new fields.HTMLField({ required: true, blank: true }),
			moveType:        new fields.StringField({ required: true, blank: true }),
			// String or null in real data; normalizeRollType() also tolerates objects.
			rollType:        new fields.StringField({ required: false, blank: true, nullable: true, initial: "" }),
			rollFormula:     new fields.StringField({ required: true, blank: true }),
			moveEffect:      new fields.StringField({ required: true, blank: true }),
			weight:          new fields.NumberField({ required: true, integer: true, initial: 1 }),
			inventoryColumn: new fields.StringField({ required: true, blank: true, initial: "regular" }),
			armorBonus:      new fields.NumberField({ required: true, integer: true, initial: 0 }),
			hpBonus:         new fields.NumberField({ required: true, integer: true, initial: 0 }),
			// Raises every load cap by this many ◇ while owned (the Ranger's Pack Horse → 1).
			loadBonus:       new fields.NumberField({ required: true, integer: true, initial: 0 }),
			// Drops a carried shield's ◇ load by this many while owned (the Heavy/Judge/Marshal's
			// Armored move → 1, so a shield reads ◆ instead of ◆◆). Floored at 1 ◇ in buildSnapshot.
			shieldLoadReduction: new fields.NumberField({ required: true, integer: true, initial: 0 }),
			repeatMax:       new fields.NumberField({ required: true, integer: true, initial: 0 }),
			isStartingMove:  new fields.BooleanField({ required: true, initial: false }),
			// Suppresses the engine's automatic +1 XP on a miss for moves whose text
			// overrides it (e.g. Danger Sense; Death's Door rolls like Hard to Kill).
			noXpOnMiss:      new fields.BooleanField({ required: false, initial: false }),
			slug:            new fields.StringField({ required: true, blank: true }),
			playbook:        new fields.StringField({ required: true, blank: true }),
			replaces:        new fields.StringField({ required: true, blank: true }),
			// Irregular sub-objects — preserved verbatim, default null (falsy).
			asterisk:        looseObject(),
			requirement:     looseObject(),
			resource:        looseObject(),
			moveResults:     looseObject(),
			markOptions:     new fields.ArrayField(new fields.ObjectField(), { required: false, initial: [] }),
		};
	}
}
