// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { OpenDisclosures } from "../../src/utils/OpenDisclosures.js";
import { Disclosure } from "../../src/utils/Disclosure.js";
import { MOVE_ROW_ACTIONS } from "../../src/actors/moveRowHandlers.js";

// One rendered tree of move rows. Re-calling it is a RE-RENDER: the old DOM is thrown away and a
// fresh, all-shut tree replaces it, which is exactly what ApplicationV2 does to a part.
function render(slugs = ["bolster", "deploy"]) {
	document.body.innerHTML = slugs.map(slug => `
		<li class="stonetop-item" data-disclosure-row>
			<div class="stonetop-item-header">
				<button type="button" class="stonetop-move-disclosure" data-action="toggleMoveBody" data-disclosure
				        aria-expanded="false" aria-controls="sheet-1-move-homefront-${slug}">${slug}</button>
			</div>
			<div class="stonetop-move-body" id="sheet-1-move-homefront-${slug}" hidden></div>
		</li>`).join("");
	return document.body;
}

const toggleFor = slug => document.querySelector(`[aria-controls="sheet-1-move-homefront-${slug}"]`);
const bodyFor   = slug => document.getElementById(`sheet-1-move-homefront-${slug}`);
const isOpen    = slug => !bodyFor(slug).hidden;

// The action as a sheet calls it: `this` is the sheet, so the record is the sheet's.
const clickOn = (sheet, slug) =>
	MOVE_ROW_ACTIONS.toggleMoveBody.call(sheet, new Event("click"), toggleFor(slug));

describe("OpenDisclosures", () => {
	beforeEach(() => { document.body.innerHTML = ""; });

	it("re-opens, after a render, the rows that were open before it", () => {
		const sheet = { openDisclosures: new OpenDisclosures() };
		render();
		clickOn(sheet, "bolster");

		sheet.openDisclosures.restore(render());

		expect(isOpen("bolster")).toBe(true);
		expect(toggleFor("bolster").getAttribute("aria-expanded")).toBe("true");
		// The caret and the gloss follow the row's class, so restoring has to set that too.
		expect(toggleFor("bolster").closest(".stonetop-item").classList.contains("is-open")).toBe(true);
	});

	it("leaves the rows nobody opened shut", () => {
		const sheet = { openDisclosures: new OpenDisclosures() };
		render();
		clickOn(sheet, "bolster");

		sheet.openDisclosures.restore(render());

		expect(isOpen("deploy")).toBe(false);
		expect(toggleFor("deploy").getAttribute("aria-expanded")).toBe("false");
	});

	it("forgets a row that was shut again before the render", () => {
		const sheet = { openDisclosures: new OpenDisclosures() };
		render();
		clickOn(sheet, "bolster");
		clickOn(sheet, "bolster");

		sheet.openDisclosures.restore(render());

		expect(isOpen("bolster")).toBe(false);
	});

	// Restoring states the whole tree, not "re-open some" — so running it twice, or on a tree that is
	// already correct, changes nothing.
	it("is idempotent", () => {
		const sheet = { openDisclosures: new OpenDisclosures() };
		render();
		clickOn(sheet, "bolster");

		const root = render();
		sheet.openDisclosures.restore(root);
		sheet.openDisclosures.restore(root);

		expect(isOpen("bolster")).toBe(true);
		expect(isOpen("deploy")).toBe(false);
	});

	// The point of storing this on the sheet instance rather than on the actor: what one reader has
	// open is a fact about that reader, not about the steading.
	it("is one reader's own — a second sheet on the same rows is unaffected", () => {
		const mine   = { openDisclosures: new OpenDisclosures() };
		const theirs = { openDisclosures: new OpenDisclosures() };
		render();
		clickOn(mine, "bolster");

		theirs.openDisclosures.restore(render());

		expect(isOpen("bolster"), "one reader's open row reached another reader's sheet").toBe(false);
	});

	// Keyed on the region id, which the template mints per sheet, category AND slug — so the same
	// move listed under two categories is two rows that open independently.
	it("tells two rows for one move apart", () => {
		const sheet = { openDisclosures: new OpenDisclosures() };
		const twoCategories = () => {
			document.body.innerHTML = ["homefront", "seasons"].map(cat => `
				<li class="stonetop-item" data-disclosure-row>
					<button type="button" class="stonetop-move-disclosure" data-disclosure
					        aria-expanded="false" aria-controls="sheet-1-move-${cat}-bolster">Bolster</button>
					<div class="stonetop-move-body" id="sheet-1-move-${cat}-bolster" hidden></div>
				</li>`).join("");
			return document.body;
		};
		const bodyIn = cat => document.getElementById(`sheet-1-move-${cat}-bolster`);

		twoCategories();
		MOVE_ROW_ACTIONS.toggleMoveBody.call(
			sheet, new Event("click"), document.querySelector('[aria-controls="sheet-1-move-homefront-bolster"]'));

		sheet.openDisclosures.restore(twoCategories());

		expect(bodyIn("homefront").hidden).toBe(false);
		expect(bodyIn("seasons").hidden, "the same move in another category opened too").toBe(true);
	});

	// What it remembers is what the READER CHANGED, not which regions are open — so the template
	// still decides where a region starts. A move row ships shut; the steading's name lists ship
	// open, and a render they were not part of must not fold them away.
	it("leaves a region the reader never touched exactly as it was rendered", () => {
		const sheet = { openDisclosures: new OpenDisclosures() };
		const openList = () => {
			document.body.innerHTML = `
				<div>
					<button type="button" data-disclosure aria-expanded="true" aria-controls="list-1">Names</button>
					<p id="list-1">Bryn, Cadoc</p>
				</div>`;
			return document.body;
		};

		openList();
		sheet.openDisclosures.restore(openList());

		expect(document.getElementById("list-1").hidden, "a list that ships open was folded away").toBe(false);
	});

	it("shuts a region that ships open once its reader has folded it", () => {
		const sheet = { openDisclosures: new OpenDisclosures() };
		const openList = () => {
			document.body.innerHTML = `
				<div>
					<button type="button" data-disclosure aria-expanded="true" aria-controls="list-1">Names</button>
					<p id="list-1">Bryn, Cadoc</p>
				</div>`;
			return document.body;
		};

		openList();
		const disclosure = Disclosure.from(document.querySelector("[data-disclosure]"));
		disclosure.toggle();
		sheet.openDisclosures.remember(disclosure);

		sheet.openDisclosures.restore(openList());

		expect(document.getElementById("list-1").hidden).toBe(true);
		expect(document.querySelector("[data-disclosure]").getAttribute("aria-expanded")).toBe("false");
	});

	it("survives a tree with no disclosures in it at all", () => {
		document.body.innerHTML = "<p>nothing here</p>";
		expect(() => new OpenDisclosures().restore(document.body)).not.toThrow();
		expect(() => new OpenDisclosures().restore(null)).not.toThrow();
	});
});

describe("Disclosure, as OpenDisclosures addresses it", () => {
	beforeEach(() => { document.body.innerHTML = ""; });

	it("is identified by the region its button controls", () => {
		render(["bolster"]);
		expect(Disclosure.from(toggleFor("bolster")).key).toBe("sheet-1-move-homefront-bolster");
	});

	it("sets a state outright, rather than only flipping it", () => {
		render(["bolster"]);
		const d = Disclosure.from(toggleFor("bolster"));
		d.setOpen(true);
		d.setOpen(true);
		expect(d.isOpen).toBe(true);
		d.setOpen(false);
		expect(d.isOpen).toBe(false);
	});
});
