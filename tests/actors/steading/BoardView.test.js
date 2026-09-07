// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { BoardView, BOARD_STATES, BOARD_FLAGS } from "../../../src/actors/steading/BoardView.js";

// Rows carry a name so the search has something to find; a card in play carries its requirement
// rows and its payoff too, which is why the search reads the whole card rather than its title.
const board = (states, names = [], flags = []) => {
	const root = document.createElement("div");
	root.innerHTML = `
		<input type="search" class="steading-board-search">
		<div class="steading-board-chips">
			${BOARD_STATES.map(s => `<button data-board-filter="${s}" aria-pressed="false"></button>`).join("")}
			${BOARD_FLAGS.map(f => `<button data-board-flag="${f}" aria-pressed="false"></button>`).join("")}
		</div>
		${states.map((s, i) => `<div class="steading-improvement-card" data-state="${s}" data-i="${i}"
			data-board-owed="${(flags[i] ?? []).includes("owed")}"
			data-board-season="${(flags[i] ?? []).includes("season")}">${names[i] ?? ""}</div>`).join("")}`;
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


// Twenty-plus rows and three state chips are not a way to find "mill".
describe("BoardView — searching", () => {
	const named = () => board(["progress", "untouched", "complete"],
	                          ["Mill", "Palisade", "Additional Housing"]);

	it("shows everything for an empty query", () => {
		const view = new BoardView();
		const root = named();
		view.apply(root);
		expect(shown(root)).toHaveLength(3);
	});

	it("narrows to the rows whose text answers the query", () => {
		const view = new BoardView();
		expect(view.setQuery("mill")).toBe(true);
		const root = named();
		view.apply(root);
		expect(shown(root)).toEqual(["progress"]);
	});

	// The whole card, not its title: "what gives me Surplus?" is answered by the payoff, which is in
	// the DOM whether the card is open or shut.
	it("searches everything written on the card", () => {
		const view = new BoardView();
		view.setQuery("surplus");
		const root = board(["progress", "untouched"], ["Mill — +1 Surplus each autumn", "Palisade"]);
		view.apply(root);
		expect(shown(root)).toEqual(["progress"]);
	});

	it("says when the query has not actually changed, so nothing re-filters", () => {
		const view = new BoardView();
		expect(view.setQuery("Mill")).toBe(true);
		expect(view.setQuery("  mill  ")).toBe(false);
		expect(view.query).toBe("mill");
	});

	// Both narrow the SAME list, so a row has to satisfy both. Two objects each writing `hidden`
	// would take turns overwriting the other, and which won would come down to restore order.
	it("shows a row only when the chips AND the search both allow it", () => {
		const view = new BoardView();
		view.toggle("progress");
		view.setQuery("mill");
		const root = board(["progress", "untouched", "progress"],
		                   ["Mill", "Mill Race", "Palisade"]);
		view.apply(root);
		expect(shown(root)).toEqual(["progress"]);
	});

	// Core rebuilds the part's DOM on every render, which takes the typed query with it.
	it("puts the query back in the box a render emptied", () => {
		const view = new BoardView();
		view.setQuery("mill");
		const root = named();
		view.restore(root);
		expect(root.querySelector(".steading-board-search").value).toBe("mill");
		expect(shown(root)).toEqual(["progress"]);
	});
});


// What a row is ABOUT cuts across what state it is in: an owed card is also a complete one, and a
// card firing this season can be in any state at all. A second axis, not three more states.
describe("BoardView — the cross-cutting chips", () => {
	const mixed = () => board(
		["complete", "progress", "untouched"],
		["Mill", "Palisade", "Stone Wall"],
		[["owed"], ["season"], []],
	);

	it("shows everything with no flag pressed", () => {
		const view = new BoardView();
		const root = mixed();
		view.apply(root);
		expect(shown(root)).toHaveLength(3);
	});

	it("narrows to the rows carrying the flag", () => {
		const view = new BoardView();
		expect(view.toggleFlag("owed")).toBe(true);
		const root = mixed();
		view.apply(root);
		expect(shown(root)).toEqual(["complete"]);
	});

	// OR within the axis, as the states are: "owed or firing now" is one question.
	it("adds a second flag rather than replacing the first", () => {
		const view = new BoardView();
		view.toggleFlag("owed");
		view.toggleFlag("season");
		const root = mixed();
		view.apply(root);
		expect(shown(root)).toEqual(["complete", "progress"]);
	});

	// AND across the axes: "complete AND owed" is a question, and so is "in progress AND owed".
	it("narrows on both axes at once", () => {
		const view = new BoardView();
		view.toggle("progress");
		view.toggleFlag("owed");
		const root = mixed();
		view.apply(root);
		expect(shown(root)).toEqual([]);
	});

	it("clears back to the whole board when the last flag is pressed again", () => {
		const view = new BoardView();
		view.toggleFlag("owed");
		view.toggleFlag("owed");
		const root = mixed();
		view.apply(root);
		expect(shown(root)).toHaveLength(3);
	});

	it("ignores a flag it does not know", () => {
		const view = new BoardView();
		expect(view.toggleFlag("urgent")).toBe(false);
	});

	// Core rebuilds the part's DOM on every render, which takes the pressed chips with it.
	it("puts the pressed flag chips back after a render", () => {
		const view = new BoardView();
		view.toggleFlag("season");
		const root = mixed();
		view.restore(root);
		expect(root.querySelector('[data-board-flag="season"]').getAttribute("aria-pressed")).toBe("true");
		expect(root.querySelector('[data-board-flag="owed"]').getAttribute("aria-pressed")).toBe("false");
	});

	// All three narrowings are one pass: the search, the states and the flags.
	it("still answers the search alongside both axes", () => {
		const view = new BoardView();
		view.toggleFlag("owed");
		view.setQuery("palisade");
		const root = mixed();
		view.apply(root);
		expect(shown(root)).toEqual([]);
	});
});
