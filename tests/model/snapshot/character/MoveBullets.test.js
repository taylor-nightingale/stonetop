import { describe, it, expect } from "vitest";
import { MoveBullets } from "../../../../src/model/snapshot/character/MoveBullets.js";
import { rich } from "../../../../src/model/snapshot/RichText.js";

const rawsOf = description => MoveBullets.from(description).map(text => text.raw);

describe("MoveBullets.from", () => {
	it("lifts each bullet of a markdown list, in order", () => {
		expect(rawsOf("Follow these steps:\n\n- First.\n- Second.\n- Third.")).toEqual(
			["First.", "Second.", "Third."]);
	});

	it("leaves the prose above the list out of it", () => {
		expect(rawsOf("When you **_do the thing_**, follow these steps:\n\n- Only this.")).toEqual(["Only this."]);
	});

	it("keeps a bullet's emphasis, so the caller can render it as game text", () => {
		expect(rawsOf("- **Population boom:** youth come of age."))
			.toEqual(["<strong>Population boom:</strong> youth come of age."]);
	});

	it("reads the HTML a move's own sheet saves, not just the markdown the packs ship", () => {
		expect(rawsOf("<p>Steps:</p><ul><li>First.</li><li>Second.</li></ul>")).toEqual(["First.", "Second."]);
	});

	it("takes a RichText as readily as a string", () => {
		expect(rawsOf(rich("- First.\n- Second."))).toEqual(["First.", "Second."]);
	});

	it("is empty for a move whose description spells nothing out", () => {
		expect(MoveBullets.from("When you roll +DEX, take +1 forward.")).toEqual([]);
	});

	it("is empty for no description at all", () => {
		expect(MoveBullets.from(null)).toEqual([]);
		expect(MoveBullets.from("")).toEqual([]);
		expect(MoveBullets.from("   ")).toEqual([]);
	});

	it("drops an empty bullet rather than yielding a blank line", () => {
		expect(rawsOf("<ul><li>First.</li><li>  </li><li>Third.</li></ul>")).toEqual(["First.", "Third."]);
	});

	// A back-reference could close the first item against the LAST closing tag and swallow the rest.
	it("closes each item against its own tag", () => {
		expect(rawsOf("<ul><li>First.</li><li>Second.</li></ul>")).toHaveLength(2);
	});

	it("reads an ordered list the same way", () => {
		expect(rawsOf("<ol><li>First.</li><li>Second.</li></ol>")).toEqual(["First.", "Second."]);
	});
});
