import { describe, it, expect } from "vitest";
import {
	DEFAULT_ROWS, blankOption, newGroup, addRow, removeRow, moveRow, toggleTrack, toggleInput,
	addOption, removeOption, addOutfitItem, removeOutfitItem, setField, buildRows,
	instinctOptions, instinctFromStrings,
} from "../../src/utils/choiceGroupEdit.js";

const g = () => newGroup("test-group");

describe("choiceGroupEdit", () => {
	it("newGroup makes an empty {slug, list}", () => {
		expect(newGroup("x")).toEqual({ slug: "x", list: [] });
	});

	// The slug IS the namespace the group's values are stored under, so a group cannot be minted
	// without one. It used to default to the literal "choices", which meant two groups added to the
	// same item silently shared one value store.
	it("newGroup refuses to mint a group with no slug", () => {
		expect(() => newGroup()).toThrow(/slug/i);
		expect(() => newGroup("")).toThrow(/slug/i);
	});

	it("addRow appends an entry (with a generated slug) and a pick (with one option)", () => {
		let group = addRow(g(), "entry");
		expect(group.list[0].type).toBe("entry");
		expect(group.list[0].slug).toBe("entry-0");
		group = addRow(group, "pick");
		expect(group.list[1].type).toBe("pick");
		expect(group.list[1].options).toHaveLength(1);
		expect(group.list[1].pickCount).toBe(1);
	});

	it("addRow does not mutate the input group (returns a clone)", () => {
		const before = g();
		const after = addRow(before, "entry");
		expect(before.list).toHaveLength(0);
		expect(after.list).toHaveLength(1);
	});

	it("removeRow / moveRow reorder the list; moveRow is a no-op at the edges", () => {
		let group = addRow(addRow(addRow(g(), "entry"), "entry"), "entry");
		group.list[0].slug = "a"; group.list[1].slug = "b"; group.list[2].slug = "c";
		expect(moveRow(group, 0, -1).list.map(r => r.slug)).toEqual(["a", "b", "c"]); // edge no-op
		expect(moveRow(group, 0, 1).list.map(r => r.slug)).toEqual(["b", "a", "c"]);
		expect(removeRow(group, 1).list.map(r => r.slug)).toEqual(["a", "c"]);
	});

	it("toggleTrack / toggleInput flip on then off", () => {
		let group = addRow(g(), "entry");
		group = toggleTrack(group, 0);
		expect(group.list[0].track).toEqual({ max: 1 });
		expect(toggleTrack(group, 0).list[0].track).toBeNull();
		group = toggleInput(group, 0);
		expect(group.list[0].input).toEqual({ placeholder: null });
		expect(toggleInput(group, 0).list[0].input).toBeNull();
	});

	it("addOption / removeOption manage a pick row's options", () => {
		let group = addRow(g(), "pick");           // starts with 1 option
		group = addOption(group, 0);
		expect(group.list[0].options).toHaveLength(2);
		group = removeOption(group, 0, 0);
		expect(group.list[0].options).toHaveLength(1);
	});

	it("addOutfitItem / removeOutfitItem on a row and on an option", () => {
		let group = addRow(g(), "pick");
		group = addOutfitItem(group, 0);            // on the row
		expect(group.list[0].outfitItems).toHaveLength(1);
		group = addOutfitItem(group, 0, 0);         // on the option
		expect(group.list[0].options[0].outfitItems).toHaveLength(1);
		group = removeOutfitItem(group, 0, 0);      // remove the row's
		expect(group.list[0].outfitItems).toHaveLength(0);
	});

	it("setField writes to the group, a row, or an option", () => {
		let group = addRow(g(), "pick");
		group = setField(group, { target: "group", field: "slug", value: "renamed" });
		expect(group.slug).toBe("renamed");
		group = setField(group, { target: "row", rowIndex: 0, field: "pickCount", value: 3 });
		expect(group.list[0].pickCount).toBe(3);
		group = setField(group, { target: "option", rowIndex: 0, optionIndex: 0, field: "content.title", value: "Hi" });
		expect(group.list[0].options[0].content.title).toBe("Hi");
	});

	it("setField on a followers.* subfield writes follower grants on a blank row", () => {
		let group = addRow(g(), "entry");
		expect(group.list[0].grants).toEqual([]);
		group = setField(group, { target: "row", rowIndex: 0, field: "followers.slugs", value: ["enfys"] });
		expect(group.list[0].grants).toEqual([{ type: "follower", slug: "enfys", locations: ["tab"] }]);
		group = setField(group, { target: "row", rowIndex: 0, field: "followers.hideFromFollowersTab", value: true });
		expect(group.list[0].grants).toEqual([{ type: "follower", slug: "enfys", locations: [] }]);
	});

	it("setField drops the grants when the slugs empty", () => {
		let group = addRow(g(), "entry");
		group = setField(group, { target: "row", rowIndex: 0, field: "followers.slugs", value: ["enfys"] });
		group = setField(group, { target: "row", rowIndex: 0, field: "followers.inlineDisplay", value: true });
		expect(group.list[0].grants).toEqual([{ type: "follower", slug: "enfys", locations: ["inline", "tab"] }]);
		group = setField(group, { target: "row", rowIndex: 0, field: "followers.slugs", value: [] });
		expect(group.list[0].grants).toBeUndefined();
	});

	it("instinct: round-trips a list of strings through the choice-group shape", () => {
		const group = instinctFromStrings(["Denial", "Obsession"]);
		expect(group.list[0].type).toBe("pick");
		expect(group.list[0].pickCount).toBe(1);
		expect(group.list[0].options.map(o => o.text)).toEqual(["Denial", "Obsession"]);
		expect(group.list[0].options.map(o => o.slug)).toEqual(["instinct-0", "instinct-1"]);
		expect(instinctOptions(group)).toEqual(["Denial", "Obsession"]);
	});

	it("instinct: empty list → null group; instinctOptions(null) → []", () => {
		expect(instinctFromStrings([])).toBeNull();
		expect(instinctFromStrings(undefined)).toBeNull();
		expect(instinctOptions(null)).toEqual([]);
	});

	it("buildRows annotates rows and options with editor metadata", () => {
		const group = addRow(addRow(g(), "entry"), "pick");
		const rows = buildRows(group);
		expect(rows[0]).toMatchObject({ _index: 0, _target: "row", _rowIndex: 0, _hasOptionIndex: false });
		expect(rows[1].options[0]).toMatchObject({ _index: 0, _target: "option", _rowIndex: 1, _hasOptionIndex: true, _optionIndex: 0 });
	});

	it("buildRows seeds content.textHtml (md→HTML) for rows and pick options — the <prose-mirror> seed", () => {
		const group = {
			slug: "choices",
			list: [
				{ type: "entry", slug: "e", content: { title: null, text: "**Requires** this" } },
				{ type: "pick", pickCount: 1, options: [{ slug: "o", content: { title: "O", text: "*maybe*" } }] },
			],
		};
		const rows = buildRows(group);
		expect(rows[0].content.textHtml).toContain("<strong>Requires</strong>");
		expect(rows[1].options[0].content.textHtml).toContain("<em>maybe</em>");
	});

	it("buildRows seeds empty textHtml when content.text is absent", () => {
		const rows = buildRows(addRow(g(), "entry"));
		expect(rows[0].content.textHtml).toBe("");
	});
});
