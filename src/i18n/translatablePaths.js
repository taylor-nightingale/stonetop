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

const PLAYBOOK = [
	"name",
	"system.description",
	"system.statsNote",
	"system.startingMovesNote",
	"system.specialPossessions.pickNote",
	// Regions are place names; a translator may well leave them as-is, but that is their call.
	// `origin[].names[]` is deliberately absent — those are personal names, not prose.
	"system.origin[].region",
	"system.backgrounds[].label",
	"system.backgrounds[].description",
	"system.backgrounds[].resource.title",
	"system.backgrounds[].choices.list[].content.title",
	"system.backgrounds[].choices.list[].content.titleNote",
	"system.backgrounds[].choices.list[].content.text",
	"system.backgrounds[].choices.list[].options[].text",
	"system.choices[].list[].content.title",
	"system.choices[].list[].content.titleNote",
	"system.choices[].list[].content.text",
	"system.choices[].list[].options[].text",
	"system.instinct.list[].content.title",
	"system.instinct.list[].content.text",
	"system.instinct.list[].options[].text",
	"system.instinct.list[].options[].description",
	"system.appearance.list[].content.title",
	"system.appearance.list[].content.text",
	"system.appearance.list[].options[].text",
	"system.appearance.list[].options[].description",
	"system.introductions.step3",
	"system.introductions.step4.list[].content.title",
	"system.introductions.step4.list[].content.text",
	"system.introductions.step6.list[].content.title",
	"system.introductions.step6.list[].content.text",
];

export const TEXT_PATHS = {
	playbook: PLAYBOOK,
};

// Structural segments that address the data but say nothing to a translator. Dropping them keeps a
// key close to what the sheet shows ("choices/arcana-major/where-acquired/text") without losing
// uniqueness — no two allowlisted paths collide once they are removed.
export const KEY_SEPARATOR = "/";

const UNKEYED_SEGMENTS = new Set(["system", "list", "content"]);

function keySegmentFor(element, index) {
	const slug = element?.slug;
	return typeof slug === "string" && slug.trim() ? slug : String(index);
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
	value.forEach((element, i) => {
		walk(element, rest, [...nextPath, String(i)], [...nextKey, keySegmentFor(element, i)], out);
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
