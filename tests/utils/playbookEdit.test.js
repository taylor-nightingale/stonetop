import { describe, it, expect } from "vitest";
import * as PE from "../../src/utils/playbookEdit.js";

// Pure helpers: every one clones and returns a NEW value, never mutating its input.

describe("playbookEdit — reference lists", () => {
	it("addRef appends a slug once, ignoring duplicates and empties", () => {
		expect(PE.addRef(["a"], "b")).toEqual(["a", "b"]);
		expect(PE.addRef(["a"], "a")).toEqual(["a"]);
		expect(PE.addRef(["a"], "")).toEqual(["a"]);
		expect(PE.addRef(undefined, "a")).toEqual(["a"]);
	});

	it("removeRef drops every matching slug", () => {
		expect(PE.removeRef(["a", "b", "a"], "a")).toEqual(["b"]);
		expect(PE.removeRef(undefined, "a")).toEqual([]);
	});

	it("toggleInSet adds when on, removes when off", () => {
		expect(PE.toggleInSet(["a"], "b", true)).toEqual(["a", "b"]);
		expect(PE.toggleInSet(["a", "b"], "b", false)).toEqual(["a"]);
		expect(PE.toggleInSet(["a"], "a", true)).toEqual(["a"]); // no dup
	});

	it("does not mutate the input", () => {
		const list = ["a"];
		PE.addRef(list, "b");
		expect(list).toEqual(["a"]);
	});
});

describe("playbookEdit — backgrounds", () => {
	it("addBackground appends a blank background with an indexed slug", () => {
		const out = PE.addBackground([]);
		expect(out).toEqual([{ slug: "background-0", label: "", description: "", moves: [], choices: null }]);
		expect(PE.addBackground(out)[1].slug).toBe("background-1");
	});

	it("removeBackground removes by index", () => {
		const list = [PE.blankBackground(0), PE.blankBackground(1)];
		expect(PE.removeBackground(list, 0)).toHaveLength(1);
		expect(PE.removeBackground(list, 0)[0].slug).toBe("background-1");
	});

	it("moveBackground swaps neighbours and clamps at the ends", () => {
		const list = [PE.blankBackground(0), PE.blankBackground(1)];
		expect(PE.moveBackground(list, 0, 1).map(b => b.slug)).toEqual(["background-1", "background-0"]);
		expect(PE.moveBackground(list, 0, -1).map(b => b.slug)).toEqual(["background-0", "background-1"]);
	});

	it("setBackgroundField sets one scalar field", () => {
		const list = [PE.blankBackground(0)];
		expect(PE.setBackgroundField(list, 0, "label", "Initiate")[0].label).toBe("Initiate");
		expect(PE.setBackgroundField(list, 0, "label", "Initiate")).not.toBe(list);
		expect(list[0].label).toBe(""); // input untouched
	});

	it("addBackgroundMove / removeBackgroundMove edit the nested move list", () => {
		let list = [PE.blankBackground(0)];
		list = PE.addBackgroundMove(list, 0, "rites-of-the-land");
		expect(list[0].moves).toEqual(["rites-of-the-land"]);
		list = PE.removeBackgroundMove(list, 0, "rites-of-the-land");
		expect(list[0].moves).toEqual([]);
	});
});

describe("playbookEdit — origin", () => {
	it("addOrigin appends a blank region", () => {
		expect(PE.addOrigin([])).toEqual([{ region: "", names: [] }]);
	});

	it("setOriginRegion and setOriginNames set their fields immutably", () => {
		let list = PE.addOrigin([]);
		list = PE.setOriginRegion(list, 0, "Stonetop");
		list = PE.setOriginNames(list, 0, ["Arwel", "Blodwen"]);
		expect(list[0]).toEqual({ region: "Stonetop", names: ["Arwel", "Blodwen"] });
	});

	it("moveOrigin swaps and clamps", () => {
		const list = [{ region: "A", names: [] }, { region: "B", names: [] }];
		expect(PE.moveOrigin(list, 1, -1).map(o => o.region)).toEqual(["B", "A"]);
		expect(PE.moveOrigin(list, 1, 1).map(o => o.region)).toEqual(["A", "B"]);
	});
});

describe("playbookEdit — special possessions", () => {
	it("blankSpecialPossessions is the canonical slugs-form shape", () => {
		expect(PE.blankSpecialPossessions()).toEqual({ slugs: [], pickCount: 0, pickNote: "", preselected: [] });
	});

	it("setSpecialPossessionsField seeds a blank when sp is null", () => {
		expect(PE.setSpecialPossessionsField(null, "pickCount", 2)).toEqual({ slugs: [], pickCount: 2, pickNote: "", preselected: [] });
	});

	it("addPossession appends a slug without duplicates", () => {
		const sp = PE.addPossession(null, "sacred-pouch");
		expect(sp.slugs).toEqual(["sacred-pouch"]);
		expect(PE.addPossession(sp, "sacred-pouch").slugs).toEqual(["sacred-pouch"]);
	});

	it("removePossession drops the slug from BOTH slugs and preselected", () => {
		let sp = PE.addPossession(null, "sacred-pouch");
		sp = PE.togglePreselected(sp, "sacred-pouch", true);
		expect(sp.preselected).toEqual(["sacred-pouch"]);
		sp = PE.removePossession(sp, "sacred-pouch");
		expect(sp.slugs).toEqual([]);
		expect(sp.preselected).toEqual([]);
	});

	it("togglePreselected adds and removes from the preselected subset", () => {
		let sp = PE.addPossession(null, "a");
		sp = PE.togglePreselected(sp, "a", true);
		expect(sp.preselected).toEqual(["a"]);
		sp = PE.togglePreselected(sp, "a", false);
		expect(sp.preselected).toEqual([]);
	});
});
