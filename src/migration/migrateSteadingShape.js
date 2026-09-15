import { SteadingDefaults } from "../model/data/steading/SteadingDefaults.js";
import { newPersonId } from "../actors/steading/Person.js";

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
	_healFolk(source);
	_healContent(source);
	// GUARDED, like every heal above it. Assigning unconditionally wrote `assets: undefined` into
	// every partial update diff this model ever migrated — and a diff carrying an explicit undefined
	// for a SchemaField is a diff that resets it, so a steading's resources and fortifications were
	// cleared by any edit that did not happen to mention them. In memory the sheet went on showing
	// them; the database no longer had them, which is why they only vanished on a reload.
	if (source.assets) source.assets = healAssets(source.assets);
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
		typeof p === "string" ? { name: p, linkUuid: "" } : p);
}

// Old `improvements` held pick STATE ({pickValues}); the owned slug list didn't exist (the old
// repository granted every steading the same set — the runner re-grants it from the steadfast).
function _healImprovements(source) {
	const imp = source.improvements;
	if (imp == null || Array.isArray(imp) || typeof imp !== "object") return;
	source.improvementValues ??= imp.pickValues ?? {};
	source.improvements = [];
}

// Residents and neighbours were two arrays rendering the same table; 1.6.0 merged them into one
// roster where the Home column carries the difference and blank means this steading.
//
// Deduped by id, because the two keys can outlive the fold for a moment: a client that loads a
// legacy steading and saves anything writes the MERGED `folk` while the old keys are still in the
// database, and a straight concat on the next load would double every neighbour. Legacy rows
// occasionally carry no id at all (the very old flag-based people) — those get one here, once.
function _healFolk(source) {
	const legacy = [source.residentPeople, source.neighborPeople].filter(Array.isArray);
	if (!legacy.length) return;
	const merged = Array.isArray(source.folk) ? [...source.folk] : [];
	const seen = new Set(merged.map(p => p?.id).filter(Boolean));
	for (const person of legacy.flat()) {
		if (person?.id && seen.has(person.id)) continue;
		const id = person?.id || newPersonId();
		seen.add(id);
		merged.push({ home: "", ...person, id });
	}
	source.folk = merged;
	delete source.residentPeople;
	delete source.neighborPeople;
}

// A general asset was a bare sentence; 1.6.0 gave it a requisitioned state. Shared with SteadfastData,
// which composes the same profile schema and so holds the same legacy strings.
export function healAssets(assets) {
	if (!assets?.items?.some(item => typeof item === "string")) return assets;
	return {
		...assets,
		items: assets.items.map(item => typeof item === "string" ? { text: item, requisitioned: false } : item),
	};
}

// Each content section used to carry a free textarea beside its (never rendered) list. 1.7.0 makes
// the list the only thing there, so what was typed into the box becomes entries — one per line, since
// that is how a box of agreements gets written. Blank lines are not entries.
//
// Guarded on the key being present, like every heal above it: the three text fields are gone from
// the schema, so Foundry's cleaning strips them from the in-memory source and this is the only place
// that still sees them. migrateSteadingContent then writes the merged lists back to the database.
export const CONTENT_TEXT_KEYS = {
	excluded:        "excludedText",
	veiled:          "veiledText",
	specialHandling: "specialHandlingText",
};

function _healContent(source) {
	const content = source.content;
	if (!content) return;
	for (const [section, textKey] of Object.entries(CONTENT_TEXT_KEYS)) {
		const text = content[textKey];
		if (typeof text !== "string") continue;
		const entries = text.split("\n").map(line => line.trim()).filter(Boolean);
		if (entries.length) content[section] = [...(content[section] ?? []), ...entries];
		delete content[textKey];
	}
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
