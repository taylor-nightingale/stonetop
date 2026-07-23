// Pure, framework-light edit helpers for the parts of a playbook that are NOT choice groups
// (those reuse choiceGroupEdit.js). Each helper clones its input and returns a NEW value, so the
// sheet can `item.update({ <path>: result })` without mutating stored state. Mirrors the
// choiceGroupEdit.js style; depends only on foundry.utils.deepClone (mocked in tests).
//
// Covered shapes:
//   backgrounds[]        {slug, label, description, moves[], choices: <group>|null}
//   origin[]             {region, names[]}
//   specialPossessions   {slugs[], pickCount, pickNote, preselected[]}
//   reference lists      string[] of slugs (moves/startingMoves, followers, inserts) + subsets

const clone = v => foundry.utils.deepClone(v);

// ── Reference lists (slug string arrays) ──────────────────────────────────────
// Add a slug to a list (no duplicates, ignores empty); remove a slug; toggle membership.

export function addRef(list, slug) {
	const out = [...(list ?? [])];
	if (slug && !out.includes(slug)) out.push(slug);
	return out;
}

export function removeRef(list, slug) {
	return (list ?? []).filter(s => s !== slug);
}

export function toggleInSet(list, slug, on) {
	const set = new Set(list ?? []);
	if (on) set.add(slug); else set.delete(slug);
	return [...set];
}

// ── Backgrounds ───────────────────────────────────────────────────────────────

export function blankBackground(n) {
	return { slug: `background-${n}`, label: "", description: "", moves: [], choices: null };
}

export function addBackground(list) {
	const out = clone(list ?? []);
	out.push(blankBackground(out.length));
	return out;
}

export function removeBackground(list, index) {
	const out = clone(list ?? []);
	out.splice(index, 1);
	return out;
}

export function moveBackground(list, index, delta) {
	const out = clone(list ?? []);
	const other = index + delta;
	if (other < 0 || other >= out.length) return out;
	[out[index], out[other]] = [out[other], out[index]];
	return out;
}

// Set one scalar field (slug / label / description) on background `index`.
export function setBackgroundField(list, index, field, value) {
	const out = clone(list ?? []);
	if (!out[index]) return out;
	out[index][field] = value;
	return out;
}

export function addBackgroundMove(list, index, slug) {
	const out = clone(list ?? []);
	if (!out[index]) return out;
	out[index].moves = addRef(out[index].moves, slug);
	return out;
}

export function removeBackgroundMove(list, index, slug) {
	const out = clone(list ?? []);
	if (!out[index]) return out;
	out[index].moves = removeRef(out[index].moves, slug);
	return out;
}

// ── Origin ────────────────────────────────────────────────────────────────────

export function blankOrigin() {
	return { region: "", names: [] };
}

export function addOrigin(list) {
	const out = clone(list ?? []);
	out.push(blankOrigin());
	return out;
}

export function removeOrigin(list, index) {
	const out = clone(list ?? []);
	out.splice(index, 1);
	return out;
}

export function moveOrigin(list, index, delta) {
	const out = clone(list ?? []);
	const other = index + delta;
	if (other < 0 || other >= out.length) return out;
	[out[index], out[other]] = [out[other], out[index]];
	return out;
}

export function setOriginRegion(list, index, region) {
	const out = clone(list ?? []);
	if (!out[index]) return out;
	out[index].region = region;
	return out;
}

// names: a string[] (the sheet splits its textarea by newline before calling).
export function setOriginNames(list, index, names) {
	const out = clone(list ?? []);
	if (!out[index]) return out;
	out[index].names = [...names];
	return out;
}

// ── Special possessions ─────────────────────────────────────────────────────────

export function blankSpecialPossessions() {
	return { slugs: [], pickCount: 0, pickNote: "", preselected: [] };
}

// Set pickCount (number) or pickNote (string).
export function setSpecialPossessionsField(sp, field, value) {
	return { ...(sp ?? blankSpecialPossessions()), [field]: value };
}

export function addPossession(sp, slug) {
	const base = sp ?? blankSpecialPossessions();
	return { ...base, slugs: addRef(base.slugs, slug) };
}

// Remove a possession slug — and drop it from preselected, so a removed possession can't linger
// as a phantom auto-add.
export function removePossession(sp, slug) {
	const base = sp ?? blankSpecialPossessions();
	return {
		...base,
		slugs:       removeRef(base.slugs, slug),
		preselected: removeRef(base.preselected, slug),
	};
}

export function togglePreselected(sp, slug, on) {
	const base = sp ?? blankSpecialPossessions();
	return { ...base, preselected: toggleInSet(base.preselected, slug, on) };
}
