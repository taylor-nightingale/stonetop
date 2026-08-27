// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createStonetopSteadingSheetClass } from "../../../src/actors/steading/StonetopSteadingSheet.js";
import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";
import { stonetopActorSheetBase } from "../../fakes/foundry/stonetopActorSheetBase.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";
import { steadingRepos } from "../../fakes/FakeSteadingRepos.js";
import { fire, settle } from "../../fakes/domEvents.js";
import { warn } from "../../../src/utils/logger.js";

vi.mock("../../../src/utils/logger.js", () => ({ warn: vi.fn(), log: vi.fn(), error: vi.fn() }));

// End-to-end for the steading's control wiring, against a REAL StonetopSteading.
//
// The sheet used to bind ~35 controls per render by CSS class; they are now addressed by the
// `data-action` / `data-change-action` the templates stamp. That rewiring is exactly the kind of
// thing unit tests with a spy steading cannot vouch for — a handler can be registered under a name
// nothing emits, or emit a name nothing handles, and every spy-level test still passes. So this
// drives each control through the router down to actor state.
//
// Nothing renders .hbs here (Foundry compiles the templates), so the markup below mirrors what the
// partials stamp; steadingChangeHandlers.test.js guards that the two agree.

const StonetopSteadingSheet = createStonetopSteadingSheetClass(stonetopActorSheetBase());

async function makeWiredSheet({ editable = true } = {}) {
	const actor = new FakeSteadingBuilder()
		.withTypedActor(a => new StonetopSteading(a, steadingRepos({
			improvements: { getBySlug: async () => null },
			moves: new FakeMoveRepository(),
		})))
		.build();

	const sheet = new StonetopSteadingSheet(actor);
	sheet.isEditable = editable;
	await sheet._onFirstRender({}, {});
	return { sheet, actor, steading: actor.typedActor };
}

async function fireChange(sheet, html, selector) {
	sheet.element.innerHTML = html;
	fire(sheet.element.querySelector(selector), "change");
	await settle();
}

async function fireAction(sheet, name, html, selector, ev = { type: "click", button: 0 }) {
	sheet.element.innerHTML = html;
	const def = StonetopSteadingSheet.DEFAULT_OPTIONS.actions[name];
	const handler = typeof def === "function" ? def : def.handler;
	await handler.call(sheet, { preventDefault() {}, ...ev }, sheet.element.querySelector(selector));
	await settle();
}

beforeEach(() => { document.body.innerHTML = ""; warn.mockClear(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("steading sheet wiring — overview fields (integration)", () => {
	it("persists fortunes through the router", async () => {
		const { sheet, actor } = await makeWiredSheet();

		await fireChange(sheet,
			`<input data-change-action="fortunes" name="stonetop-fortunes" value="3">`, "input");

		expect(actor.system.attributes.fortunes).toBe(3);
	});

	it("persists surplus, treating a blank as zero", async () => {
		const { sheet, actor } = await makeWiredSheet();

		await fireChange(sheet, `<input data-change-action="surplus" value="">`, "input");

		expect(actor.system.attributes.surplus).toBe(0);
	});

	// Ratings store a number; size stores its tier string. Both go through the one `attribute` action.
	it("stores a rating as a number and size as its tier string", async () => {
		const { sheet, actor } = await makeWiredSheet();

		await fireChange(sheet, `<input data-change-action="attribute" data-attr="population" value="4">`, "input");
		expect(actor.system.attributes.population).toBe(4);

		await fireChange(sheet, `<input data-change-action="attribute" data-attr="size" value="town">`, "input");
		expect(actor.system.attributes.size).toBe("town");
	});

	it("persists the notes textarea", async () => {
		const { sheet, actor } = await makeWiredSheet();

		await fireChange(sheet, `<textarea data-change-action="notes">a quiet season</textarea>`, "textarea");

		expect(actor.system.notes).toBe("a quiet season");
	});
});

describe("steading sheet wiring — residents (integration)", () => {
	it("adds a resident, then renames it by its row id", async () => {
		const { sheet, actor, steading } = await makeWiredSheet();

		await fireAction(sheet, "addResident", `<button data-action="addResident"></button>`, "button");
		const [resident] = actor.system.residentPeople;
		expect(resident).toBeDefined();

		await fireChange(sheet,
			`<input data-change-action="residentName" data-id="${resident.id}" value="Cerdig">`, "input");

		expect(actor.system.residentPeople[0].name).toBe("Cerdig");
		expect(actor.system.residentPeople[0].id).toBe(resident.id); // renamed in place, not replaced
	});

	it("removes a resident on a confirmed click", async () => {
		vi.stubGlobal("foundry", { ...globalThis.foundry,
			applications: { ...globalThis.foundry?.applications,
				api: { DialogV2: { confirm: async () => true } } } });
		const { sheet, actor } = await makeWiredSheet();
		await fireAction(sheet, "addResident", `<button data-action="addResident"></button>`, "button");
		const { id } = actor.system.residentPeople[0];

		await fireAction(sheet, "removeResident",
			`<button data-action="removeResident" data-id="${id}" data-name="Cerdig"></button>`, "button");

		expect(actor.system.residentPeople).toHaveLength(0);
	});

	it("keeps the resident when the confirmation is declined", async () => {
		vi.stubGlobal("foundry", { ...globalThis.foundry,
			applications: { ...globalThis.foundry?.applications,
				api: { DialogV2: { confirm: async () => false } } } });
		const { sheet, actor } = await makeWiredSheet();
		await fireAction(sheet, "addResident", `<button data-action="addResident"></button>`, "button");
		const { id } = actor.system.residentPeople[0];

		await fireAction(sheet, "removeResident",
			`<button data-action="removeResident" data-id="${id}" data-name="Cerdig"></button>`, "button");

		expect(actor.system.residentPeople).toHaveLength(1);
	});

	// The right-click escape hatch must not ask at all.
	it("removes without asking on a right-click", async () => {
		const confirm = vi.fn(async () => true);
		vi.stubGlobal("foundry", { ...globalThis.foundry,
			applications: { ...globalThis.foundry?.applications, api: { DialogV2: { confirm } } } });
		const { sheet, actor } = await makeWiredSheet();
		await fireAction(sheet, "addResident", `<button data-action="addResident"></button>`, "button");
		const { id } = actor.system.residentPeople[0];

		await fireAction(sheet, "removeResident",
			`<button data-action="removeResident" data-id="${id}" data-name="Cerdig"></button>`, "button",
			{ type: "contextmenu", button: 2 });

		expect(confirm).not.toHaveBeenCalled();
		expect(actor.system.residentPeople).toHaveLength(0);
	});
});

describe("steading sheet wiring — neighbors, assets, places (integration)", () => {
	it("adds a neighbor and edits its home", async () => {
		const { sheet, actor } = await makeWiredSheet();

		await fireAction(sheet, "addNeighbor", `<button data-action="addNeighbor"></button>`, "button");
		const { id } = actor.system.neighborPeople[0];

		await fireChange(sheet,
			`<input data-change-action="neighborHome" data-id="${id}" value="Marshedge">`, "input");

		expect(actor.system.neighborPeople[0].home).toBe("Marshedge");
	});

	it("adds an asset item and edits it by index", async () => {
		const { sheet, actor } = await makeWiredSheet();
		const before = actor.system.assets.items.length;

		await fireAction(sheet, "addAssetItem", `<button data-action="addAssetItem"></button>`, "button");
		expect(actor.system.assets.items).toHaveLength(before + 1);

		await fireChange(sheet,
			`<input data-change-action="assetItem" data-index="${before}" value="a good well">`, "input");

		expect(actor.system.assets.items[before]).toBe("a good well");
	});

	// Coinage is addressed by title, and an update re-appends the entry rather than replacing it in
	// place — so assert by title, never by index.
	it("persists coinage by currency title", async () => {
		const { sheet, actor } = await makeWiredSheet();
		const { title } = actor.system.assets.coinage[0];

		await fireChange(sheet,
			`<input data-change-action="coinagePurses" data-title="${title}" value="2">`, "input");

		const stored = actor.system.assets.coinage.find(c => c.title === title);
		expect(stored.purses).toBe(2);
	});

	it("edits a place of interest by index", async () => {
		const { sheet, actor } = await makeWiredSheet();

		await fireChange(sheet,
			`<input data-change-action="placeField" data-index="0" value="The Old Mill">`, "input");

		expect(actor.system.placesOfInterest[0].name).toBe("The Old Mill");
	});
});

// Unlinking keeps the row and drops only its `@UUID` link, but a mis-aimed ✕ still loses work the
// player did by dragging a document in, so it asks like the deletes do.
describe("steading sheet wiring — unlinking (integration)", () => {
	function stubDialog(result) {
		const confirm = vi.fn(async () => result);
		vi.stubGlobal("foundry", { ...globalThis.foundry,
			applications: { ...globalThis.foundry?.applications, api: { DialogV2: { confirm } } } });
		return confirm;
	}

	async function linkedResident() {
		const wired = await makeWiredSheet();
		await fireAction(wired.sheet, "addResident", `<button data-action="addResident"></button>`, "button");
		const { id } = wired.actor.system.residentPeople[0];
		await wired.steading.updateResidentName(id, "Cerdig");
		await wired.steading.linkResident(id, "Actor.cerdig");
		return { ...wired, id };
	}

	const unlinkButton = id =>
		`<button data-action="unlinkResident" data-id="${id}" data-name="Cerdig"></button>`;

	it("drops the link on a confirmed click, keeping the row", async () => {
		stubDialog(true);
		const { sheet, actor, id } = await linkedResident();

		await fireAction(sheet, "unlinkResident", unlinkButton(id), "button");

		expect(actor.system.residentPeople).toHaveLength(1);
		expect(actor.system.residentPeople[0].name).toBe("Cerdig");
		expect(actor.system.residentPeople[0].linkUuid).toBeFalsy();
	});

	it("keeps the link when the confirmation is declined", async () => {
		stubDialog(false);
		const { sheet, actor, id } = await linkedResident();

		await fireAction(sheet, "unlinkResident", unlinkButton(id), "button");

		expect(actor.system.residentPeople[0].linkUuid).toBe("Actor.cerdig");
	});

	it("unlinks without asking on a right-click", async () => {
		const confirm = stubDialog(true);
		const { sheet, actor, id } = await linkedResident();

		await fireAction(sheet, "unlinkResident", unlinkButton(id), "button",
			{ type: "contextmenu", button: 2 });

		expect(confirm).not.toHaveBeenCalled();
		expect(actor.system.residentPeople[0].linkUuid).toBeFalsy();
	});

	it("asks before unlinking a neighbor too", async () => {
		stubDialog(false);
		const { sheet, actor, steading } = await makeWiredSheet();
		await fireAction(sheet, "addNeighbor", `<button data-action="addNeighbor"></button>`, "button");
		const { id } = actor.system.neighborPeople[0];
		await steading.linkNeighbor(id, "Actor.brennan");

		await fireAction(sheet, "unlinkNeighbor",
			`<button data-action="unlinkNeighbor" data-id="${id}" data-name="Brennan"></button>`, "button");

		expect(actor.system.neighborPeople[0].linkUuid).toBe("Actor.brennan");
	});

	it("asks before unlinking a place of interest too", async () => {
		stubDialog(true);
		const { sheet, actor, steading } = await makeWiredSheet();
		await steading.linkPlace(0, "JournalEntry.mill");

		await fireAction(sheet, "unlinkPlace",
			`<button data-action="unlinkPlace" data-index="0" data-name="The Old Mill"></button>`, "button");

		expect(actor.system.placesOfInterest[0].linkUuid).toBe("");
	});
});

describe("steading sheet wiring — the router itself (integration)", () => {
	// The whole point of the migration: a name stamped in a template with no handler behind it is
	// silent in play except for this warning. Nothing the sheet legitimately emits may trigger it.
	it("routes every stamped control without reporting template drift", async () => {
		const { sheet } = await makeWiredSheet();

		sheet.element.innerHTML = `
			<input data-change-action="fortunes" value="2">
			<input data-change-action="surplus" value="1">
			<input data-change-action="attribute" data-attr="population" value="3">
			<textarea data-change-action="notes">x</textarea>
			<input data-change-action="rollMode" value="adv">
			<input data-change-action="contentText" data-type="history" value="y">
			<input type="checkbox" data-change-action="debility" data-slug="hungry">
			<input data-change-action="residentTraitsSource" value="gruff">`;
		for (const el of sheet.element.querySelectorAll("[data-change-action]")) fire(el, "change");
		await settle();

		expect(warn).not.toHaveBeenCalled();
	});

	// The choice rows share the root with the router but belong to ChoiceGroupWiring.
	it("stays silent on the choice-group rows it does not own", async () => {
		const { sheet } = await makeWiredSheet();

		sheet.element.innerHTML = `<input type="checkbox" data-change-action="cgTrack"
			data-cg-context="improvement" data-cg-group="fortifications" data-cg-option="palisade"
			data-cg-index="0">`;
		fire(sheet.element.querySelector("input"), "change");
		await settle();

		expect(warn).not.toHaveBeenCalled();
	});

	it("writes nothing at all while the sheet is not editable", async () => {
		const { sheet, actor } = await makeWiredSheet({ editable: false });
		const before = actor.system.attributes.fortunes;

		await fireChange(sheet,
			`<input data-change-action="fortunes" name="stonetop-fortunes" value="3">`, "input");

		expect(actor.system.attributes.fortunes).toBe(before);
	});
});
