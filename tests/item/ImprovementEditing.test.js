// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { ImprovementEditing } from "../../src/item/ImprovementEditing.js";
import { ImprovementResult } from "../../src/model/data/steading/ImprovementResult.js";

/**
 * The improvement sheet's one open editor — a heading's, a result's, or the result adder — kept on the
 * sheet instance like the wound editor's: every save re-renders the sheet, and the editor has to come
 * back open with the reader still in it.
 */
describe("ImprovementEditing", () => {
	it("opens one editor at a time", () => {
		const editing = new ImprovementEditing();
		editing.openHeading(1);
		expect(editing.isHeadingOpen(1)).toBe(true);
		editing.openResult(2);
		expect([editing.isHeadingOpen(1), editing.isResultOpen(2)]).toEqual([false, true]);
	});

	it("holds the result being added until it is written", () => {
		const editing = new ImprovementEditing();
		editing.openAdder("henceforth", ImprovementResult.henceforth());
		expect(editing.isAdderOpen("henceforth")).toBe(true);
		editing.updateDraft(d => d.withText("the bells ring"));
		expect(editing.draft.text).toBe("the bells ring");
	});

	// It hangs where it was opened; the adder at the card's foot can open below what the window shows.
	it("brings the editor into view once, when it opens — never on the re-renders after", () => {
		const root = document.createElement("div");
		root.innerHTML = `<div class="stonetop-improvement-panel"></div>`;
		const editing = new ImprovementEditing();
		const reveal = vi.fn();
		editing.openResult(0);
		editing.applyReveal(root, reveal);
		editing.applyReveal(root, reveal);
		expect(reveal).toHaveBeenCalledOnce();
		editing.openHeading(1);
		editing.applyReveal(root, reveal);
		expect(reveal).toHaveBeenCalledTimes(2);
	});

	it("forgets the draft when it shuts", () => {
		const editing = new ImprovementEditing();
		editing.openAdder("completion", ImprovementResult.onCompletion());
		editing.close();
		expect([editing.draft, editing.isAdderOpen("completion")]).toEqual([null, false]);
	});

	it("changes no draft when no adder is open", () => {
		const editing = new ImprovementEditing();
		editing.openResult(0);
		editing.updateDraft(d => d.withText("x"));
		expect(editing.draft).toBeNull();
	});

	describe("shutting", () => {
		function wired() {
			const root = document.createElement("div");
			root.innerHTML = `
				<div class="stonetop-improvement-panel"><input class="inside"></div>
				<button data-improvement-opener class="opener"></button>
				<span class="elsewhere"></span>`;
			const editing = new ImprovementEditing();
			const onClose = vi.fn();
			editing.attach(root, onClose);
			editing.openHeading(1);
			return { root, onClose };
		}

		it("shuts on a click elsewhere on the sheet", () => {
			const { root, onClose } = wired();
			root.querySelector(".elsewhere").click();
			expect(onClose).toHaveBeenCalledOnce();
		});

		it("stays open for a click inside it, or on what opens an editor", () => {
			const { root, onClose } = wired();
			root.querySelector(".inside").click();
			root.querySelector(".opener").click();
			expect(onClose).not.toHaveBeenCalled();
		});

		it("shuts on Escape inside it", () => {
			const { root, onClose } = wired();
			root.querySelector(".inside").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
			expect(onClose).toHaveBeenCalledOnce();
		});
	});
});
