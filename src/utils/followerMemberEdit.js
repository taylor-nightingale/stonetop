// Pure edit helpers for a group follower's `members` list (the Crew). Each member is
// `{ name, hp:{value,max}, tags, traits }` where tags/traits are token lists — the SAME shape
// CharacterFollowers stores, so a member authored on this sheet matches one added on the character
// card. (Nested `tags` is safe from Foundry's `system.tags` reservation, and it is half of a matched
// tags/traits pair, so it keeps its name where the top-level field is `tagList`.) Every helper clones the list and returns a NEW one so the sheet can
// `item.update({ "system.members": list })` (ArrayFields are atomic — whole-array writes). Mirrors
// arcanumMoveEdit.js.

import { parseCsv } from "./followerSelectionEdit.js";

const clone = list => foundry.utils.deepClone(list ?? []);
const blankTags = () => [];

// A new member starts at the group's shared max HP (same as CharacterFollowers.addMember).
export function newMember(hpMax = 0) {
	return { name: "", hp: { value: hpMax, max: hpMax }, tags: blankTags(), traits: blankTags() };
}

export function addMember(list, hpMax = 0) {
	const l = clone(list);
	l.push(newMember(hpMax));
	return l;
}

export function removeMember(list, index) {
	const l = clone(list);
	l.splice(index, 1);
	return l;
}

export function moveMember(list, index, delta) {
	const l = clone(list);
	const other = index + delta;
	if (other < 0 || other >= l.length) return l;
	[l[index], l[other]] = [l[other], l[index]];
	return l;
}

// Set one scalar field (dotted, e.g. "hp.max" or "name"), given an already-coerced value.
export function setMemberField(list, { index, field, value }) {
	const l = clone(list);
	if (l[index]) foundry.utils.setProperty(l[index], field, value);
	return l;
}

// Set a member's `tags` or `traits` from comma-separated text — stored as the token list (the
// field's canonical shape), so the list editor and the character card agree.
export function setMemberListField(list, { index, field, csv }) {
	return setMemberField(list, { index, field, value: parseCsv(csv) });
}
