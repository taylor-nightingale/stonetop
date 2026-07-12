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

// Matches a bare group tag with an optional "(N)" count, case-insensitively: "group", "Group",
// "Group (3)". Anything else (e.g. "grouped", "wolf group") is left untouched.
const GROUP_RE = /^group(?:\s*\((\d+)\))?$/i;

/**
 * Normalize the group tag within a list of tag strings.
 * @param {string[]} tags
 * @returns {{ tags: string[], count: number|null }} the list with every group entry rewritten to
 *   the canonical `"group"` (deduped to a single occurrence), and the member count from a "(N)"
 *   suffix if one was present (else null).
 */
export function normalizeGroupTags(tags = []) {
	let count = null;
	let seen = false;
	const out = [];
	for (const tag of tags) {
		const m = GROUP_RE.exec(String(tag).trim());
		if (!m) { out.push(tag); continue; }
		if (m[1] != null) count = Number(m[1]);
		if (!seen) { out.push(GROUP_TAG); seen = true; } // collapse "Group" + stray "group" to one
	}
	return { tags: out, count };
}
