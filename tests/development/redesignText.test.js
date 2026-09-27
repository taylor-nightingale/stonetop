import { describe, it, expect } from "vitest";
import { html, plain, rehydrate } from "../../scripts/development/redesign-mock/text.js";
import { RichText, rich } from "../../src/model/snapshot/RichText.js";

/**
 * The capture is JSON, so every RichText in it arrives as a plain `{ raw, autoRoll, html }` — and the
 * shipped code the deck reuses asks `instanceof RichText`. Handed a plain one, `rich()` makes the
 * string "[object Object]" of it, which `hasText` then calls text.
 */
describe("rehydrate", () => {
	const captured = { raw: "**LONGING**", autoRoll: false, html: "<strong>LONGING</strong>" };

	it("makes a captured rich field a RichText again, keeping its enriched html", () => {
		const back = rehydrate(captured);
		expect(back).toBeInstanceOf(RichText);
		expect(back.raw).toBe("**LONGING**");
		expect(back.render()).toBe("<strong>LONGING</strong>");
	});

	it("walks a whole group, leaving everything else as it was", () => {
		const group = { slug: "g", list: [{ type: "entry", slug: "a", content: { text: captured },
			track: { slug: "a", checks: [true], requires: null }, input: null }] };
		const back = rehydrate(group);
		expect(back.list[0].content.text).toBeInstanceOf(RichText);
		expect(back.list[0].track).toEqual({ slug: "a", checks: [true], requires: null });
		expect(back.slug).toBe("g");
		expect(back.list[0].input).toBeNull();
	});

	// The case that made it necessary.
	it("is what lets the shipped code read the capture's text", () => {
		expect(rich(captured).raw).toBe("[object Object]");
		expect(rich(rehydrate(captured)).raw).toBe("**LONGING**");
	});
});

describe("html", () => {
	it("renders a RichText the way the sheet's {{rich}} does", () => {
		expect(html(rich("**bold**"))).toBe("<strong>bold</strong>");
	});

	it("reads a captured field and a bare string", () => {
		expect(html({ raw: "a", html: "<em>a</em>" })).toBe("<em>a</em>");
		expect(html("words")).toBe("words");
		expect(html(null)).toBe("");
	});
});

describe("plain", () => {
	it("reads the raw side of any of the three", () => {
		expect(plain(rich(" x "))).toBe("x");
		expect(plain({ raw: "y" })).toBe("y");
		expect(plain(null)).toBe("");
	});
});
