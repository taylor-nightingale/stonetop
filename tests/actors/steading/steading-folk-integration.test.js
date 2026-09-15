// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createStonetopSteadingSheetClass } from "../../../src/actors/steading/StonetopSteadingSheet.js";
import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";
import { SteadingData } from "../../../src/data/SteadingData.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";
import { stonetopActorSheetBase } from "../../fakes/foundry/stonetopActorSheetBase.js";
import { steadingRepos, FakeSteadingArtRepository } from "../../fakes/FakeSteadingRepos.js";
import { renderTemplate } from "../../fakes/renderTemplate.js";
import { renderSheetPart } from "../../fakes/renderSheetPart.js";

const STEADING_TEMPLATE = "systems/stonetop/templates/actor/steading.hbs";

/**
 * The Folk tab end to end, with only Foundry faked: the real sheet, the real template and its real
 * partials, the real Folk roster, FolkSuggestions, RosterFocus and RosterFilter.
 *
 * Every claim the tab makes is a claim about wiring — that a click in the reference column reaches
 * the row the caret is on, that the search narrows the roster and not the lists beside it, that the
 * caret and the query survive the render every edit causes. A unit test over a mocked roster would
 * prove each piece works and miss whether the sheet ever calls it, which is the failure this file
 * exists to catch.
 */
function makeSheet(id = "steading-1", existingActor = null) {
	const actor = existingActor ?? new FakeSteadingBuilder().build();
	actor.typedActor ??= new StonetopSteading(actor, steadingRepos());
	const sheet = new (createStonetopSteadingSheetClass(stonetopActorSheetBase()))(actor);
	sheet.id = id;
	sheet.isEditable = true;
	// In the document, as a rendered sheet is: focus and delegated listeners need a live tree.
	document.body.append(sheet.element);
	return sheet;
}

/** One render of the sheet, in the order a real one happens. */
async function render(sheet, first = false) {
	return renderSheetPart(sheet, renderTemplate(STEADING_TEMPLATE, await sheet._prepareContext({})), { first });
}

const rows      = root => [...root.querySelectorAll(".steading-folk-row")];
const visible   = root => rows(root).filter(r => !r.hidden);
const nameOf    = row => row.querySelector(".stonetop-person-name").value;
const traitsOf  = row => row.querySelector(".stonetop-person-traits").value;
const homeOf    = row => row.querySelector(".stonetop-person-home").value;
const entries   = root => [...root.querySelectorAll(".steading-folk-entry")];
const entryFor  = (root, value) => entries(root).find(e => e.dataset.value === value);

const act = (sheet, name, target) =>
	sheet.constructor.DEFAULT_OPTIONS.actions[name].call(sheet, { type: "click", preventDefault() {} }, target);

/** Put the caret in a row, the way typing in it does. */
function focusRow(sheet, root, id) {
	root.querySelector(`.steading-folk-row[data-id="${id}"] .stonetop-person-name`)
		.dispatchEvent(new Event("focusin", { bubbles: true }));
}

/** Type into one of a row's cells and commit it, as leaving the field does. */
async function type(root, selector, value) {
	const field = root.querySelector(selector);
	field.value = value;
	field.dispatchEvent(new Event("change", { bubbles: true }));
	await Promise.resolve();
}

function search(sheet, root, query) {
	const box = root.querySelector(".steading-folk-search");
	box.value = query;
	box.dispatchEvent(new Event("input", { bubbles: true }));
}

beforeEach(() => { document.body.innerHTML = ""; });
afterEach(() => vi.unstubAllGlobals());

describe("one roster (integration)", () => {
	// The merge, from the far side: a world whose residents and neighbours were two arrays arrives
	// through the shape heal as one table, with the Home column carrying what used to be the split.
	it("renders residents and neighbours as one table, Home telling them apart", async () => {
		const actor = new FakeSteadingBuilder().build();
		actor.system = SteadingData.migrateData({
			...actor.system,
			folk: undefined,
			residentPeople: [{ id: "r1", name: "Bryn", occupation: "publican" }],
			neighborPeople: [{ id: "n1", name: "Seadha", occupation: "trader", home: "Marshedge" }],
		});
		const root = await render(makeSheet("steading-1", actor));

		expect(rows(root).map(nameOf)).toEqual(["Bryn", "Seadha"]);
		expect(rows(root).map(homeOf)).toEqual(["", "Marshedge"]);
	});

	it("adds a villager through the roster's own control", async () => {
		const sheet = makeSheet();
		await act(sheet, "addPerson", null);
		expect(rows(await render(sheet))).toHaveLength(1);
	});

	// The plate is threaded snapshot → tab → roster partial, and every link in that chain is a name
	// that can be renamed without anything failing: the art would simply stop being drawn. Asserted
	// through a real render for exactly that reason.
	it("closes the roster with the book's villagers when the art store has them", async () => {
		const actor = new FakeSteadingBuilder().build();
		actor.typedActor = new StonetopSteading(actor, steadingRepos({
			art: new FakeSteadingArtRepository({ residents: "stonetop-art/steading/residents.png" }),
		}));
		const root = await render(makeSheet("steading-art", actor));

		expect(root.querySelector(".steading-folk-plate img")?.getAttribute("src"))
			.toBe("stonetop-art/steading/residents.png");
	});

	// The art store is populated from the reader's own books, so no art at all is an ordinary world —
	// and a linked path that is not there 404s on every render.
	it("draws no plate in a world that has never installed the art", async () => {
		const root = await render(makeSheet());
		expect(root.querySelector(".steading-folk-plate")).toBeNull();
	});
});

describe("scan, then click (integration)", () => {
	it("replaces the focused row's name with the name clicked in the rail", async () => {
		const sheet = makeSheet();
		await act(sheet, "addPerson", null);
		const root = await render(sheet, true);
		const { id } = rows(root)[0].dataset;

		focusRow(sheet, root, id);
		await act(sheet, "useName", entryFor(root, "Cadoc"));

		expect(nameOf(rows(await render(sheet))[0])).toBe("Cadoc");
	});

	// The gesture session zero actually runs on: read down the list, click, and the villager exists.
	it("creates a villager from a name when no row is focused", async () => {
		const sheet = makeSheet();
		const root = await render(sheet, true);

		await act(sheet, "useName", entryFor(root, "Eirlys"));

		const after = rows(await render(sheet));
		expect(after).toHaveLength(1);
		expect(nameOf(after[0])).toBe("Eirlys");
	});

	// …and the caret follows the villager it just made, so the next trait clicked lands on them.
	it("points the caret at the villager it just created", async () => {
		const sheet = makeSheet();
		const root = await render(sheet, true);
		await act(sheet, "useName", entryFor(root, "Eirlys"));

		const next = await render(sheet);
		await act(sheet, "useTrait", entryFor(next, "cheery"));

		expect(traitsOf(rows(await render(sheet))[0])).toBe("cheery");
	});

	it("appends each trait clicked to the focused row, comma-separated", async () => {
		const sheet = makeSheet();
		await act(sheet, "addPerson", null);
		const root = await render(sheet, true);
		focusRow(sheet, root, rows(root)[0].dataset.id);

		await act(sheet, "useTrait", entryFor(root, "cheery"));
		const next = await render(sheet);
		await act(sheet, "useTrait", entryFor(next, "curious"));

		expect(traitsOf(rows(await render(sheet))[0])).toBe("cheery, curious");
	});

	// Only names create. A trait has nowhere to go without a row, so it says so rather than
	// inventing a nameless villager the NPC-actor sync would then skip.
	it("writes nothing when a trait is clicked with no row focused", async () => {
		const info = vi.fn();
		vi.stubGlobal("ui", { notifications: { info } });
		const sheet = makeSheet();
		const root = await render(sheet, true);

		await act(sheet, "useTrait", entryFor(root, "cheery"));

		expect(rows(await render(sheet))).toHaveLength(0);
		expect(info).toHaveBeenCalledOnce();
	});

	it("dims what this steading already uses, without dropping it from the list", async () => {
		const sheet = makeSheet();
		const root = await render(sheet, true);
		await act(sheet, "useName", entryFor(root, "Bryn"));

		const next = await render(sheet);

		expect(entryFor(next, "Bryn"), "the used name left the list").toBeTruthy();
		expect(entryFor(next, "Bryn").classList.contains("is-used")).toBe(true);
		expect(entryFor(next, "Cadoc").classList.contains("is-used")).toBe(false);
	});

	/**
	 * The same dimming, reached the way most rows are actually filled in: by typing.
	 *
	 * A roster built by hand never went through the reference lists, so nothing about it is in the
	 * lists' spelling — the traits are separated by whatever read well at the table, which is
	 * usually not commas. Detection is computed on every render out of what the row says, which is
	 * also why a world full of rows typed months ago starts dimming the moment this tab next draws.
	 */
	it("dims traits typed into the row by hand, however they were separated", async () => {
		const sheet = makeSheet();
		let root = await render(sheet, true);
		await act(sheet, "addPerson", root.querySelector(".steading-folk-add"));
		root = await render(sheet);

		await type(root, ".stonetop-person-traits", "Cheery; mute, all thumbs — eagle eye");

		const next = await render(sheet);
		for (const trait of ["cheery", "mute", "all thumbs", "eagle-eye"]) {
			expect(entryFor(next, trait).classList.contains("is-used"), trait).toBe(true);
		}
		expect(entryFor(next, "drunkard").classList.contains("is-used")).toBe(false);
	});

	it("dims a trait written into a sentence", async () => {
		const sheet = makeSheet();
		let root = await render(sheet, true);
		await act(sheet, "addPerson", root.querySelector(".steading-folk-add"));
		root = await render(sheet);

		await type(root, ".stonetop-person-traits", "a cheery sort who knows all the gossip");

		const next = await render(sheet);
		expect(entryFor(next, "knows all the gossip").classList.contains("is-used")).toBe(true);
	});

	it("dims a name typed into the row by hand", async () => {
		const sheet = makeSheet();
		let root = await render(sheet, true);
		await act(sheet, "addPerson", root.querySelector(".steading-folk-add"));
		root = await render(sheet);

		await type(root, ".stonetop-person-name", "bryn (she/her)");

		const next = await render(sheet);
		expect(entryFor(next, "Bryn").classList.contains("is-used")).toBe(true);
		expect(entryFor(next, "Cadoc").classList.contains("is-used")).toBe(false);
	});

	// The reference lists are the steading's own names AND every neighbouring place's.
	it("offers a neighbouring place's names too, under its own heading", async () => {
		const root = await render(makeSheet(), true);
		const titles = [...root.querySelectorAll(".steading-folk-list-title")].map(t => t.textContent.trim());

		expect(titles).toContain("Names — Marshedge");
		expect(entryFor(root, "Seadha")).toBeTruthy();
	});

	// A name off a neighbouring place's list says two things at once — who this is and where they
	// are from — so the Home column is filled by the same click.
	it("homes a villager created from a neighbouring place's name at that place", async () => {
		const sheet = makeSheet();
		const root = await render(sheet, true);

		await act(sheet, "useName", entryFor(root, "Seadha"));

		expect(homeOf(rows(await render(sheet))[0])).toBe("Marshedge");
	});

	it("homes the focused row at the place a name was taken from", async () => {
		const sheet = makeSheet();
		await act(sheet, "addPerson", null);
		const root = await render(sheet, true);
		focusRow(sheet, root, rows(root)[0].dataset.id);

		await act(sheet, "useName", entryFor(root, "Seadha"));

		expect(homeOf(rows(await render(sheet))[0])).toBe("Marshedge");
	});

	// A default, never a correction: the steading's own names leave the Home column blank, which is
	// what says "lives here".
	it("leaves the home blank for a name off the steading's own list", async () => {
		const sheet = makeSheet();
		const root = await render(sheet, true);

		await act(sheet, "useName", entryFor(root, "Bryn"));

		expect(homeOf(rows(await render(sheet))[0])).toBe("");
	});

	it("does not move somebody the table has already placed", async () => {
		const sheet = makeSheet();
		await act(sheet, "addPerson", null);
		const root = await render(sheet, true);
		const { id } = rows(root)[0].dataset;
		await sheet.actor.typedActor.updatePersonHome(id, "Lygos");

		const next = await render(sheet);
		focusRow(sheet, next, id);
		await act(sheet, "useName", entryFor(next, "Seadha"));

		const after = rows(await render(sheet))[0];
		expect(nameOf(after)).toBe("Seadha");
		expect(homeOf(after)).toBe("Lygos");
	});
});

// Six or seven name pools is a column several screens long, and all but one of them are places most
// villagers are not from.
describe("folding a name list away (integration)", () => {
	const listToggles = root => [...root.querySelectorAll(".steading-folk-list-toggle")];
	const listBody    = toggle => document.getElementById(toggle.getAttribute("aria-controls"));
	// The list this toggle drives, as FolkSuggestions keys it: "names-own", "names-lygos", "traits".
	const keyOf       = toggle => toggle.getAttribute("aria-controls").replace(/^.*-folk-/, "");
	const isOpen      = toggle => !listBody(toggle).hidden;
	const toggleFor   = (root, key) => listToggles(root).find(t => keyOf(t) === key);

	it("arrives with the steading's own names open and each neighbour's folded", async () => {
		const root = await render(makeSheet(), true);
		const toggles = listToggles(root);
		expect(toggles.length, "the fixture has only one list to compare").toBeGreaterThan(1);

		for (const toggle of toggles) {
			const shouldBeOpen = keyOf(toggle) === "names-own" || keyOf(toggle) === "traits";
			expect(isOpen(toggle), `${keyOf(toggle)} arrived ${shouldBeOpen ? "shut" : "open"}`)
				.toBe(shouldBeOpen);
			// The two halves of a disclosure's state have to agree, or a screen reader and the page
			// are describing different columns.
			expect(toggle.getAttribute("aria-expanded")).toBe(String(shouldBeOpen));
		}
	});

	it("folds one list away without touching the others", async () => {
		const sheet = makeSheet();
		const root = await render(sheet, true);
		const own = toggleFor(root, "names-own");
		const others = listToggles(root).filter(t => t !== own);

		await act(sheet, "toggleFolkList", own);

		expect(listBody(own).hidden).toBe(true);
		expect(own.getAttribute("aria-expanded")).toBe("false");
		for (const other of others) {
			expect(isOpen(other), `folding the steading's own names moved ${keyOf(other)}`)
				.toBe(keyOf(other) === "traits");
		}
	});

	// The other direction: a place the reader opens is a place they meant to open, and it has to
	// still be open after the render the next click causes.
	it("keeps a neighbour's list open once the reader unfolds it", async () => {
		const sheet = makeSheet();
		const root = await render(sheet, true);
		const neighbour = listToggles(root).find(t => keyOf(t).startsWith("names-") && keyOf(t) !== "names-own");
		expect(neighbour, "the fixture seeds no neighbouring place").toBeTruthy();

		await act(sheet, "toggleFolkList", neighbour);
		expect(isOpen(neighbour)).toBe(true);

		const next = await render(sheet);
		expect(isOpen(toggleFor(next, keyOf(neighbour))), "the unfold did not survive the render").toBe(true);
	});

	// Clicking a name writes to the actor, which re-renders the sheet — so a fold that did not
	// survive a render would spring open again on the very next thing the reader did.
	it("stays folded across the render an edit causes", async () => {
		const sheet = makeSheet();
		const root = await render(sheet, true);
		const folded = listToggles(root)[0];
		await act(sheet, "toggleFolkList", folded);

		const next = await render(sheet);
		const again = listToggles(next)[0];

		expect(listBody(again).hidden, "the fold did not survive the render").toBe(true);
		expect(again.getAttribute("aria-expanded")).toBe("false");
	});

	it("unfolds again on a second activation", async () => {
		const sheet = makeSheet();
		const root = await render(sheet, true);
		const toggle = listToggles(root)[0];

		await act(sheet, "toggleFolkList", toggle);
		await act(sheet, "toggleFolkList", toggle);

		const next = await render(sheet);
		expect(listBody(listToggles(next)[0]).hidden).toBe(false);
	});
});

describe("the search (integration)", () => {
	async function withRoster() {
		const sheet = makeSheet();
		const s = sheet.actor.typedActor;
		const bryn = await s.addPersonNamed("Bryn");
		await s.updatePersonOccupation(bryn.id, "publican");
		const cadoc = await s.addPersonNamed("Cadoc");
		await s.updatePersonOccupation(cadoc.id, "smith");
		return { sheet, root: await render(sheet, true) };
	}

	it("narrows the roster to the rows that answer it", async () => {
		const { sheet, root } = await withRoster();
		search(sheet, root, "smith");
		expect(visible(root).map(nameOf)).toEqual(["Cadoc"]);
	});

	// The whole point: reading down the name and trait lists is how an NPC gets made, so narrowing
	// the roster must never narrow them.
	it("leaves every reference entry in place", async () => {
		const { sheet, root } = await withRoster();
		const before = entries(root).length;

		search(sheet, root, "smith");

		expect(entries(root).filter(e => !e.hidden)).toHaveLength(before);
	});

	it("brings the rows back when the box is cleared", async () => {
		const { sheet, root } = await withRoster();
		search(sheet, root, "smith");
		search(sheet, root, "");
		expect(visible(root)).toHaveLength(2);
	});
});

describe("what survives a re-render (integration)", () => {
	// Every edit anywhere on the sheet causes one — a pip ticked, another player's change arriving
	// over the socket — and the template renders the search box empty and no caret.
	it("keeps the caret on the row the reader was editing", async () => {
		const sheet = makeSheet();
		await act(sheet, "addPerson", null);
		await act(sheet, "addPerson", null);
		const root = await render(sheet, true);
		const second = rows(root)[1].dataset.id;
		focusRow(sheet, root, second);

		const next = await render(sheet);

		expect(next.querySelector(".steading-folk-row.is-focused").dataset.id).toBe(second);
		expect(next.querySelector(`.steading-folk-row[data-id="${second}"]`).getAttribute("aria-current")).toBe("true");
	});

	it("keeps the query in the box, and the rows it excluded hidden", async () => {
		const sheet = makeSheet();
		const s = sheet.actor.typedActor;
		await s.addPersonNamed("Bryn");
		await s.addPersonNamed("Cadoc");
		const root = await render(sheet, true);
		search(sheet, root, "bryn");

		const next = await render(sheet);

		expect(next.querySelector(".steading-folk-search").value).toBe("bryn");
		expect(visible(next).map(nameOf)).toEqual(["Bryn"]);
	});

	// Which row you are editing and what you have typed into a search box are facts about YOU.
	it("reaches no other sheet on the same steading, and writes nothing to the actor", async () => {
		const sheet = makeSheet();
		await act(sheet, "addPerson", null);
		const root = await render(sheet, true);
		const before = JSON.stringify(sheet.actor.system);
		focusRow(sheet, root, rows(root)[0].dataset.id);
		search(sheet, root, "bryn");

		const otherRoot = await render(makeSheet("steading-2", sheet.actor), true);

		expect(otherRoot.querySelector(".steading-folk-row.is-focused"), "one reader's caret moved another's").toBeNull();
		expect(otherRoot.querySelector(".steading-folk-search").value).toBe("");
		expect(JSON.stringify(sheet.actor.system), "focusing or searching wrote to the steading").toBe(before);
	});

	// Adding gives up the caret, so the next name clicked creates someone rather than renaming the
	// villager who happened to be last edited.
	it("gives up the caret when a new villager is added", async () => {
		const sheet = makeSheet();
		await act(sheet, "addPerson", null);
		const root = await render(sheet, true);
		focusRow(sheet, root, rows(root)[0].dataset.id);

		await act(sheet, "addPerson", null);
		const next = await render(sheet);
		await act(sheet, "useName", entryFor(next, "Cadoc"));

		const after = rows(await render(sheet));
		expect(after, "the name renamed a row instead of creating one").toHaveLength(3);
		expect(nameOf(after[2])).toBe("Cadoc");
	});
});

// Step 4 rides on the same tab machinery: an asset carries whether it is out, and the Assets heading
// says how many are — which is the thing the table forgets every single time.
describe("requisitioned assets (integration)", () => {
	const assetRows = root => [...root.querySelectorAll(".steading-asset-row")];
	// Scoped to the ASSETS block by the one control only it stamps: the content lists render the same
	// heading partial, and a note on one of those would otherwise answer for this one.
	const headingNote = root =>
		root.querySelector(".stonetop-asset-item-add")?.closest(".steading-overview-field")
			?.querySelector(".stonetop-section-note")?.textContent.trim() ?? "";

	it("says nothing in the heading while everything is at home", async () => {
		const root = await render(makeSheet(), true);
		expect(assetRows(root).length).toBeGreaterThan(0);
		expect(headingNote(root)).toBe("");
	});

	it("counts what is out, in the heading beside the list", async () => {
		const sheet = makeSheet();
		await sheet.actor.typedActor.setAssetRequisitioned(0, true);
		await sheet.actor.typedActor.setAssetRequisitioned(3, true);

		const root = await render(sheet, true);

		expect(headingNote(root)).toBe("2 out");
		expect(assetRows(root)[0].classList.contains("is-requisitioned")).toBe(true);
		expect(assetRows(root)[1].classList.contains("is-requisitioned")).toBe(false);
	});

	// Stated in words on the row, not by a colour or a tick alone — the render harness resolves a
	// key-only localize to its key, so these are the two distinct strings the sheet asks for.
	it("marks the row's own state in words, not by colour alone", async () => {
		const sheet = makeSheet();
		await sheet.actor.typedActor.setAssetRequisitioned(0, true);
		const root = await render(sheet, true);

		const [out, home] = assetRows(root).map(r => r.querySelector(".steading-asset-state span").textContent);
		expect(out).toBe("stonetop.steading.lists.assetOut");
		expect(home).toBe("stonetop.steading.lists.assetHome");
	});

	it("ticks the box for an asset that is out, and only that one", async () => {
		const sheet = makeSheet();
		await sheet.actor.typedActor.setAssetRequisitioned(0, true);
		const root = await render(sheet, true);

		const boxes = assetRows(root).map(r => r.querySelector("[data-change-action='assetRequisitioned']").checked);
		expect(boxes).toEqual([true, false, false, false]);
	});
});
