// Data model for the "location" JournalEntryPage subtype — a place from the Book
// II gazetteer rendered as one structured page (Impressions, Hooks, Terrain,
// Dangers, …) instead of a stack of plain-text pages. Mirrors the bestiary codex
// idea (BestiaryPageModel.js) but, because locations are heterogeneous, the page
// holds an ordered array of typed sections rather than a fixed field set.
//
// Section kinds:
//   • "prose" — heading + rich HTML body (ProseMirror); the catch-all that keeps
//               the gazetteer's tables, sub-headed bullet lists, and @UUID
//               cross-links intact.
//   • "qa"    — heading + prompt/answer pairs (Questions); the GM fills answers in.
//   • "groups" — heading + a list of {heading, body} entries (Dangers); each entry
//               is independently addable/removable with its own title + rich body,
//               mirroring the bestiary codex's grouped Dangers & Hazards.
const fields = foundry.data.fields;

export class LocationPageModel extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		const sectionSchema = () => new fields.SchemaField({
			// "prose" | "qa" | "groups" — selects which of the fields below is meaningful.
			kind:    new fields.StringField({ required: true, blank: false, initial: "prose", choices: ["prose", "qa", "groups"] }),
			heading: new fields.StringField({ required: true, blank: true }),
			// The "act" this section belongs to (At a Glance / The Place / In Play).
			// Sections are stored pre-sorted by act; the page sheet renders an act
			// header above the first section of each, so the journal TOC nests the
			// same three anchors for every entry. See gazetteer.mjs `groupFor`.
			group:   new fields.StringField({ required: true, blank: false, initial: "place", choices: ["glance", "place", "details", "inplay"] }),
			// Tags the section for the bestiary's Dangers & Hazards styling.
			danger:  new fields.BooleanField({ required: true, initial: false }),
			// kind === "prose": genuinely rich text (lists, tables, links, bold).
			body:    new fields.HTMLField({ required: true, blank: true }),
			// kind === "qa": prompt/answer pairs filled via labeled inputs.
			pairs:   new fields.ArrayField(new fields.SchemaField({
				prompt: new fields.StringField({ required: true, blank: true }),
				answer: new fields.StringField({ required: true, blank: true }),
			})),
			// kind === "groups": titled entries with a rich body each (Dangers). Each
			// entry adds/removes independently, like a qa row but with a ProseMirror body.
			groups:  new fields.ArrayField(new fields.SchemaField({
				heading: new fields.StringField({ required: true, blank: true }),
				body:    new fields.HTMLField({ required: true, blank: true }),
			})),
		});
		return {
			sections: new fields.ArrayField(sectionSchema()),
		};
	}
}
