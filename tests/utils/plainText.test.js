import { describe, it, expect } from "vitest";
import { plainText } from "../../src/utils/plainText.js";

describe("plainText", () => {
	it("drops inline tags without leaving a space where they were", () => {
		expect(plainText("on a <strong>10+</strong>, it works")).toBe("on a 10+, it works");
	});

	it("turns a block boundary into a space", () => {
		expect(plainText("<p>one</p><p>two</p>")).toBe("one two");
	});

	it("decodes entities, since the result is read rather than parsed", () => {
		expect(plainText("spit &amp; polish &#39;n&#39; more")).toBe("spit & polish 'n' more");
	});

	it("collapses runs of whitespace", () => {
		expect(plainText("  a \n\t b  ")).toBe("a b");
	});
});
