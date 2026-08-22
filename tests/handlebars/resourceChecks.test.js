import { describe, it, expect, beforeAll } from "vitest";
import Handlebars from "handlebars";
import { registerStonetopHelpers } from "../../src/handlebars/helpers.js";

// A resource track renders as a row of identical buttons. What each one needs in order to be
// announceable — which pip it is, and out of how many — has to come from here, because the template
// has no other source for it.
describe("resourceChecks", () => {
	beforeAll(() => registerStonetopHelpers(Handlebars));
	const checks = resource => Handlebars.helpers.resourceChecks(resource);

	it("returns one entry per pip", () => {
		expect(checks({ current: 2, max: 5 })).toHaveLength(5);
	});

	it("marks the filled pips and leaves the rest empty", () => {
		expect(checks({ current: 2, max: 4 }).map(c => c.checked)).toEqual([true, true, false, false]);
	});

	it("numbers each pip from one, and says how many there are", () => {
		expect(checks({ current: 0, max: 3 }).map(c => `${c.position}/${c.total}`))
			.toEqual(["1/3", "2/3", "3/3"]);
	});

	it("carries a per-pip label when the resource supplies one", () => {
		expect(checks({ current: 0, max: 2, labels: ["one", null] }).map(c => c.label))
			.toEqual(["one", null]);
	});

	it("treats a missing current as an empty track", () => {
		expect(checks({ max: 2 }).map(c => c.checked)).toEqual([false, false]);
	});

	it("is empty for a resource with no max, or no resource at all", () => {
		expect(checks({ current: 1 })).toEqual([]);
		expect(checks(null)).toEqual([]);
		expect(checks(undefined)).toEqual([]);
	});
});

describe("inc", () => {
	beforeAll(() => registerStonetopHelpers(Handlebars));
	const inc = n => Handlebars.helpers.inc(n);

	it("turns a zero-based index into a one-based position", () => {
		expect([0, 1, 2].map(inc)).toEqual([1, 2, 3]);
	});

	it("counts a missing index as the first position", () => {
		expect(inc(undefined)).toBe(1);
		expect(inc(null)).toBe(1);
	});

	it("accepts an index that arrived as a string", () => {
		expect(inc("3")).toBe(4);
	});
});
