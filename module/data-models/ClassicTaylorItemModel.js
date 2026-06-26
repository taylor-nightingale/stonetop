// Migration-support data model for Taylor-Nightingale-origin embedded ITEM types
// (arcanum / possession / insert / outfitItem / npc) that this fork does not natively use.
//
// WHY: validated in-app (verifier-foundry) — Foundry rejects an embedded item whose `type`
// has no registered DataModel, so on load his items would vanish before Path B can read them
// (and a registered model with a narrow schema would strip the fields the mappers need). This
// model is registered for those subtypes ONLY so his items SURVIVE load intact, long enough for
// module/migration/migrate-character.js to convert them at migration time; the classic items are
// then removed. The schema is the UNION of the fields those mappers read; irregular sub-objects
// are looseObject (preserved verbatim, default null). NOT a sheet-backed type — purely transitional.
import { looseObject } from "./fields.js";

const fields = foundry.data.fields;
const classicString = () => new fields.StringField({ required: false, blank: true, nullable: true, initial: null });

export class ClassicTaylorItemModel extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			slug:             classicString(),
			// arcanum (buildArcanaMigration)
			major:            new fields.BooleanField({ required: false, initial: false }),
			flipped:          new fields.BooleanField({ required: false, initial: false }),
			unlockValues:     looseObject(),
			backChoiceValues: looseObject(),
			// possession (buildPossessionsMigration)
			selected:         new fields.BooleanField({ required: false, initial: false }),
			uses:             new fields.NumberField({ required: false, integer: true, nullable: true, initial: null }),
			choiceUses:       looseObject(),
			// insert (buildInsertMigration)
			choiceValues:     looseObject(),
			// npc follower (buildFollowersMigration)
			owned:            new fields.BooleanField({ required: false, initial: false }),
			tagList:          looseObject(),
			hp:               looseObject(),
			armor:            classicString(),
			damage:           classicString(),
			instinct:         looseObject(),
			cost:             looseObject(),
			loyalty:          looseObject(),
			moves:            classicString(),
			notes:            classicString(),
		};
	}
}
