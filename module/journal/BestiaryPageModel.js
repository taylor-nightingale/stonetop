// Data model for the "Bestiary" JournalEntryPage subtype — the codex lives here
// now that the bestiaryEntry actor type is gone. Its field shape matches what the
// shared codex renderer (module/actors/bestiary/codex.js) expects on a page.
const fields = foundry.data.fields;

const qaArray = () => new fields.ArrayField(new fields.SchemaField({
	prompt: new fields.StringField({ required: true, blank: true }),
	answer: new fields.StringField({ required: true, blank: true }),
}));

export class BestiaryPageModel extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		const groupArray = () => new fields.ArrayField(new fields.SchemaField({
			heading: new fields.StringField({ required: true, blank: true }),
			body:    new fields.StringField({ required: true, blank: true }),
			items:   new fields.ArrayField(new fields.StringField()),
		}));
		return {
			// One-phrase tagline shown under the page title.
			concept:      new fields.StringField({ required: true, blank: true }),
			// Genuinely rich text (lists, bold, verse) — keeps a ProseMirror editor.
			description:  new fields.HTMLField({ required: true, blank: true }),
			nests:        new fields.HTMLField({ required: true, blank: true }),
			// Plain-text-with-**bold** codex fields — filled via labeled inputs.
			questions:    qaArray(),
			lore:         qaArray(),
			hooks:        new fields.StringField({ required: true, blank: true }),
			hooksIntro:   new fields.StringField({ required: true, blank: true }),
			origins:      new fields.StringField({ required: true, blank: true }),
			originsIntro: new fields.StringField({ required: true, blank: true }),
			// Grouped sections: a heading + body + bullet items per entry.
			discoveries:  groupArray(),
			dangers:      groupArray(),
			notes:        new fields.HTMLField({ required: true, blank: true }),
			// UUIDs of linked monster stat-block actors.
			statBlocks:   new fields.ArrayField(new fields.StringField()),
		};
	}
}
