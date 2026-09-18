import { toSlug } from "../utils/slug.js";

// The prose a translator may rewrite, declared per document type as paths into the document source.
//
// This is an allowlist, never a denylist: slugs, cross-pack references (`moves[]`, `grants[].slug`)
// and ids sit alongside the prose in the same objects, and translating one silently breaks the
// grant it points at. Anything not named here is structure and never reaches a translation file.
//
// `[]` marks an array to walk. Every entry produced carries three addresses:
//   path      — concrete, indexed (`system.backgrounds.0.description`), for reading and writing a document
//   key       — slug-bearing (`backgrounds/patriot/description`), for the translation file
//   mergePath — the smallest subtree that can carry the string through a MERGE, which is `path`
//               itself unless an array stands above it (`system.backgrounds`). Babele merges a
//               converter's payload onto the document rather than replacing it, and a merge swaps an
//               array wholesale instead of element by element — so an array is the finest grain a
//               payload can name. See babeleConverter, which returns only these subtrees so that the
//               per-actor state living beside the prose on an embedded item is never overwritten.
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
	// A Seasons Change step's own line — the move's words for that step, quoted from its description.
	// Prose on the same footing as the description it is quoted from, so it translates the same way.
	"system.steps[].text",
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
	// The type's display label. A companion's chosen type is stored by SLUG, so translating the name
	// moves nothing — see CompanionCatalog.
	"system.companion.catalog[].name",
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
	// A result's own sentence — the book's words lifted out of the prose beside them, so it
	// translates with that prose or the turnover is the one English thing left on a translated
	// sheet. `requires` is slugs and `condition` is a flag — nothing to translate in either.
	"system.effects[].text",
	// The book's trigger clause, in markdown — "when **_summer comes and you roll a 7+ with
	// Fortunes_**". Prose like the sentence it opens, and the improvement's card reads the two as one.
	"system.effects[].when.phrase",
	"system.effects[].listEntry.text",
	// The tier a result SETS is a stored value, not prose — Size's word is translated once through
	// stonetop.steading.tier.size.*, which is where the chip and the ledger both read it from.
	...rowPaths("system.choices.list[]"),
];

const STEADFAST = [
	"name",
	"system.description",
	// The book's own sensory line for a season, quoted on the Season tab when the wheel turns. Prose,
	// and it translates with the article it was lifted from.
	"system.impressions[].text",
	"system.assets.resources[]",
	"system.assets.fortifications[]",
	"system.assets.items[].text",
	"system.residents.traits[]",
	"system.placesOfInterest[].name",
	"system.placesOfInterest[].description",
	"system.neighborPlaces[].name",
	"system.neighborPlaces[].subtitle",
	// "10 days" — the GM playbook's Travel Times table, in its own words. Prose, and a duration is
	// one of the things every language writes differently. Size beside it is NOT here: it stores a
	// tier key, translated once through stonetop.steading.tier.size.*.
	"system.neighborPlaces[].travel",
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
	improvement: {
		// Not a field Foundry ever sees: an authoring-only key, stripped from the document on its way
		// into the compiled pack (dropAuthoringKeys). It is the book's own payoff sentence, kept beside
		// the effects modelled from it so the review can check one against the other — quoted English,
		// checked against Book I/II, and never rendered.
		"_prose[]":                                "The book's own sentence, kept for review. Authoring-only — stripped at compile, never rendered.",
		"_review":                                 "A note to whoever reviews the model. Authoring-only — stripped at compile, never rendered.",
		"system.effects[].change.formula":         "A dice expression (\"2d6 + @population\"), not prose. Translating it would break the roll.",
		"system.effects[].advantage.moves[]":      "Move slugs; the reminder resolves them to the moves' own rows.",
		"system.effects[].set.value":              "A stored value — a number, or one of Size's tier keys, translated through stonetop.steading.tier.size.*",
	},
	move: {
		"system.requirement.moves[]": "Move slugs; the label resolves them to the moves' own names.",
	},
	follower: {
		"system.tagOptions[]": "A tag — translated once through stonetop.tagLabels, not per follower.",
		"system.companion.catalog[].options[]": "Tags, and they render as tag chips; see tagLabels.",
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
// How a slugless object names itself, best first: a title is what a reader calls the row, its text
// is the row, and the bare fields cover the shapes that carry no `content` block at all — effects,
// steps, origins, members.
const NAME_SOURCES = [
	element => element?.content?.title,
	element => element?.content?.subtitle,
	element => element?.content?.text,
	element => element?.text,
	element => element?.name,
	element => element?.region,
	element => element?.label,
];

// Long enough to stay unique in practice, short enough that a key is still readable in a diff.
const KEY_WORDS = 6;

function contentSegment(element) {
	for (const read of NAME_SOURCES) {
		const value = read(element);
		if (typeof value !== "string" || !value.trim()) continue;
		const segment = toSlug(value).split("-").slice(0, KEY_WORDS).join("-");
		if (segment) return segment;
	}
	return null;
}

// A slugless object has to be addressable by something other than its position: insert one row near
// the top of a list and every index below it shifts, silently re-pointing each translation onto its
// neighbour's sentence. The row's own content is the only stable identity available — the row IS its
// words. That does make the key change when the English changes, which is the right trade: the entry
// then comes back flagged for a human instead of staying quietly attached to a different string.
//
// Position remains the last resort, for rows that carry no words of their own (a picker that holds
// nothing but its options).
function keySegmentFor(element, index) {
	const slug = element?.slug;
	if (typeof slug === "string" && slug.trim()) return { segment: slug, fromContent: false };
	if (typeof element === "string" && element.trim()) return { segment: toSlug(element), fromContent: true };
	const named = contentSegment(element);
	if (named) return { segment: named, fromContent: true };
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

function walk(node, segments, pathParts, keyParts, out, mergePath = null) {
	if (node == null) return;

	if (!segments.length) {
		if (typeof node === "string" && node.trim()) {
			out.push({
				key:       keyParts.join(KEY_SEPARATOR),
				path:      pathParts.join("."),
				mergePath: mergePath ?? pathParts.join("."),
				text:      node,
			});
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
		walk(value, rest, nextPath, nextKey, out, mergePath);
		return;
	}
	if (!Array.isArray(value)) return;
	// The OUTERMOST array wins: a merge replaces an array wholesale rather than element by element,
	// so a fragment addressed inside one would be discarded along with the array it sits in.
	const nextMerge   = mergePath ?? nextPath.join(".");
	const keySegments = keySegmentsFor(value);
	value.forEach((element, i) => {
		walk(element, rest, [...nextPath, String(i)], [...nextKey, keySegments[i]], out, nextMerge);
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
