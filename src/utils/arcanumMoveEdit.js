// Pure edit helpers for an arcanum BACK "mystery moves" list (major arcana). Each move is
// `{ id, name, subtitle, tracker:{label,max}|null, text, followerSlug }`. Every helper takes the list
// and returns a NEW list (clones first) so the sheet can `item.update({ "system.back.moves": list })`.
// Mirrors the choiceGroupEdit.js pattern. Only depends on foundry.utils.{deepClone,setProperty,randomID}.

const clone = list => foundry.utils.deepClone(list ?? []);

export function newMove() {
	return { id: `move-${foundry.utils.randomID(8)}`, name: "", subtitle: null, tracker: null, text: "", followerSlug: null };
}

export function addMove(list) {
	const l = clone(list);
	l.push(newMove());
	return l;
}

export function removeMove(list, index) {
	const l = clone(list);
	l.splice(index, 1);
	return l;
}

export function moveMove(list, index, delta) {
	const l = clone(list);
	const other = index + delta;
	if (other < 0 || other >= l.length) return l;
	[l[index], l[other]] = [l[other], l[index]];
	return l;
}

// Set one field (dotted, e.g. "tracker.max"), given an already-coerced value.
export function setMoveField(list, { index, field, value }) {
	const l = clone(list);
	if (l[index]) foundry.utils.setProperty(l[index], field, value);
	return l;
}

// Toggle the optional progress tracker on/off (a move either has a {label,max} tracker or none).
export function toggleTracker(list, index) {
	const l = clone(list);
	const m = l[index];
	if (m) m.tracker = m.tracker ? null : { label: "", max: 1 };
	return l;
}
