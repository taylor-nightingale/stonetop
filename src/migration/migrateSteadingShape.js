import { SteadingDefaults } from "../model/data/steading/SteadingDefaults.js";

// Heals the pre-0.13.0 steading SOURCE shape: ratings were stored as { current: <option index>,
// items: [...] } (with the resource/fortification lists inside), size as an index, fortunes/surplus
// at the system root, places as bare strings, the resident POOL in residentNames/residentTraits
// with the people array in `residents`, and improvement pick state in improvements.pickValues.
//
// This must run from SteadingData.migrateData — BEFORE schema validation — because an unhealed
// actor fails NumberField validation during world initialization ("population: must be a number"),
// gets quarantined out of game.actors, and the MigrationRunner (which only sees valid actors) can
// never reach it. Shape lives here; the runner's migrateSteading does the one-time SEMANTIC pass
// (steadfast stamp, improvement grant, flag folding) on the healed model.
//
// Foundry re-runs migrateData on partial update DIFFS, so every heal only TRANSFORMS a present
// old-shape key — nothing is defaulted in for an absent field (see migrate-data notes in the doc).
export function migrateSteadingShape(source) {
	_healRatings(source);
	_healRootFortunesSurplus(source);
	_healPlaces(source);
	_healImprovements(source);
	_healResidents(source);
	return source;
}

// Old attribute values are plain objects ({current, items}); healed ones are numbers / the size
// tier string, so an object here is unambiguously the legacy shape.
const isLegacyAttr = v => typeof v === "object" && v !== null && !Array.isArray(v);

function _healRatings(source) {
	const attrs = source.attributes;
	if (!attrs) return;
	for (const key of ["population", "prosperity", "defenses"]) {
		const old = attrs[key];
		if (!isLegacyAttr(old)) continue;
		const bonuses = SteadingDefaults.attributes[key].bonuses;
		attrs[key] = bonuses[old.current ?? 1] ?? 0;
		// The prosperity/defenses item lists became asset lists in 0.13.0.
		const assetKey = { prosperity: "resources", defenses: "fortifications" }[key];
		if (assetKey && Array.isArray(old.items) && old.items.length) {
			source.assets ??= {};
			source.assets[assetKey] ??= [...old.items];
		}
	}
	if (isLegacyAttr(attrs.size)) {
		attrs.size = SteadingDefaults.attributes.size.values[attrs.size.current ?? 1] ?? "village";
	}
}

// Root fortunes stored the OPTION INDEX (old initial 2 → "+1"); surplus was already a raw count.
// Both moved under attributes in 0.13.0. Only fires when the destination is absent — i.e. on a
// legacy full source, never on a modern diff.
function _healRootFortunesSurplus(source) {
	const attrs = source.attributes;
	if (!attrs) return;
	if (typeof source.fortunes === "number" && attrs.fortunes === undefined) {
		attrs.fortunes = SteadingDefaults.fortunes.bonuses[source.fortunes] ?? 0;
		delete source.fortunes;
	}
	if (typeof source.surplus === "number" && attrs.surplus === undefined) {
		attrs.surplus = source.surplus;
		delete source.surplus;
	}
}

function _healPlaces(source) {
	if (!Array.isArray(source.placesOfInterest)) return;
	source.placesOfInterest = source.placesOfInterest.map(p =>
		typeof p === "string" ? { name: p, journalReference: "" } : p);
}

// Old `improvements` held pick STATE ({pickValues}); the owned slug list didn't exist (the old
// repository granted every steading the same set — the runner re-grants it from the steadfast).
function _healImprovements(source) {
	const imp = source.improvements;
	if (imp == null || Array.isArray(imp) || typeof imp !== "object") return;
	source.improvementValues ??= imp.pickValues ?? {};
	source.improvements = [];
}

// `residents` used to be the PEOPLE array; the name/trait pool lived at the root.
function _healResidents(source) {
	if (!Array.isArray(source.residents)) return;
	source.residentPeople ??= source.residents;
	source.residents = {
		names:  typeof source.residentNames === "string" ? source.residentNames : "",
		traits: Array.isArray(source.residentTraits) ? source.residentTraits : [],
	};
	delete source.residentNames;
	delete source.residentTraits;
}
