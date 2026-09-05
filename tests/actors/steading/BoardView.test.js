// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { BoardView, BOARD_STATES } from "../../../src/actors/steading/BoardView.js";

const board = states => {
	const root = document.createElement("div");
	root.innerHTML = `
		<div class="steading-board-chips">
			${BOARD_STATES.map(s => `<button data-board-filter="${s}" aria-pressed="false"></button>`).join("")}
		</div>
		${states.map((s, i) => `<div class="steading-improvement-card" data-state="${s}" data-i="${i}"></div>`).join("")}`;
	return root;
};

const shown = root => [...root.querySelectorAll(".steading-improvement-card")]
	.filter(r => !r.hidden).map(r => r.dataset.state);

describe("BoardView — filtering", () => {
	// No chip pressed is the whole board, which is where a reader starts. "Nothing selected" must
	// never mean "nothing shown".
	it("shows everything with no chip pressed", () => {
		const view = new BoardView();
		const root = board(["progress", "untouched", "complete"]);
		view.apply(root);
		expect(view.isFiltered).toBe(false);
		expect(shown(root)).toEqual(["progress", "untouched", "complete"]);
	});

	it("narrows to the state whose chip is pressed", () => {
		const view = new BoardView();
		view.toggle("progress");
		const root = board(["progress", "untouched", "complete", "progress"]);
		view.apply(root);
		expect(shown(root)).toEqual(["progress", "progress"]);
	});

	// Independent toggles, because "in progress AND barely begun" is a real question.
	it("adds a second state rather than replacing the first", () => {
		const view = new BoardView();
		view.toggle("progress");
		view.toggle("complete");
		const root = board(["progress", "untouched", "complete"]);
		view.apply(root);
		expect(shown(root)).toEqual(["progress", "complete"]);
	});

	// Pressing the last active chip clears back to the whole board, so there is always a way out
	// that does not require knowing which chip you pressed first.
	it("clears back to everything when the last pressed chip is released", () => {
		const view = new BoardView();
		view.toggle("progress");
		view.toggle("progress");
		const root = board(["progress", "untouched", "complete"]);
		view.apply(root);
		expect(view.isFiltered).toBe(false);
		expect(shown(root)).toEqual(["progress", "untouched", "complete"]);
	});

	it("ignores a state it does not know", () => {
		const view = new BoardView();
		expect(view.toggle("sideways")).toBe(false);
		expect(view.isFiltered).toBe(false);
	});
});

describe("BoardView — surviving a render", () => {
	// Core rebuilds the part's DOM on every render, which takes the pressed chips with it. What this
	// reader chose is put back afterwards, like the roster's search and caret.
	it("puts the pressed chips back", () => {
		const view = new BoardView();
		view.toggle("complete");

		const root = board(["progress", "complete"]);
		view.restore(root);

		const pressed = [...root.querySelectorAll("[data-board-filter]")]
			.filter(c => c.getAttribute("aria-pressed") === "true")
			.map(c => c.dataset.boardFilter);
		expect(pressed).toEqual(["complete"]);
		expect(shown(root)).toEqual(["complete"]);
	});

	it("survives a root with no board on it at all", () => {
		expect(() => new BoardView().restore(document.createElement("div"))).not.toThrow();
		expect(() => new BoardView().restore(null)).not.toThrow();
	});
});
