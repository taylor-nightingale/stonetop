// System data model for the "monster" Actor subtype — the lean stat block. The
// codex prose (questions/lore/origins/discoveries/…) moved to the bestiary
// JournalEntryPage, so this schema only carries what the stat block stores.
const fields = foundry.data.fields;

export class MonsterModel extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			attributes: new fields.SchemaField({
				hp: new fields.SchemaField({
					value: new fields.NumberField({ required: true, integer: true, initial: 0 }),
					max:   new fields.NumberField({ required: true, integer: true, initial: 0 }),
				}),
				armor: new fields.SchemaField({
					value:  new fields.NumberField({ required: true, integer: true, initial: 0 }),
					source: new fields.StringField({ required: true, blank: true }),
				}),
				damage: new fields.SchemaField({
					value:       new fields.StringField({ required: true, blank: true }),
					rollFormula: new fields.StringField({ required: true, blank: true }),
				}),
				instinct: new fields.SchemaField({
					value: new fields.StringField({ required: true, blank: true }),
				}),
			}),
			concept:      new fields.StringField({ required: true, blank: true }),
			organization: new fields.StringField({ required: true, blank: true }),
			creatureType: new fields.StringField({ required: true, blank: true }),
			size:         new fields.StringField({ required: true, blank: true }),
			tags:         new fields.StringField({ required: true, blank: true }),
			// Rich text edited via ProseMirror on the sheet.
			qualities:    new fields.HTMLField({ required: true, blank: true }),
			notes:        new fields.HTMLField({ required: true, blank: true }),
			count:        new fields.NumberField({ required: true, integer: true, initial: 0 }),
			// UUID of the bestiary codex JournalEntry/page this stat block belongs to.
			entry:        new fields.StringField({ required: true, blank: true }),
		};
	}
}
