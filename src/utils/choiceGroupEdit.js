// Pure, framework-light edit helpers for a single choice GROUP object `{ slug, list }` (the shape
// shared by move choices, insert choices, and insert instinct). Each helper takes a group and
// returns a NEW group (clones first) so callers can `item.update({ <path>: group })`. Extracted
// from StonetopMoveSheet so both the move sheet and the insert sheet share — and TEST — one
// implementation. Depends on foundry.utils.{deepClone,setProperty} (mocked in tests) and the
// rich-text handler (to seed the content.text <prose-mirror> editor).

import { rich } from "../model/snapshot/RichText.js";

export const DEFAULT_ROWS = {
	entry: { type: "entry", slug: "", content: { title: null, text: null }, note: null, track: null, input: null, grants: [], outfitItems: [], indent: false },
	pick:  { type: "pick",  pickCount: 1, inline: false, options: [] },
};

const BLANK_OUTFIT_ITEM = { slug: "", name: "", weight: 0, inventoryColumn: "regular" };
const BLANK_PICK_OPTION  = { slug: "", content: { title: null, text: null }, grants: [], outfitItems: [], note: null, type: null };

export function blankOption(n) {
	return { ...BLANK_PICK_OPTION, slug: "option-" + n, content: { title: "Option " + n, text: null }, outfitItems: [], grants: [] };
}

const clone = g => foundry.utils.deepClone(g);

/** A fresh empty group. The slug is required: it names the value store the group's values live in,
 *  so minting one without it silently collides with every other unnamed group on the same item. */
export function newGroup(slug) {
	if (!slug) throw new TypeError("newGroup requires a slug — it is the group's value namespace");
	return { slug, list: [] };
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
	if (!obj) return g;
	// The follower editor UI (a CSV of slugs + inline/hide-from-tab checkboxes) writes `followers.*`
	// fields; translate them onto the canonical `grants` array (one follower Grant per slug).
	if (field.startsWith("followers.")) { applyFollowerField(obj, field.slice("followers.".length), value); return g; }
	foundry.utils.setProperty(obj, field, value);
	return g;
}

// The follower editor's current view, reconstructed from a row/option's `grants` (follower type only).
function followerView(obj) {
	const follower = (obj.grants ?? []).filter(gr => gr.type === "follower");
	return {
		slugs:  follower.map(gr => gr.slug),
		inline: follower.some(gr => (gr.locations ?? []).includes("inline")),
		// A row with no follower grants defaults to "on tab" (the historical fresh-link default).
		onTab:  follower.length ? follower.some(gr => (gr.locations ?? []).includes("tab")) : true,
	};
}

// Apply one follower-editor field (slugs | inlineDisplay | hideFromFollowersTab) to `obj.grants`,
// rebuilding the follower grants (non-follower grants are preserved) and dropping `grants` when empty.
function applyFollowerField(obj, sub, value) {
	const view = followerView(obj);
	if (sub === "slugs")                     view.slugs  = Array.isArray(value) ? value : (value ? [value] : []);
	else if (sub === "inlineDisplay")        view.inline = !!value;
	else if (sub === "hideFromFollowersTab") view.onTab  = !value;
	const locations = [...(view.inline ? ["inline"] : []), ...(view.onTab ? ["tab"] : [])];
	const nonFollower = (obj.grants ?? []).filter(gr => gr.type !== "follower");
	const follower    = view.slugs.map(slug => ({ type: "follower", slug, locations }));
	const grants = [...nonFollower, ...follower];
	if (grants.length) obj.grants = grants; else delete obj.grants;
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

// Content with `textHtml`: the stored markdown `content.text` rendered to HTML, to seed the
// <prose-mirror> editor (which reads/writes HTML). Uses the rich-text handler's sync render — NOT the
// async enrich pass — on purpose: the editor must show @UUID/roll tokens as their editable source,
// not baked-in links. Both entry rows and pick options are editable.
function contentWithHtml(content) {
	return { ...content, textHtml: rich(content?.text ?? "").render() };
}

// The `followers`-shaped view the choices-entry-fields.hbs editor reads (CSV slugs + two checkboxes),
// derived from the row/option's canonical `grants`. Slugs stay an array — `{{followers.slugs}}` renders
// it comma-joined, and the mixin's change handler splits it back to an array. Undefined when no follower
// grants (the fields render empty/unchecked).
function followerEditorView(obj) {
	const view = followerView(obj);
	if (!view.slugs.length) return undefined;
	return { slugs: view.slugs, inlineDisplay: view.inline, hideFromFollowersTab: !view.onTab };
}

// Render-ready rows with the metadata the choice-group-editor partial needs.
export function buildRows(group) {
	return (group?.list ?? []).map((row, ri) => ({
		...row,
		content: contentWithHtml(row.content),
		followers: followerEditorView(row),
		_index: ri, _target: "row", _rowIndex: ri, _hasOptionIndex: false, _optionIndex: null,
		options: row.options?.map((opt, oi) => ({
			...opt, content: contentWithHtml(opt.content),
			followers: followerEditorView(opt),
			_index: oi, _rowIndex: ri, _target: "option", _hasOptionIndex: true, _optionIndex: oi,
		})),
	}));
}
