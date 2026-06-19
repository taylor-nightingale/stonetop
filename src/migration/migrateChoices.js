// Normalizes a `choices` array (groups, each with a `list` of rows) to the current shape:
//   - row types collapse to `entry` / `pick` (legacy `heading`/`follower` → `entry`)
//   - content: { title, titleNote, subtitle, subtitleNote, text }
//       (subHeading → subtitle, subNote → subtitleNote, entry-level `note` → content.titleNote)
//   - any `input` gains a `type` ("inline" by default; "rich" must be set explicitly)
// Pure and idempotent — shared by the pack-conversion script and runtime migrations.

export function migrateChoices(choices) {
	if (!Array.isArray(choices)) return choices;
	for (const group of choices) {
		for (const row of group?.list ?? []) migrateChoiceRow(row);
	}
	return choices;
}

// A model's `choices` field is either an array of groups (Playbook/Insert/Npc item)
// or a single group object with its own `list` (Move/Possession/Improvement). Normalize
// both. Returns the same reference (mutated in place); null/undefined pass through.
export function migrateChoicesField(choices) {
	if (Array.isArray(choices)) return migrateChoices(choices);
	if (choices && Array.isArray(choices.list)) {
		for (const row of choices.list) migrateChoiceRow(row);
	}
	return choices;
}

export function migrateChoiceRow(row) {
	if (!row || typeof row !== "object") return row;

	// Pick rows are left structurally alone. They carry an explicit `type: "pick"` in pack
	// data, but in character groupDefs they're identified only by an `options` array.
	if (row.type === "pick" || Array.isArray(row.options)) return row;

	const wasFollower = row.type === "follower";
	row.type = "entry";

	const c = row.content ?? (row.content = {});
	// Legacy follower/heading rows kept their label in a top-level `title`.
	if (row.title !== undefined) { c.text ??= row.title; delete row.title; }
	if (wasFollower && row.slug && row.followers === undefined) row.followers = [row.slug];

	if (c.subHeading !== undefined) { c.subtitle     ??= c.subHeading; delete c.subHeading; }
	if (c.subNote   !== undefined) { c.subtitleNote ??= c.subNote;    delete c.subNote; }
	if (row.note    !== undefined) { c.titleNote    ??= row.note;     delete row.note; }

	if (row.input && typeof row.input === "object" && row.input.type === undefined) {
		row.input.type = "inline";
	}
	return row;
}
