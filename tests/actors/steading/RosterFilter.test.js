// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { RosterFilter } from "../../../src/actors/steading/RosterFilter.js";

/**
 * The roster beside the reference lists — which the search must never reach.
 *
 * Traits is a TEXTAREA, as the roster renders it: its list wraps, where the other three cells are
 * one-line inputs. A fixture that made it an input would let a search that only reads inputs pass.
 */
function tree() {
	document.body.innerHTML = `
		<input type="search" class="steading-folk-search">
		<div class="steading-folk-roster">
			<div class="steading-folk-row" data-id="a">
				<input type="text" value="Bryn"><input type="text" value=""><input type="text" value="publican"><textarea class="stonetop-person-traits">gets the best deals</textarea>
			</div>
			<div class="steading-folk-row" data-id="b">
				<input type="text" value="Cadoc"><input type="text" value=""><input type="text" value="smith"><textarea class="stonetop-person-traits">has a beef with Marshedge</textarea>
			</div>
			<div class="steading-folk-row" data-id="c">
				<input type="text" value="Seadha"><input type="text" value="Marshedge"><input type="text" value="trader"><textarea class="stonetop-person-traits"></textarea>
			</div>
		</div>
		<div class="steading-folk-ref">
			<button class="steading-folk-entry">Bryn</button>
			<button class="steading-folk-entry">Cadoc</button>
			<button class="steading-folk-entry">Eirlys</button>
		</div>`;
	return document.body;
}

const visibleIds = root => [...root.querySelectorAll(".steading-folk-row")].filter(r => !r.hidden).map(r => r.dataset.id);
const visibleEntries = root => [...root.querySelectorAll(".steading-folk-entry")].filter(e => !e.hidden).length;

describe("RosterFilter", () => {
	beforeEach(() => { document.body.innerHTML = ""; });

	it("shows everyone until something is typed", () => {
		const root = tree();
		new RosterFilter().apply(root);
		expect(visibleIds(root)).toEqual(["a", "b", "c"]);
	});

	it("matches on the occupation", () => {
		const root = tree();
		const filter = new RosterFilter();
		filter.setQuery("smith");
		filter.apply(root);
		expect(visibleIds(root)).toEqual(["b"]);
	});

	// The traits cell is a textarea; a sweep that only read `input` stopped searching the widest
	// column on the row the moment it stopped being an input.
	it("matches on a trait, which is not written in an input", () => {
		const root = tree();
		const filter = new RosterFilter();
		filter.setQuery("best deals");
		filter.apply(root);
		expect(visibleIds(root)).toEqual(["a"]);
	});

	it("matches on the name, the home and the traits too", () => {
		const root = tree();
		const filter = new RosterFilter();
		filter.setQuery("marshedge");
		filter.apply(root);
		expect(visibleIds(root)).toEqual(["b", "c"]);
	});

	it("ignores case and surrounding whitespace", () => {
		const root = tree();
		const filter = new RosterFilter();
		filter.setQuery("  BRYN ");
		filter.apply(root);
		expect(visibleIds(root)).toEqual(["a"]);
	});

	it("brings the rows back when the box is cleared", () => {
		const root = tree();
		const filter = new RosterFilter();
		filter.setQuery("smith");
		filter.apply(root);
		filter.setQuery("");
		filter.apply(root);
		expect(visibleIds(root)).toEqual(["a", "b", "c"]);
	});

	// The whole point: reading down the name and trait lists is how an NPC gets made, so narrowing
	// the roster must never narrow them.
	it("never touches the reference lists", () => {
		const root = tree();
		const filter = new RosterFilter();
		filter.setQuery("smith");
		filter.apply(root);
		expect(visibleEntries(root)).toBe(3);
	});

	it("reports whether the query actually changed, so unrelated keystrokes cost nothing", () => {
		const filter = new RosterFilter();
		expect(filter.setQuery("smith")).toBe(true);
		expect(filter.setQuery("smith")).toBe(false);
		expect(filter.setQuery("SMITH ")).toBe(false);
	});
});

describe("RosterFilter.restore", () => {
	beforeEach(() => { document.body.innerHTML = ""; });

	// The template renders the box empty, so a re-render — anyone's edit causes one — would otherwise
	// show a full roster under a search that still claimed to be narrowing it.
	it("puts the query back in the box and re-hides what it excludes", () => {
		const root = tree();
		const filter = new RosterFilter();
		filter.setQuery("smith");

		filter.restore(root);

		expect(root.querySelector(".steading-folk-search").value).toBe("smith");
		expect(visibleIds(root)).toEqual(["b"]);
	});

	it("leaves the box alone when nothing has been searched for", () => {
		const root = tree();
		new RosterFilter().restore(root);
		expect(root.querySelector(".steading-folk-search").value).toBe("");
		expect(visibleIds(root)).toEqual(["a", "b", "c"]);
	});
});
