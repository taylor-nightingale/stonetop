// The functional "group" tag marks a follower/creature as a group (several near-identical members
// sharing one stat block). The book prints it capitalized and sometimes with a member count —
// "Group", "Group (3)" — but the code's canonical form is the lowercase token `"group"` (what
// FollowerSnapshot.isGroup / NpcSnapshot.isGroup detect via `has("group")`, and what the Marshal
// crew + addMember already store). normalizeGroupTags conforms any casing/count to that token and
// surfaces the count so a group follower can be seeded with that many members.
//
// Pure + Node-safe (no Foundry globals): shared by the data migration (src/data/creature.js), the
// PDF parsers (scripts/import/pdf/creatures.js), and the NPC→follower conversion path.

export const GROUP_TAG = "group";
// "Horde" is the book's larger-scale spelling of the same idea (many near-identical members on one
// stat block — the wee folk, the Ghostly Legion, a Servant of Daagon summoned as a horde). It is a
// GROUP TAG for every mechanical purpose, so it drives the members list exactly as "group" does; it
// keeps its own word because the scale it names is part of the creature's description.
export const HORDE_TAG = "horde";

// Matches a bare group tag with an optional "(N)" count, case-insensitively: "group", "Group",
// "Group (3)", "Horde", "Horde (6)". Anything else (e.g. "grouped", "wolf group") is untouched.
const GROUP_RE = /^(group|horde)(?:\s*\((\d+)\))?$/i;

/** Whether a tag names a group, in any casing/count form ("Group (3)", "horde", …). */
export function isGroupTag(tag) {
	return GROUP_RE.test(String(tag ?? "").trim());
}

/**
 * Whether a creature's tags mark it as a group. The ONE place that question is answered — both
 * FollowerSnapshot.isGroup and NpcSnapshot.isGroup delegate here, so a new group spelling never has
 * to be added in two files again.
 * @param {{ values?: string[] }|string[]} tags a Selection or a plain tag array
 */
export function hasGroupTag(tags) {
	const list = Array.isArray(tags) ? tags : (tags?.values ?? []);
	return list.some(isGroupTag);
}

/**
 * Normalize the group tags within a list of tag strings.
 * @param {string[]} tags
 * @returns {{ tags: string[], count: number|null }} the list with every group entry rewritten to its
 *   canonical lowercase token (`"group"` / `"horde"`, each deduped to a single occurrence), and the
 *   member count from a "(N)" suffix if one was present (else null).
 */
export function normalizeGroupTags(tags = []) {
	let count = null;
	const seen = new Set();
	const out = [];
	for (const tag of tags) {
		const m = GROUP_RE.exec(String(tag).trim());
		if (!m) { out.push(tag); continue; }
		if (m[2] != null) count = Number(m[2]);
		const canonical = m[1].toLowerCase();
		if (!seen.has(canonical)) { out.push(canonical); seen.add(canonical); } // collapse "Group" + stray "group"
	}
	return { tags: out, count };
}
