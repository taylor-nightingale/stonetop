import { describe, it, expect } from "vitest";
import { ImprovementWording } from "../../../../src/model/data/steading/ImprovementWording.js";
import { SectionRule } from "../../../../src/model/data/steading/ImprovementRequirements.js";
import { ImprovementResult } from "../../../../src/model/data/steading/ImprovementResult.js";

// A stand-in for game.i18n holding only what each test writes, so a template the author has not
// written yet is exactly what it will be in the game: absent, or empty.
function i18n(strings) {
	const get = key => strings[key];
	return {
		has:    key => typeof get(key) === "string",
		localize: key => get(key) ?? key,
		format: (key, data = {}) => (get(key) ?? key).replace(/\{(\w+)\}/g, (_, n) => data[n] ?? ""),
	};
}

const W = "stonetop.improvement.wording";

describe("ImprovementWording.heading", () => {
	const wording = new ImprovementWording(i18n({
		[`${W}.heading.first.all`]:  "FIRST ALL",
		[`${W}.heading.first.some`]: "FIRST {count}",
		[`${W}.heading.later.all`]:  "LATER ALL",
		[`${W}.heading.later.or`]:   "",
	}));

	it("words a heading for its rule and its place", () => {
		expect(wording.heading(SectionRule.all(), true)).toBe("FIRST ALL");
		expect(wording.heading(SectionRule.all(), false)).toBe("LATER ALL");
		expect(wording.heading(new SectionRule("some", 2), true)).toBe("FIRST 2");
	});

	// Until the author writes the words, nothing is written — never a key into an item's text.
	it("writes nothing for a template that is absent or empty", () => {
		expect(wording.heading(new SectionRule("some", 2), false)).toBeNull();
		expect(wording.heading(new SectionRule("or"), false)).toBeNull();
	});

	it("writes nothing for a section that does not count, which has no rule to state", () => {
		expect(wording.heading(new SectionRule("none"), true)).toBeNull();
	});
});

describe("ImprovementWording.result", () => {
	const wording = new ImprovementWording(i18n({
		[`${W}.result.increase`]:   "up {rating} {amount}",
		[`${W}.result.decrease`]:   "down {rating} {amount}",
		[`${W}.result.list`]:       "add {entry} to {list}",
		[`${W}.result.set`]:        "set {rating} {value}",
		"stonetop.steading.attr.fortunes": "Fortunes",
		"stonetop.steading.attr.surplus":  "Surplus",
		"stonetop.steading.attr.size":     "Size",
		"stonetop.steading.lists.resources": "Resources",
	}));
	const result = raw => ImprovementResult.fromRaw(raw);

	it("words a rating change, up or down", () => {
		expect(wording.result(result({ change: { target: "fortunes", amount: 1 } }))).toBe("up Fortunes 1");
		expect(wording.result(result({ change: { target: "surplus", amount: -2 } }))).toBe("down Surplus 2");
	});

	it("words a list entry", () => {
		expect(wording.result(result({ listEntry: { list: "resources", text: "Mill" } }))).toBe("add Mill to Resources");
	});

	it("words a rating set", () => {
		expect(wording.result(result({ set: { target: "size", value: "town" } }))).toBe("set Size town");
	});

	// Words only the table can say: the author writes them.
	it("writes nothing for a result the sheet does nothing about", () => {
		expect(wording.result(result({ text: "you are extra happy" }))).toBeNull();
	});
});

/** Words follow the choices while they are still the generated ones, for a saved result or a draft. */
describe("ImprovementWording.follow", () => {
	const wording = new ImprovementWording(i18n({
		[`${W}.result.increase`]: "up {rating} {amount}",
		"stonetop.steading.attr.fortunes": "Fortunes",
	}));
	const fortunes = text => ImprovementResult.fromRaw({ change: { target: "fortunes", amount: 1 }, text });

	it("rewrites generated words for the new choice", () => {
		const before = fortunes("up Fortunes 1");
		expect(wording.follow(before, before.withAmount(2)).text).toBe("up Fortunes 2");
	});

	it("writes words for a result that had none", () => {
		const before = fortunes("");
		expect(wording.follow(before, before.withAmount(2)).text).toBe("up Fortunes 2");
	});

	it("leaves the author's own words alone", () => {
		const before = fortunes("a party, and +1 Fortunes");
		expect(wording.follow(before, before.withAmount(2)).text).toBe("a party, and +1 Fortunes");
	});
});
