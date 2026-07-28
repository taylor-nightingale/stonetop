// Normalizes a `choices` array (groups, each with a `list` of rows) to the current shape:
//   - row types collapse to `entry` / `pick` (legacy `heading`/`follower` → `entry`)
//   - content: { title, titleNote, subtitle, subtitleNote, text }
//       (subHeading → subtitle, subNote → subtitleNote, entry-level `note` → content.titleNote)
//   - any `input` gains a `type` ("inline" by default; "rich" must be set explicitly)
//   - follower wiring folds into the generic `grants` array (see Grant): a legacy `followers` slug
//     array/object → [{ type:"follower", slug, locations }] (inlineDisplay→"inline", tab unless hidden)
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

	// Pick rows are left structurally alone (they carry an explicit `type: "pick"` in pack
	// data, but in character groupDefs they're identified only by an `options` array) —
	// except their options' follower wiring, which normalizes like an entry's.
	if (row.type === "pick" || Array.isArray(row.options)) {
		for (const opt of row.options ?? []) migrateGrants(opt);
		return row;
	}

	const wasFollower = row.type === "follower";
	row.type = "entry";

	const c = row.content ?? (row.content = {});
	// Legacy follower/heading rows kept their label in a top-level `title`.
	if (row.title !== undefined) { c.text ??= row.title; delete row.title; }
	if (wasFollower && row.slug && row.followers === undefined && row.grants === undefined) row.followers = [row.slug];
	migrateGrants(row);

	if (c.subHeading !== undefined) { c.subtitle     ??= c.subHeading; delete c.subHeading; }
	if (c.subNote   !== undefined) { c.subtitleNote ??= c.subNote;    delete c.subNote; }
	if (row.note    !== undefined) { c.titleNote    ??= row.note;     delete row.note; }

	if (row.input && typeof row.input === "object" && row.input.type === undefined) {
		row.input.type = "inline";
	}
	return row;
}

// The follower wiring a row/option carries becomes the generic `grants` array: each follower slug → a
// `{ type:"follower", slug, locations }` grant. `locations` encodes the old booleans — `inlineDisplay`
// → "inline", NOT `hideFromFollowersTab` → "tab". Handles every legacy source (a bare `followers` slug
// array + sibling `inlineDisplay` flag, or the grouped `{slugs, inlineDisplay, hideFromFollowersTab}`
// object) and is idempotent (a row already carrying `grants` is left alone). The stray legacy keys are
// dropped. Exported for the pack-conversion script, which applies ONLY this to known choice rows.
export function migrateGrants(row) {
	if (!row || typeof row !== "object") return row;
	if (Array.isArray(row.grants)) { delete row.followers; delete row.inlineDisplay; return row; }

	let slugs = [], inlineDisplay = false, hideFromFollowersTab = false;
	if (Array.isArray(row.followers)) {
		slugs = row.followers.filter(Boolean);
		inlineDisplay = row.inlineDisplay ?? false;
	} else if (row.followers && typeof row.followers === "object") {
		slugs = Array.isArray(row.followers.slugs) ? row.followers.slugs.filter(Boolean) : [];
		inlineDisplay = !!row.followers.inlineDisplay;
		hideFromFollowersTab = !!row.followers.hideFromFollowersTab;
	}
	if (slugs.length) {
		const locations = [...(inlineDisplay ? ["inline"] : []), ...(hideFromFollowersTab ? [] : ["tab"])];
		row.grants = slugs.map(slug => ({ type: "follower", slug, locations }));
	}
	delete row.followers;
	if (row.inlineDisplay !== undefined) delete row.inlineDisplay;
	return row;
}
