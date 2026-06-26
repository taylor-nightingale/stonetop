// Cross-reference index for bestiary prose.
//
// Maps creature names (plus a few natural variants — a stripped leading "The",
// a comma-prefix, an optional trailing plural "s") to the UUID + one-line
// `concept` of the monster that best represents them. A world actor wins over
// the compendium copy, so a click opens the user's own copy when they have one.
//
// Built lazily from the `stonetop-bestiary` compendium index + any world
// monster actors, then cached for the session. Call
// invalidateMonsterRefIndex() when bestiary actors are created/updated/deleted.

const PACK_ID = "stonetop.stonetop-bestiary";
const ENTRY_SUFFIX = /\s*\(Bestiary\)\s*$/i;

let _index = null; // Map<normalizedName, { uuid, name, concept, priority }>
let _regex = null; // compiled matcher, or null when the index is empty

const _norm = s => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** The creature name without the " (Bestiary)" entry suffix. */
export function creatureDisplayName(name) {
	return String(name ?? "").replace(ENTRY_SUFFIX, "").trim();
}

// Register a name and its natural variants at a priority; higher priority wins ties.
function _register(map, rawName, rec) {
	const base = _norm(rawName);
	if (!base) return;
	const variants = new Set([base]);
	const noThe = base.replace(/^the\s+/, "");
	if (noThe) variants.add(noThe);
	const beforeComma = base.split(",")[0].trim();
	if (beforeComma) variants.add(beforeComma);
	for (const v of variants) {
		const existing = map.get(v);
		if (!existing || rec.priority > existing.priority) map.set(v, rec);
	}
}

function _addActorLike({ name, type, uuid, concept }, map, basePriority) {
	if (type !== "monster") return;
	const display = String(name ?? "").trim();
	if (!display || !uuid) return;
	_register(map, display, {
		uuid,
		name: display,
		concept: String(concept ?? "").trim(),
		priority: basePriority,
	});
}

const _escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function _compileRegex(map) {
	const names = [...map.keys()].sort((a, b) => b.length - a.length).map(_escapeRe);
	if (!names.length) return null;
	// Word-ish boundaries that treat apostrophes/hyphens as part of a word (so we
	// don't match a name fragment mid-word), plus an optional trailing plural "s".
	return new RegExp(`(?<![\\w'’-])(${names.join("|")})(s)?(?![\\w'’-])`, "gi");
}

/** Build (or return the cached) name index. */
export async function buildMonsterRefIndex() {
	if (_index) return _index;
	const map = new Map();

	const pack = globalThis.game?.packs?.get?.(PACK_ID);
	if (pack) {
		try {
			const index = await pack.getIndex({ fields: ["type", "system.concept"] });
			for (const e of index) {
				const uuid = e.uuid ?? `Compendium.${pack.collection}.Actor.${e._id}`;
				_addActorLike({ name: e.name, type: e.type, uuid, concept: e.system?.concept }, map, 0);
			}
		} catch (_e) { /* pack unavailable — fall back to world actors only */ }
	}

	for (const a of globalThis.game?.actors ?? []) {
		_addActorLike({ name: a.name, type: a.type, uuid: a.uuid, concept: a.system?.concept }, map, 10);
	}

	_index = map;
	_regex = _compileRegex(map);
	return _index;
}

/** The compiled matcher (capture group 1 = the matched name), or null. */
export function getMonsterRefRegex() {
	return _regex;
}

/** Resolve a matched name back to its index record, or null. */
export function lookupMonsterRef(name) {
	return _index?.get(_norm(name)) ?? null;
}

/** Drop the cache so the next lookup rebuilds it. */
export function invalidateMonsterRefIndex() {
	_index = null;
	_regex = null;
}
