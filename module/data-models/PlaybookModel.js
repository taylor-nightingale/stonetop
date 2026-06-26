// System data model for the "playbook" Item subtype. template.json declared only
// slug + description; playbooks also store actorType and a rich `attributes`
// block (omen/resolve resource configs). `attributes` is kept as an ObjectField
// so its irregular interior is preserved verbatim.
import { looseObject } from "./fields.js";

const fields = foundry.data.fields;

export class PlaybookModel extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			slug:        new fields.StringField({ required: true, blank: true }),
			description: new fields.HTMLField({ required: true, blank: true }),
			actorType:   new fields.StringField({ required: true, blank: true }),
			attributes:  new fields.ObjectField({ required: false, initial: {} }),

			// ── Classic Taylor-Nightingale playbook def + selections (migration support) ──
			// A Taylor-origin character's CURRENT-form instinct/appearance/choice data lives
			// on the embedded playbook ITEM: the DEFS (instinct/appearance/choices/backgrounds)
			// plus the character's selections (choiceValues / backgroundValues). Declared so
			// they SURVIVE load (validated: a DataModel strips them otherwise) for
			// migrate-character.js's buildInstinct/Appearance + the pending choices fan-out.
			// Inert for fork-native playbooks (the fork drives sheets from item flags, not these).
			instinct:           looseObject(),
			appearance:         looseObject(),
			choices:            looseObject(),
			choiceValues:       looseObject(),
			backgrounds:        looseObject(),
			backgroundValues:   looseObject(),
			origin:             looseObject(),
			specialPossessions: looseObject(),
			instinctValues:     looseObject(),
			appearanceValues:   looseObject(),
		};
	}
}
