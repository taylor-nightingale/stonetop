import { describe, it, expect } from "vitest";
import { NamePool } from "../../../../src/model/data/steading/NamePool.js";

const labels = pool => pool.map(s => s.label);

describe("NamePool.parse", () => {
	it("splits a region's line into one entry per name", () => {
		expect(labels(NamePool.parse("Aderyn, Aeronwen, Afanen"))).toEqual(["Aderyn", "Aeronwen", "Afanen"]);
	});

	it("trims and drops empty tokens", () => {
		expect(labels(NamePool.parse(" Bryn ,, Cadoc , "))).toEqual(["Bryn", "Cadoc"]);
	});

	it("is empty for a blank or missing pool", () => {
		expect(NamePool.parse("")).toEqual([]);
		expect(NamePool.parse(undefined)).toEqual([]);
	});

	it("marks the entries the steading already uses", () => {
		const pool = NamePool.parse("Bryn, Cadoc", name => name === "Bryn");
		expect(pool.map(s => s.used)).toEqual([true, false]);
	});

	it("makes an ordinary name clickable", () => {
		expect(NamePool.parse("Bryn")[0].clickable).toBe(true);
	});

	// The field is free text a GM edits. A sentence typed into it must still be readable, but no
	// button should offer to paste it into a name cell.
	it("keeps prose, unclickable, rather than dropping it", () => {
		const [entry] = NamePool.parse("Choose from other lists; everyone comes from somewhere else.");
		expect(entry.label).toBe("Choose from other lists; everyone comes from somewhere else.");
		expect(entry.clickable).toBe(false);
	});

	it("allows a name of two or three words", () => {
		expect(NamePool.parse("Ceri of the Hill")[0].clickable).toBe(false);
		expect(NamePool.parse("Old Ceri")[0].clickable).toBe(true);
	});
});
