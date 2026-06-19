// Pure, framework-light edit helpers for a single choice GROUP object `{ slug, list }` (the shape
// shared by move choices, insert choices, and insert instinct). Each helper takes a group and
// returns a NEW group (clones first) so callers can `item.update({ <path>: group })`. Extracted
// from StonetopMoveSheet so both the move sheet and the insert sheet share — and TEST — one
// implementation. Only depends on foundry.utils.{deepClone,setProperty} (mocked in tests).

export const DEFAULT_ROWS = {
	entry: { type: "entry", slug: "", content: { title: null, text: null }, note: null, track: null, input: null, followers: [], outfitItems: [], inlineDisplay: false },
	pick:  { type: "pick",  pickCount: 1, inline: false, options: [] },
};

const BLANK_OUTFIT_ITEM = { slug: "", name: "", weight: 0, inventoryColumn: "regular" };
const BLANK_PICK_OPTION  = { slug: "", content: { title: null, text: null }, followers: [], outfitItems: [], note: null, type: null, inlineDisplay: false };

export function blankOption(n) {
	return { ...BLANK_PICK_OPTION, slug: "option-" + n, content: { title: "Option " + n, text: null }, outfitItems: [], followers: [] };
}

const clone = g => foundry.utils.deepClone(g);

/** A fresh empty group. */
export function newGroup(slug = "choices") {
	return { slug: slug || "choices", list: [] };
}

export function addRow(group, type) {
	const g = clone(group);
	const row = foundry.utils.deepClone(DEFAULT_ROWS[type]);
	if (!row) return g;
	if (type === "entry") row.slug = "entry-" + g.list.length;
	if (type === "pick")  row.options.push(blankOption(1));
	g.list.push(row);
	return g;
}

export function removeRow(group, index) {
	const g = clone(group);
	g.list.splice(index, 1);
	return g;
}

export function moveRow(group, index, delta) {
	const g = clone(group);
	const other = index + delta;
	if (other < 0 || other >= g.list.length) return g;
	[g.list[index], g.list[other]] = [g.list[other], g.list[index]];
	return g;
}

export function toggleTrack(group, index) {
	const g = clone(group);
	const row = g.list[index];
	row.track = row.track ? null : { max: 1 };
	return g;
}

export function toggleInput(group, index) {
	const g = clone(group);
	const row = g.list[index];
	row.input = row.input ? null : { placeholder: null };
	return g;
}

export function addOption(group, index) {
	const g = clone(group);
	const options = g.list[index].options;
	options.push(blankOption(options.length + 1));
	return g;
}

export function removeOption(group, index, optionIndex) {
	const g = clone(group);
	g.list[index].options.splice(optionIndex, 1);
	return g;
}

export function addOutfitItem(group, index, optionIndex = null) {
	const g = clone(group);
	const obj = optionIndex != null ? g.list[index].options[optionIndex] : g.list[index];
	obj.outfitItems = [...(obj.outfitItems ?? []), { ...BLANK_OUTFIT_ITEM }];
	return g;
}

export function removeOutfitItem(group, index, outfitItemIndex, optionIndex = null) {
	const g = clone(group);
	const obj = optionIndex != null ? g.list[index].options[optionIndex] : g.list[index];
	obj.outfitItems.splice(outfitItemIndex, 1);
	return g;
}

// Set one field, given the already-coerced value. target = "group" | "row" | "option".
export function setField(group, { target, rowIndex, optionIndex, field, value }) {
	const g = clone(group);
	let obj;
	if      (target === "group")  obj = g;
	else if (target === "row")    obj = g.list[rowIndex];
	else if (target === "option") obj = g.list[rowIndex].options[optionIndex];
	if (obj) foundry.utils.setProperty(obj, field, value);
	return g;
}

// -- Instinct: stored as a choice group internally, edited as a plain list of strings ----------
// The instinct group is `{ slug:"instinct", list:[{ type:"pick", pickCount:1, options:[...] }] }`;
// each option's `text` is one instinct. These map between that shape and a `string[]`.

export function instinctOptions(group) {
	return (group?.list?.[0]?.options ?? []).map(o => o?.text ?? "");
}

export function instinctFromStrings(strings) {
	if (!strings?.length) return null;
	return {
		slug: "instinct",
		list: [{
			type: "pick", pickCount: 1, inline: false,
			options: strings.map((s, i) => ({ slug: `instinct-${i}`, text: s, description: "" })),
		}],
	};
}

// Render-ready rows with the metadata the choice-group-editor partial needs.
export function buildRows(group) {
	return (group?.list ?? []).map((row, ri) => ({
		...row,
		_index: ri, _target: "row", _rowIndex: ri, _hasOptionIndex: false, _optionIndex: null,
		options: row.options?.map((opt, oi) => ({
			...opt, _index: oi, _rowIndex: ri, _target: "option", _hasOptionIndex: true, _optionIndex: oi,
		})),
	}));
}
