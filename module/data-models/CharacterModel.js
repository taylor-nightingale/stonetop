// System data model for the "character" Actor subtype. Replaces the character
// block of the former template.json. The bulk of a character lives in embedded
// Items (moves, playbook) and flags; this schema is just the core sheet data.
import { valueField, valueMaxField, debility, looseObject } from "./fields.js";

const fields = foundry.data.fields;

export class CharacterModel extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			stats: new fields.SchemaField({
				str: valueField(),
				dex: valueField(),
				int: valueField(),
				wis: valueField(),
				con: valueField(),
				cha: valueField(),
			}),
			attributes: new fields.SchemaField({
				hp:      valueMaxField(16, 16),
				xp:      valueMaxField(0, 8),
				level:   valueField(1),
				armor:   valueField(),
				forward: valueField(),
				ongoing: valueField(),
				damage:  new fields.SchemaField({
					value: new fields.StringField({ required: true, blank: true, initial: "d4" }),
				}),
				debilities: new fields.SchemaField({
					options: new fields.SchemaField({
						weakened:  debility("Weakened",  ["str", "dex"]),
						dazed:     debility("Dazed",     ["int", "wis"]),
						miserable: debility("Miserable", ["con", "cha"]),
					}),
				}),
			}),
			playbook: new fields.SchemaField({
				name: new fields.StringField({ required: true, blank: true }),
				slug: new fields.StringField({ required: true, blank: true }),
				uuid: new fields.StringField({ required: true, blank: true }),
			}),

			// Free-text biography + notes. PARITY with Taylor's character (his system.description
			// / system.notes) — the one genuine character feature the fork lacked. Same field NAMES
			// as his, so a migrated Taylor character's text lands here directly on load (declared
			// fields survive cleanData; no migration mapper needed). UI binding is a later pass.
			description: new fields.HTMLField({ required: true, blank: true }),
			notes:       new fields.HTMLField({ required: true, blank: true }),

			// ── Classic Taylor-Nightingale fields (migration support, Path B) ──────────
			// His character data lives in these `system.*` fields; this fork stores the
			// same information in flags. Declared here ONLY so his data SURVIVES load (a
			// DataModel strips undeclared keys — validated in-app), for the pure builders
			// in module/migration/migrate-character.js to read, then cleared post-migration.
			// looseObject = preserved verbatim, default null → inert + falsy for
			// fork-native characters (isTaylorOriginCharacter sees no telltale).
			background:    looseObject(),  // { selected }
			origin:        looseObject(),  // { selected }
			instinct:      looseObject(),  // { custom }
			inventory:     looseObject(),  // { checked, regularPool, smallPool, … }
			lore:          looseObject(),  // { values }
			choices:       looseObject(),  // { values, groupDefs } — pending choices fan-out
			resources:     looseObject(),  // { counts: { inventory, … } }
			moveResources: looseObject(),  // { counts: { moves } } — pending
			playbookSlug:  new fields.StringField({ required: false, blank: true, nullable: true, initial: null }),
		};
	}
}
