// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { OpenMoveRows } from "../../src/utils/OpenMoveRows.js";
import { MoveDisclosure, MOVE_DISCLOSURE_ACTIONS } from "../../src/utils/MoveDisclosure.js";

// One rendered tree of move rows. Re-calling it is a RE-RENDER: the old DOM is thrown away and a
// fresh, all-shut tree replaces it, which is exactly what ApplicationV2 does to a part.
function render(slugs = ["bolster", "deploy"]) {
	document.body.innerHTML = slugs.map(slug => `
		<li class="stonetop-item">
			<div class="stonetop-item-header">
				<button type="button" class="stonetop-move-disclosure" data-action="toggleMoveBody"
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
	MOVE_DISCLOSURE_ACTIONS.toggleMoveBody.call(sheet, new Event("click"), toggleFor(slug));

describe("OpenMoveRows", () => {
	beforeEach(() => { document.body.innerHTML = ""; });

	it("re-opens, after a render, the rows that were open before it", () => {
		const sheet = { openMoveRows: new OpenMoveRows() };
		render();
		clickOn(sheet, "bolster");

		sheet.openMoveRows.restore(render());

		expect(isOpen("bolster")).toBe(true);
		expect(toggleFor("bolster").getAttribute("aria-expanded")).toBe("true");
		// The caret and the gloss follow the row's class, so restoring has to set that too.
		expect(toggleFor("bolster").closest(".stonetop-item").classList.contains("is-open")).toBe(true);
	});

	it("leaves the rows nobody opened shut", () => {
		const sheet = { openMoveRows: new OpenMoveRows() };
		render();
		clickOn(sheet, "bolster");

		sheet.openMoveRows.restore(render());

		expect(isOpen("deploy")).toBe(false);
		expect(toggleFor("deploy").getAttribute("aria-expanded")).toBe("false");
	});

	it("forgets a row that was shut again before the render", () => {
		const sheet = { openMoveRows: new OpenMoveRows() };
		render();
		clickOn(sheet, "bolster");
		clickOn(sheet, "bolster");

		sheet.openMoveRows.restore(render());

		expect(isOpen("bolster")).toBe(false);
	});

	// Restoring states the whole tree, not "re-open some" — so running it twice, or on a tree that is
	// already correct, changes nothing.
	it("is idempotent", () => {
		const sheet = { openMoveRows: new OpenMoveRows() };
		render();
		clickOn(sheet, "bolster");

		const root = render();
		sheet.openMoveRows.restore(root);
		sheet.openMoveRows.restore(root);

		expect(isOpen("bolster")).toBe(true);
		expect(isOpen("deploy")).toBe(false);
	});

	// The point of storing this on the sheet instance rather than on the actor: what one reader has
	// open is a fact about that reader, not about the steading.
	it("is one reader's own — a second sheet on the same rows is unaffected", () => {
		const mine   = { openMoveRows: new OpenMoveRows() };
		const theirs = { openMoveRows: new OpenMoveRows() };
		render();
		clickOn(mine, "bolster");

		theirs.openMoveRows.restore(render());

		expect(isOpen("bolster"), "one reader's open row reached another reader's sheet").toBe(false);
	});

	// Keyed on the region id, which the template mints per sheet, category AND slug — so the same
	// move listed under two categories is two rows that open independently.
	it("tells two rows for one move apart", () => {
		const sheet = { openMoveRows: new OpenMoveRows() };
		const twoCategories = () => {
			document.body.innerHTML = ["homefront", "seasons"].map(cat => `
				<li class="stonetop-item">
					<button type="button" class="stonetop-move-disclosure"
					        aria-expanded="false" aria-controls="sheet-1-move-${cat}-bolster">Bolster</button>
					<div class="stonetop-move-body" id="sheet-1-move-${cat}-bolster" hidden></div>
				</li>`).join("");
			return document.body;
		};
		const bodyIn = cat => document.getElementById(`sheet-1-move-${cat}-bolster`);

		twoCategories();
		MOVE_DISCLOSURE_ACTIONS.toggleMoveBody.call(
			sheet, new Event("click"), document.querySelector('[aria-controls="sheet-1-move-homefront-bolster"]'));

		sheet.openMoveRows.restore(twoCategories());

		expect(bodyIn("homefront").hidden).toBe(false);
		expect(bodyIn("seasons").hidden, "the same move in another category opened too").toBe(true);
	});

	it("survives a tree with no move rows in it at all", () => {
		document.body.innerHTML = "<p>nothing here</p>";
		expect(() => new OpenMoveRows().restore(document.body)).not.toThrow();
		expect(() => new OpenMoveRows().restore(null)).not.toThrow();
	});
});

describe("MoveDisclosure, as OpenMoveRows addresses it", () => {
	beforeEach(() => { document.body.innerHTML = ""; });

	it("is identified by the region its button controls", () => {
		render(["bolster"]);
		expect(MoveDisclosure.from(toggleFor("bolster")).key).toBe("sheet-1-move-homefront-bolster");
	});

	it("sets a state outright, rather than only flipping it", () => {
		render(["bolster"]);
		const d = MoveDisclosure.from(toggleFor("bolster"));
		d.setOpen(true);
		d.setOpen(true);
		expect(d.isOpen).toBe(true);
		d.setOpen(false);
		expect(d.isOpen).toBe(false);
	});
});
