// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { takeTagInputValue } from "../../src/utils/takeTagInputValue.js";

function inputWith(value) {
	document.body.innerHTML = `<input class="stonetop-tag-add">`;
	const input = document.querySelector("input");
	input.value = value;
	return input;
}

describe("takeTagInputValue", () => {
	it("returns the trimmed value and blanks the box", () => {
		const input = inputWith("  sturdy ");
		expect(takeTagInputValue(input)).toBe("sturdy");
		expect(input.value).toBe("");
	});

	it("returns null for an empty box", () => {
		const input = inputWith("");
		expect(takeTagInputValue(input)).toBeNull();
	});

	it("returns null for whitespace and still blanks it", () => {
		const input = inputWith("   ");
		expect(takeTagInputValue(input)).toBeNull();
		expect(input.value).toBe("");
	});

	// The double-change guard this exists for: the second change event reads the already-blanked
	// box and gets null, so a toggle handler no-ops instead of un-toggling the tag.
	it("second take returns null", () => {
		const input = inputWith("sturdy");
		takeTagInputValue(input);
		expect(takeTagInputValue(input)).toBeNull();
	});
});
