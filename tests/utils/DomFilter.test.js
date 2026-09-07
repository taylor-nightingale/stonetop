// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { DomFilter } from "../../src/utils/DomFilter.js";

// The generic half of a search box: it holds a query, answers whether a row matches, and puts the
// query back in the box after a render. WHICH box and WHICH rows belongs to its owner — RosterFilter
// searches the folk roster, BoardView the improvement board — so nothing here names a selector of
// its own beyond the one it is handed.
//
// Deliberately without an `apply`: hiding a row is the owner's call, because the owner may have more
// to say about it. The board's chips and its search both narrow the same list.

const rowWith = text => {
	const row = document.createElement("div");
	row.textContent = text;
	return row;
};

const make = () => new DomFilter(".probe-search", row => row.textContent);

describe("DomFilter", () => {
	it("matches everything while the query is empty", () => {
		expect(make().matches(rowWith("Mill"))).toBe(true);
	});

	it("matches on any part of a row, ignoring case", () => {
		const filter = make();
		filter.setQuery("MIL");
		expect(filter.matches(rowWith("The Mill"))).toBe(true);
		expect(filter.matches(rowWith("Palisade"))).toBe(false);
	});

	// The caller re-filters only when told to, so "did this change" has to be right: a keystroke that
	// leaves the trimmed query the same is not a reason to walk every row.
	it("reports whether the query actually changed", () => {
		const filter = make();
		expect(filter.setQuery("Mill")).toBe(true);
		expect(filter.setQuery(" mill ")).toBe(false);
		expect(filter.setQuery("")).toBe(true);
		expect(filter.query).toBe("");
	});

	it("survives a row whose text is missing", () => {
		const filter = new DomFilter(".probe-search", () => null);
		filter.setQuery("mill");
		expect(filter.matches({})).toBe(false);
	});

	// Core rebuilds the part's DOM on every render, and the template renders the box empty.
	it("puts the query back in its box", () => {
		const filter = make();
		filter.setQuery("mill");
		const root = document.createElement("div");
		root.innerHTML = `<input type="search" class="probe-search">`;
		filter.restoreInput(root);
		expect(root.querySelector(".probe-search").value).toBe("mill");
	});

	it("restores nothing when the tree has no box", () => {
		expect(() => make().restoreInput(document.createElement("div"))).not.toThrow();
	});
});
