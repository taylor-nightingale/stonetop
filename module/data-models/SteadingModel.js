// System data model for the "stonetop" Actor subtype (the steading). Replaces
// the stonetop block of the former template.json.
import { valueField, debility, looseObject } from "./fields.js";

const fields = foundry.data.fields;

// Telltales that a steading's raw source is Taylor-origin (his SteadingData shape) rather than
// fork-native (whose system is just the stat block; everything else lives in flags). His shape has
// top-level fortunes/surplus, an attributes.*.current track, a content/safety block, or the
// places/residents/neighbor arrays — none of which a fork steading's system carries.
function _looksLikeTaylorSteading(s) {
	if (!s || typeof s !== "object") return false;
	const at = s.attributes ?? {};
	return Number.isFinite(s.fortunes) || Number.isFinite(s.surplus) || s.content != null
		|| Array.isArray(s.placesOfInterest) || Array.isArray(s.neighborPlaces)
		|| Array.isArray(s.residents) || Array.isArray(s.neighborPeople)
		|| at.population?.current != null || at.prosperity?.current != null
		|| at.defenses?.current != null || at.size?.current != null;
}

export class SteadingModel extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			stats: new fields.SchemaField({
				fortunes: valueField(1),
				defenses: valueField(0),
			}),
			attributes: new fields.SchemaField({
				population: valueField(0),
				prosperity: valueField(0),
				surplus:    valueField(1),
				debilities: new fields.SchemaField({
					options: new fields.SchemaField({
						diminished: debility("Diminished"),
						lacking:    debility("Lacking"),
						malcontent: debility("Malcontent"),
					}),
				}),
			}),
			// Free-text description. PARITY with his steading (system.description). Same name as his,
			// so a migrated steading's text lands here directly on load.
			description: new fields.HTMLField({ required: true, blank: true }),
			// Migration-support stash (Path B). His SteadingData shares field NAMES with this model
			// but different SHAPES (his attributes.* = {current,items}; flat debilities; top-level
			// fortunes/surplus), so cleanData would coerce his data away on load. migrateData below
			// captures his RAW source here verbatim BEFORE cleaning, for migrate-steading.js to read;
			// the runner clears it after migrating. Inert for fork-native steadings.
			classicTaylor: looseObject(),
		};
	}

	static migrateData(source) {
		if (source && typeof source === "object" && source.classicTaylor == null && _looksLikeTaylorSteading(source)) {
			const { classicTaylor, ...raw } = source;
			source.classicTaylor = foundry.utils.deepClone(raw);
		}
		return super.migrateData(source);
	}
}
