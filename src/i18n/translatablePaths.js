import { toSlug } from "../utils/slug.js";

// The prose a translator may rewrite, declared per document type as paths into the document source.
//
// This is an allowlist, never a denylist: slugs, cross-pack references (`moves[]`, `grants[].slug`)
// and ids sit alongside the prose in the same objects, and translating one silently breaks the
// grant it points at. Anything not named here is structure and never reaches a translation file.
//
// `[]` marks an array to walk. Every entry produced carries two addresses:
//   path — concrete, indexed (`system.backgrounds.0.description`), for reading and writing a document
//   key  — slug-bearing (`backgrounds/patriot/description`), for the translation file
// Key segments join with "/" rather than ".": Foundry merges every loaded language file with
// mergeObject, and a dotted key risks being expanded into nested objects on the way in.
// The key is what a translator's work is filed under, so it must survive a pack rebuild: it uses the
// slugs the data already carries rather than array positions, which the PDF builders may reshuffle.

// ── What is NOT here, and why ────────────────────────────────────────────────────────────────────
//
// Several fields read like prose and are load-bearing anyway. Each is a silent breakage if
// translated — the text still looks right in the file, and the game quietly stops working:
//
//   tags — tagList[], tagOptions[], companion catalog options[] and defaults[]
//        A tag token is at once its own identity and its own label: `hasGroupTag` matches
//        /^(group|horde)(\s*\(N\))?$/i on it, and the glossary is keyed by toSlug of it. Rewriting
//        one breaks the behaviour it drives. Tags are translated at DISPLAY time instead, through
//        `stonetop.tagLabels` — once each, not once per document that carries them.
//   requirement.moves[]   Move slugs. The "Requires: …" label resolves them to the referenced
//        moves' own names, so it reads translated without the reference itself ever moving.
//   moveResults.*.label   Dice notation ("10+", "7-9", "6-"), the same in every language.
//   personal names   origin[].names[], memberSuggestions.names[], residents.names,
//        neighborPlaces[].names — people, not prose.
//   slugs, grants, reference, inventoryColumn, moveType, rollStat, attributes.*   Structure.

/** Every content field a choice-group row can carry, for the group of rows at `rows`. */
const rowPaths = (rows) => [
	`${rows}.content.title`,
	`${rows}.content.titleNote`,
	`${rows}.content.subtitle`,
	`${rows}.content.subtitleNote`,
	`${rows}.content.text`,
	`${rows}.options[].text`,
	`${rows}.options[].description`,
];

/** The gear a container hands out, wherever it hangs. */
const outfitItemPaths = (items) => [
	`${items}.name`,
	`${items}.qualifier`,
	`${items}.note`,
	`${items}.resource.labels[]`,
];

const PLAYBOOK = [
	"name",
	"system.description",
	"system.statsNote",
	"system.startingMovesNote",
	"system.specialPossessions.pickNote",
	// Regions are place names; a translator may well leave them as-is, but that is their call.
	"system.origin[].region",
	"system.backgrounds[].label",
	"system.backgrounds[].description",
	"system.backgrounds[].resource.title",
	...rowPaths("system.backgrounds[].choices.list[]"),
	...rowPaths("system.choices[].list[]"),
	...rowPaths("system.instinct.list[]"),
	...rowPaths("system.appearance.list[]"),
	"system.introductions.step3",
	...rowPaths("system.introductions.step4.list[]"),
	...rowPaths("system.introductions.step6.list[]"),
];

// `system.choices` is a single group object on move / possession / improvement, and an array of
// groups on playbook / follower / insert / arcanum — hence the two path shapes.
const MOVE = [
	"name",
	"system.description",
	"system.moveResults.success.value",
	"system.moveResults.partial.value",
	"system.moveResults.failure.value",
	"system.resource.title",
	"system.resource.labels[]",
	// A requirement that is not a move reference — prose, and the only part of a requirement a
	// translator sees. The move references resolve to their own translated names.
	"system.requirement.note",
	"system.choices.list[].input.placeholder",
	...rowPaths("system.choices.list[]"),
];

/** An arcanum is two sided, and both sides carry the same shape. */
const arcanumSide = (side) => [
	`system.${side}.title`,
	`system.${side}.item.name`,
	`system.${side}.item.note`,
	`system.${side}.item.resource.labels[]`,
	`system.${side}.resource.title`,
	`system.${side}.resource.labels[]`,
	`system.${side}.choices[].title`,
	...rowPaths(`system.${side}.choices[].list[]`),
];

const ARCANUM = ["name", ...arcanumSide("front"), ...arcanumSide("back")];

const POSSESSION = [
	"name",
	"system.label",
	"system.description",
	"system.note",
	"system.resource.title",
	"system.resource.labels[]",
	...outfitItemPaths("system.outfitItems[]"),
	...rowPaths("system.choices.list[]"),
	...outfitItemPaths("system.choices.list[].outfitItems[]"),
	...outfitItemPaths("system.choices.list[].options[].outfitItems[]"),
];

const FOLLOWER = [
	"name",
	"system.description",
	"system.specialQuality",
	// Often prose ("ghostly spear d8 (reach, ignores armor)"), sometimes a bare `[[/r 1d6]]`. The
	// markup guard in the reconciliation is what keeps the roll intact through translation.
	"system.damage",
	"system.armor",
	// A markdown bullet list of the follower's moves — prose, unlike the playbook's `moves[]`, which
	// is an array of slugs.
	"system.moves",
	"system.membersNote",
	"system.memberSuggestions.traits[]",
	// Display-only prose. Babele translates a compendium document as a unit, so `selected` and
	// `options` stay mutually consistent.
	"system.instinct.options[]",
	"system.instinct.selected[]",
	"system.cost.options[]",
	"system.cost.selected[]",
	"system.companion.catalog[].damage",
	"system.companion.catalog[].armor",
	"system.companion.catalog[].variants[]",
	...rowPaths("system.choices[].list[]"),
];

const OUTFIT_ITEM = [
	"name",
	"system.qualifier",
	"system.note",
	"system.resource.labels[]",
];

const INSERT = [
	"name",
	"system.description",
	...rowPaths("system.choices[].list[]"),
	...rowPaths("system.instinct.list[]"),
];

const IMPROVEMENT = [
	"name",
	"system.description",
	...rowPaths("system.choices.list[]"),
];

const STEADFAST = [
	"name",
	"system.description",
	"system.assets.resources[]",
	"system.assets.fortifications[]",
	"system.assets.items[]",
	"system.residents.traits[]",
	"system.placesOfInterest[].name",
	"system.placesOfInterest[].description",
	"system.neighborPlaces[].name",
	"system.neighborPlaces[].subtitle",
];

export const TEXT_PATHS = {
	playbook:    PLAYBOOK,
	move:        MOVE,
	arcanum:     ARCANUM,
	possession:  POSSESSION,
	follower:    FOLLOWER,
	outfitItem:  OUTFIT_ITEM,
	insert:      INSERT,
	improvement: IMPROVEMENT,
	steadfast:   STEADFAST,
};

// Fields that read as prose but are deliberately left in English, with the reason. Together with
// TEXT_PATHS these must account for every prose-looking string in every translated pack — the
// coverage test enforces that, so a builder that starts emitting a new field cannot leave it
// untranslatable in silence.
export const UNTRANSLATED_PATHS = {
	move: {
		"system.requirement.moves[]": "Move slugs; the label resolves them to the moves' own names.",
	},
	follower: {
		"system.tagOptions[]": "A tag — translated once through stonetop.tagLabels, not per follower.",
		"system.companion.catalog[].options[]": "Tags, and they render as tag chips; see tagLabels.",
		// CharacterFollowers resolves the chosen companion with `x.slug === wanted || x.name === wanted`
		// and stores `t.name`, so a translated name stops resolving and silently loses the type's
		// pickCount and pre-checked defaults.
		"system.companion.catalog[].name": "Matched by name when resolving the chosen companion type.",
	},
	steadfast: {
		"system.residents.names":         "Personal names.",
		"system.neighborPlaces[].names":  "Personal names.",
	},
	playbook: {
		"system.origin[].names[]": "Personal names.",
	},
};

// Structural segments that address the data but say nothing to a translator. Dropping them keeps a
// key close to what the sheet shows ("choices/arcana-major/where-acquired/text") without losing
// uniqueness — no two allowlisted paths collide once they are removed.
export const KEY_SEPARATOR = "/";

const UNKEYED_SEGMENTS = new Set(["system", "list", "content"]);

// How one array element earns its place in a key, best first:
//   its slug         — what the data already uses to identify the row
//   its own content  — for arrays of bare strings (a steadfast's assets, a companion's options),
//                      which carry no slug but ARE their own identity
//   its index        — last resort, for slugless objects
//
// Content beats index because an index moves: insert one asset near the top of a list and every
// translation below it silently slides onto the wrong string. A content key survives reordering and
// insertion, and a reworded string orphans its own translation — which is the correct signal.
function keySegmentFor(element, index) {
	const slug = element?.slug;
	if (typeof slug === "string" && slug.trim()) return { segment: slug, fromContent: false };
	if (typeof element === "string" && element.trim()) return { segment: toSlug(element), fromContent: true };
	return { segment: String(index), fromContent: false };
}

// Two identical strings in one list are legitimate data, so their content keys are disambiguated by
// position. Slugs are NOT disambiguated: two rows sharing one is a data bug, and letting the
// duplicate key collide is how the extractor reports it.
function keySegmentsFor(elements) {
	const segments = elements.map(keySegmentFor);
	const repeated = new Set();
	const seen     = new Set();
	for (const { segment, fromContent } of segments) {
		if (fromContent && seen.has(segment)) repeated.add(segment);
		seen.add(segment);
	}

	const used = new Map();
	return segments.map(({ segment, fromContent }) => {
		if (!fromContent || !repeated.has(segment)) return segment;
		const n = used.get(segment) ?? 0;
		used.set(segment, n + 1);
		return `${segment}${KEY_SEPARATOR}${n}`;
	});
}

function walk(node, segments, pathParts, keyParts, out) {
	if (node == null) return;

	if (!segments.length) {
		if (typeof node === "string" && node.trim()) {
			out.push({ key: keyParts.join(KEY_SEPARATOR), path: pathParts.join("."), text: node });
		}
		return;
	}

	const [segment, ...rest] = segments;
	const isArray = segment.endsWith("[]");
	const field   = isArray ? segment.slice(0, -2) : segment;
	const value   = node[field];
	if (value == null) return;

	const nextPath = [...pathParts, field];
	const nextKey  = UNKEYED_SEGMENTS.has(field) ? keyParts : [...keyParts, field];

	if (!isArray) {
		walk(value, rest, nextPath, nextKey, out);
		return;
	}
	if (!Array.isArray(value)) return;
	const keySegments = keySegmentsFor(value);
	value.forEach((element, i) => {
		walk(element, rest, [...nextPath, String(i)], [...nextKey, keySegments[i]], out);
	});
}

/**
 * Every translatable string in one document, in allowlist order.
 * @returns {{key: string, path: string, text: string}[]}
 */
export function translatableEntries(source, paths) {
	const out = [];
	for (const pattern of paths ?? []) walk(source, pattern.split("."), [], [], out);
	return out;
}

/** As {@link translatableEntries}, for whichever allowlist the document's type declares. */
export function translatableEntriesForType(type, source) {
	return translatableEntries(source, TEXT_PATHS[type]);
}

export function isTranslatableType(type) {
	return Object.hasOwn(TEXT_PATHS, type);
}
