// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { activateComboBoxes } from "../../src/utils/comboBox.js";

// Build a follower-style add-combo: an input + ▾ toggle + a (hidden) option list.
function makeCombo(options = []) {
	document.body.innerHTML = `
		<div class="stonetop-tags">
			<span class="stonetop-combo stonetop-combo--add">
				<input class="stonetop-combo-input" type="text">
				<button type="button" class="stonetop-combo-toggle">▾</button>
				<ul class="stonetop-combo-list" hidden>
					${options.map(o => `<li class="stonetop-combo-option" data-value="${o}">${o}</li>`).join("")}
				</ul>
			</span>
		</div>`;
	const $ = sel => document.querySelector(sel);
	return { combo: $(".stonetop-combo"), input: $(".stonetop-combo-input"),
		toggle: $(".stonetop-combo-toggle"), list: $(".stonetop-combo-list") };
}

const fire  = (el, type, init = {}) => el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true, ...init }));
const click = el => el.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
const key   = (el, k) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));

describe("activateComboBoxes", () => {
	beforeAll(() => activateComboBoxes()); // listeners install once on document/window
	beforeEach(() => { document.body.innerHTML = ""; });
	afterEach(() => click(document.body)); // close anything left open

	it("opens the list on focus and portals it to <body>", () => {
		const { input, list } = makeCombo(["brave", "cunning"]);
		expect(list.hidden).toBe(true);
		fire(input, "focusin");
		expect(list.hidden).toBe(false);
		expect(list.parentElement).toBe(document.body); // escaped the card's stacking context
	});

	it("picking a plain option fills the input and fires change once", () => {
		const { input, list } = makeCombo(["brave", "cunning"]);
		const onChange = vi.fn();
		input.addEventListener("change", onChange);
		fire(input, "focusin");
		click(list.querySelector('[data-value="cunning"]'));
		expect(input.value).toBe("cunning");
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(list.hidden).toBe(true);
	});

	it("the list is never filtered — every option stays after typing", () => {
		const { input, list } = makeCombo(["brave", "cunning", "bold"]);
		fire(input, "focusin");
		input.value = "zzz";          // no match
		fire(input, "input");
		expect(list.querySelectorAll(".stonetop-combo-option")).toHaveLength(3);
	});

	it("clicking the input opens the list (even with no value typed)", () => {
		const { input, list } = makeCombo(["brave", "cunning"]);
		click(input);
		expect(list.hidden).toBe(false);
	});

	it("selecting an option commits, blurs the input, and dismisses the list", () => {
		const { input, list } = makeCombo(["brave", "cunning"]);
		const blurSpy = vi.spyOn(input, "blur");
		fire(input, "focusin");
		click(list.querySelector('[data-value="cunning"]'));
		expect(input.value).toBe("cunning");
		expect(blurSpy).toHaveBeenCalled();
		expect(list.hidden).toBe(true);
	});

	it("scrolling inside the list keeps it open; a page scroll closes it", () => {
		const { input, list } = makeCombo(["brave", "cunning"]);
		fire(input, "focusin");
		list.dispatchEvent(new Event("scroll", { bubbles: true }));   // scroll within the list
		expect(list.hidden).toBe(false);
		document.body.dispatchEvent(new Event("scroll", { bubbles: true })); // page scroll
		expect(list.hidden).toBe(true);
	});

	describe("fill-in-the-blank (__)", () => {
		it("a one-blank option opens an inline fill row instead of committing", () => {
			const { combo, input, list } = makeCombo(["brave", "crush on __"]);
			const onChange = vi.fn();
			input.addEventListener("change", onChange);
			fire(input, "focusin");
			click(list.querySelector('[data-value="crush on __"]'));

			expect(onChange).not.toHaveBeenCalled();        // not committed yet
			expect(combo.classList.contains("is-filling")).toBe(true);
			expect(input.hidden).toBe(true);
			const blanks = combo.querySelectorAll(".stonetop-fill-blank");
			expect(blanks).toHaveLength(1);
			expect(combo.textContent).toContain("crush on");
		});

		it("confirming assembles the filled string and commits it as one value", () => {
			const { combo, input } = makeCombo(["crush on __"]);
			const onChange = vi.fn();
			input.addEventListener("change", onChange);
			fire(input, "focusin");
			click(document.querySelector(".stonetop-combo-option"));

			combo.querySelector(".stonetop-fill-blank").value = "the baker";
			click(combo.querySelector(".stonetop-fill-confirm"));

			expect(input.value).toBe("crush on the baker");
			expect(onChange).toHaveBeenCalledTimes(1);
			expect(combo.querySelector(".stonetop-fill")).toBeNull(); // editor removed
			expect(input.hidden).toBe(false);
		});

		it("handles a two-blank template", () => {
			const { combo, input } = makeCombo(["__'s kid/cousin/__"]);
			fire(input, "focusin");
			click(document.querySelector(".stonetop-combo-option"));
			const blanks = combo.querySelectorAll(".stonetop-fill-blank");
			expect(blanks).toHaveLength(2);
			blanks[0].value = "Aedith";
			blanks[1].value = "Bram";
			key(blanks[1], "Enter");
			expect(input.value).toBe("Aedith's kid/cousin/Bram");
		});

		it("cancel discards the fill and restores the input without committing", () => {
			const { combo, input } = makeCombo(["hates __"]);
			const onChange = vi.fn();
			input.addEventListener("change", onChange);
			fire(input, "focusin");
			click(document.querySelector(".stonetop-combo-option"));
			combo.querySelector(".stonetop-fill-blank").value = "spiders";
			click(combo.querySelector(".stonetop-fill-cancel"));

			expect(onChange).not.toHaveBeenCalled();
			expect(combo.querySelector(".stonetop-fill")).toBeNull();
			expect(input.hidden).toBe(false);
			expect(combo.classList.contains("is-filling")).toBe(false);
		});
	});
});
