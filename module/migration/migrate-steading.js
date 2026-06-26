// Path B — convert a Taylor-origin STEADING (his `system.*` SteadingData) into this fork's
// representation (the numeric stat block as real system fields + everything else under the single
// `flags.<scope>.steading` object). Inverts his steading data model.
//
// IMPORTANT: his SteadingData shares field NAMES with the fork's SteadingModel but DIFFERENT SHAPES
// (his attributes.* are {current,items}; debilities are flat booleans; fortunes/surplus are
// top-level), so Foundry's cleanData coerces his data away on load. SteadingModel.migrateData
// therefore stashes his RAW source verbatim into `system.classicTaylor` BEFORE cleaning; this builder
// reads that stash. Pure: pass his raw steading source (the stash, or his export `.system`).
//
// NOT wired into MigrationRunner yet (see migrate-character.js — Path B goes live as one gated
// SCHEMA_VERSION once complete). NPC actors need no builder: the fork's NpcModel is a byte-identical
// port of his creature stat block, so his NPC actors load intact (identity) — classic-shape
// self-healing (porting his migrateCreatureData onto NpcModel.migrateData) is an optional follow-up.

const _isNonEmptyObject = v => v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length > 0;
const _has = obj => obj && Object.keys(obj).length > 0;
const _nonEmptyArray = v => Array.isArray(v) && v.length > 0;

/** His raw steading source (from the stash, else `_source.system`). */
export function steadingClassicSource(actor) {
	const sys = actor?._source?.system ?? {};
	return _isNonEmptyObject(sys.classicTaylor) ? sys.classicTaylor : sys;
}

/**
 * Is this actor a Taylor-origin steading (his SteadingData), as opposed to a fork-native one?
 * The fork steading subtype id is "stonetop"; his telltales (stashed by SteadingModel.migrateData,
 * or present on a raw export) are fields the fork steading's system never carries.
 */
export function isTaylorOriginSteading(actor) {
	if (actor?.type !== "stonetop") return false;
	const sys = actor?._source?.system ?? {};
	if (_isNonEmptyObject(sys.classicTaylor)) return true;
	// Telltale list kept in lockstep with SteadingModel._looksLikeTaylorSteading (uses Array.isArray,
	// not non-empty, so a his-steading whose only telltale is an empty array still detects).
	const at = sys.attributes ?? {};
	return Number.isFinite(sys.fortunes) || Number.isFinite(sys.surplus) || sys.content != null
		|| Array.isArray(sys.placesOfInterest) || Array.isArray(sys.neighborPlaces)
		|| Array.isArray(sys.residents) || Array.isArray(sys.neighborPeople)
		|| at.population?.current != null || at.prosperity?.current != null
		|| at.defenses?.current != null || at.size?.current != null;
}

const _person  = p => ({ name: p?.name ?? "", occupation: p?.occupation ?? "", traits: p?.traits ?? "", relations: "", notes: "", checked: false });
const _checked = name => ({ name, checked: true });

/**
 * Convert his raw steading source → a flat `actor.update()` payload. Stat block → real system
 * fields (getSystemValue falls back to actor.system, so the flag mirror isn't needed); all else →
 * the single `flags.<scope>.steading` object (REPLACE semantics: his lists are authoritative, so we
 * don't merge with the fork's seeded defaults). The safety-tools `content` + `neighborPlaces` parity
 * gaps get verbatim flag homes. DEFERRED verbatim-inert under `steading.classic` (no clean fork
 * target without a per-improvement crosswalk): improvements.pickValues + the per-attribute item
 * lists for size/population (the fork has no such lists). description maps to the real system field.
 */
export function buildSteadingMigration(rawSystem, scope) {
	const sys = rawSystem ?? {};
	const at  = sys.attributes ?? {};
	const u = {};

	// ── stat block → real system fields ──
	// His fortunes/population/prosperity/defenses are the selected option INDEX into the bonus track
	// [-1,0,1,2,3]; the fork stores the literal signed bonus. Convert index→bonus (= index-1, clamped
	// to [-1,3]). surplus is a RAW number on his side (a number input, not an index) — copy as-is.
	const _bonus = i => Math.max(-1, Math.min(3, i - 1));
	if (Number.isFinite(sys.fortunes))           u["system.stats.fortunes.value"]         = _bonus(sys.fortunes);
	if (Number.isFinite(sys.surplus))            u["system.attributes.surplus.value"]     = sys.surplus;
	if (Number.isFinite(at.population?.current)) u["system.attributes.population.value"]  = _bonus(at.population.current);
	if (Number.isFinite(at.prosperity?.current)) u["system.attributes.prosperity.value"] = _bonus(at.prosperity.current);
	if (Number.isFinite(at.defenses?.current))   u["system.stats.defenses.value"]         = _bonus(at.defenses.current);
	const deb = sys.debilities ?? {};
	for (const k of ["diminished", "lacking", "malcontent"]) {
		if (deb[k] === true) u[`system.attributes.debilities.options.${k}.value`] = true; // false = fork default, skip
	}
	if (typeof sys.description === "string" && sys.description.trim()) u["system.description"] = sys.description;

	// ── the single steading flag object (non-stat data) ──
	const st = {};
	if (typeof sys.notes === "string" && sys.notes.trim()) st.notes = sys.notes;

	const assets = sys.assets ?? {};
	if (_nonEmptyArray(assets.items)) st.assets = assets.items.map(_checked);
	for (const c of (Array.isArray(assets.coinage) ? assets.coinage : [])) {
		const title = String(c?.title ?? "").toLowerCase();
		if (title === "silver" || title === "gold") {
			st[title] = { purses: c.purses ?? 0, handfuls: c.handfuls ?? 0, coins: c.coins ?? 0 };
		}
	}
	if (_nonEmptyArray(at.prosperity?.items)) st.resources     = at.prosperity.items.map(_checked); // fork Resources list
	if (_nonEmptyArray(at.defenses?.items))   st.fortifications = at.defenses.items.map(_checked);
	if (_nonEmptyArray(sys.placesOfInterest)) st.places = sys.placesOfInterest.map((name, i) => ({ letter: i < 26 ? String.fromCharCode(65 + i) : String(i + 1), name }));
	if (_nonEmptyArray(sys.residents))        st.residents = sys.residents.map(_person);
	if (_nonEmptyArray(sys.neighborPeople))   st.neighbors = sys.neighborPeople.map(p => ({ ..._person(p), home: p?.home ?? "" }));

	// parity gaps — verbatim flag homes (UI deferred)
	if (_isNonEmptyObject(sys.content))       st.content        = sys.content;
	if (_nonEmptyArray(sys.neighborPlaces))   st.neighborPlaces = sys.neighborPlaces;

	// deferred verbatim-inert (need a per-improvement crosswalk / have no fork list)
	const classic = {};
	if (_isNonEmptyObject(sys.improvements?.pickValues)) classic.improvementPickValues = sys.improvements.pickValues;
	// His size is a numeric track; the fork's size is a "village"/"town" label (different concept) —
	// preserve his size.current + items verbatim-inert for a future reconciliation rather than guess.
	if (Number.isFinite(at.size?.current))    classic.sizeCurrent = at.size.current;
	if (_nonEmptyArray(at.size?.items))       classic.sizeItems = at.size.items;
	if (_nonEmptyArray(at.population?.items))  classic.populationItems = at.population.items;
	if (_has(classic)) st.classic = classic;

	if (_has(st)) u[`flags.${scope}.steading`] = st;
	return u;
}
