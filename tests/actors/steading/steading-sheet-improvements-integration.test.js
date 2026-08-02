// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { createStonetopSteadingSheetClass } from "../../../src/actors/steading/StonetopSteadingSheet.js";
import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";
import { FakeCoreActorSheetBase } from "../../fakes/foundry/FakeCoreActorSheetBase.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";
import { FakeSteadingImprovementRepository } from "../../fakes/FakeSteadingImprovementRepository.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";

// End-to-end for gaining and losing an improvement in play: a real StonetopSteading + SteadingImprovements
// + the real confirm-delete gate, behind the sheet's own V2 lifecycle. Only the Foundry boundary is
// faked (core's drop pipeline, the improvement catalog, the confirm dialog).
//
// The load-bearing claim is that a dropped improvement becomes a SLUG in system.improvements and is
// never embedded as an item: an embedded improvement would look accepted (it lands in the actor's item
// collection) while the improvements tab, which renders from slugs, showed nothing at all.

const StonetopSteadingSheet = createStonetopSteadingSheetClass(FakeCoreActorSheetBase);

const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));

// The handlers are async and the drop hooks are fired without awaiting; flush before asserting.
const settle = () => new Promise(r => setTimeout(r));

// Track state lives per improvement, so the catalog entries need a real trackable row.
const trackRow = (slug, title) => ({
	slug,
	list: [{ type: "entry", slug: "built", content: { title, text: "" }, track: { max: 2 } }],
});

const catalog = () => new FakeSteadingImprovementRepository()
	.withImprovement("palisade", trackRow("palisade", "Palisade"))
	.withImprovement("aetherium-crucible", trackRow("aetherium-crucible", "Aetherium Crucible"));

// The steadfast-granted starting list (FakeSteadingBuilder mirrors applySteadfast(stonetop)) already
// owns "palisade"; "aetherium-crucible" is the Book II wonder improvement gained later.
async function makeWiredSheet({ editable = true } = {}) {
	const actor = new FakeSteadingBuilder()
		.withTypedActor(a => new StonetopSteading(a, catalog(), new FakeMoveRepository()))
		.build();

	const sheet = new StonetopSteadingSheet(actor);
	sheet.isEditable = editable;
	// Mirrors what steading-improvement-panel.hbs emits for one owned improvement. The
	// "template ↔ handler contract" tests below keep this stub honest about the real markup.
	sheet.element.innerHTML = `
		<div class="steading-improvement-group steading-panel-frame">
			<button type="button" class="steading-improvement-remove stonetop-icon-btn"
			        data-slug="palisade" data-name="palisade"></button>
		</div>`;
	await sheet._onFirstRender({}, {});
	sheet._onRender({}, {});
	return { sheet, actor, improvements: actor.typedActor.improvements };
}

// An improvement item as core hands it to the sheet: a resolved Document, hence documentName.
const improvementItem = (slug, name) => ({
	documentName: "Item", type: "improvement", name,
	system: { slug },
	toObject: () => ({ type: "improvement", name, system: { slug } }),
});

async function drop(sheet, item) {
	const event = new Event("drop", { bubbles: true, cancelable: true });
	event._testDroppedItem = item;
	sheet.element.dispatchEvent(event);
	await settle();
}

const ownedSlugs = actor => actor.system.improvements;
const renderedSlugs = async improvements => (await improvements.buildSnapshot()).map(g => g.slug);

describe("StonetopSteadingSheet — dropping an improvement onto a steading", () => {
	it("grants the slug and renders the improvement, without embedding an item", async () => {
		const { sheet, actor, improvements } = await makeWiredSheet();

		await drop(sheet, improvementItem("aetherium-crucible", "Aetherium Crucible"));

		expect(ownedSlugs(actor)).toContain("aetherium-crucible");
		expect(await renderedSlugs(improvements)).toContain("aetherium-crucible");
		expect(actor.items).toHaveLength(0);
	});

	it("appends the new improvement after the ones the steadfast granted", async () => {
		const { sheet, actor } = await makeWiredSheet();
		const granted = [...ownedSlugs(actor)];

		await drop(sheet, improvementItem("aetherium-crucible", "Aetherium Crucible"));

		expect(ownedSlugs(actor)).toEqual([...granted, "aetherium-crucible"]);
	});

	it("writes once per drop — core's pipeline must reach the grant exactly once", async () => {
		const { sheet, actor } = await makeWiredSheet();
		const update = vi.spyOn(actor, "update");

		await drop(sheet, improvementItem("aetherium-crucible", "Aetherium Crucible"));

		// A sheet that wires its own drop listener on top of core's would double-handle and write twice.
		expect(update).toHaveBeenCalledTimes(1);
		expect(update).toHaveBeenCalledWith({ "system.improvements": ownedSlugs(actor) });
	});

	it("re-dropping an improvement it already owns changes nothing and does not re-write", async () => {
		const { sheet, actor } = await makeWiredSheet();
		const before = [...ownedSlugs(actor)];
		const update = vi.spyOn(actor, "update");

		await drop(sheet, improvementItem("palisade", "Palisade"));

		expect(ownedSlugs(actor)).toEqual(before);
		expect(update).not.toHaveBeenCalled();
	});

	// An improvement item with no stored slug can't be resolved back to its content, so there is
	// nothing to grant. It is still reported handled: falling through to core's embed would put an
	// invisible improvement item on the actor, which is strictly worse than a no-op.
	it("swallows an improvement that carries no slug rather than embedding it", async () => {
		const { sheet, actor } = await makeWiredSheet();
		const before = [...ownedSlugs(actor)];

		await drop(sheet, { documentName: "Item", type: "improvement", name: "Unslugged", system: {}, toObject: () => ({}) });

		expect(ownedSlugs(actor)).toEqual(before);
		expect(actor.items).toHaveLength(0);
	});

	it("ignores the drop entirely when the sheet is not editable", async () => {
		const { sheet, actor } = await makeWiredSheet({ editable: false });
		const before = [...ownedSlugs(actor)];

		await drop(sheet, improvementItem("aetherium-crucible", "Aetherium Crucible"));

		expect(ownedSlugs(actor)).toEqual(before);
		expect(actor.items).toHaveLength(0);
	});

	it("still embeds an item type the steading does not claim", async () => {
		const { sheet, actor } = await makeWiredSheet();
		const cart = {
			documentName: "Item", type: "possession", name: "Cart",
			toObject: () => ({ type: "possession", name: "Cart" }),
		};

		await drop(sheet, cart);

		expect(actor.items).toHaveLength(1);
		expect(actor.items[0].name).toBe("Cart");
	});
});

describe("StonetopSteadingSheet — revoking an improvement with the × control", () => {
	let confirmed;
	let confirmCalls;
	let savedApi;

	beforeEach(() => {
		confirmed = true;
		confirmCalls = [];
		savedApi = foundry.applications.api;
		// The real confirmDelete runs; only Foundry's dialog is faked, so the prompt's wording and the
		// undefined-on-dismissal normalisation are exercised rather than mocked away.
		foundry.applications.api = {
			...savedApi,
			DialogV2: { confirm: async config => { confirmCalls.push(config); return confirmed; } },
		};
	});

	afterEach(() => { foundry.applications.api = savedApi; });

	const clickRemove = async sheet => {
		fire(sheet.element.querySelector(".steading-improvement-remove"), "click");
		await settle();
	};

	const rightClickRemove = async sheet => {
		fire(sheet.element.querySelector(".steading-improvement-remove"), "contextmenu");
		await settle();
	};

	it("asks before removing, naming the improvement, then drops it from the owned list", async () => {
		const { sheet, actor, improvements } = await makeWiredSheet();
		expect(ownedSlugs(actor)).toContain("palisade");

		await clickRemove(sheet);

		expect(confirmCalls).toHaveLength(1);
		expect(confirmCalls[0].content).toContain("palisade");
		expect(ownedSlugs(actor)).not.toContain("palisade");
		expect(await renderedSlugs(improvements)).not.toContain("palisade");
	});

	it("keeps the improvement when the confirm is declined", async () => {
		const { sheet, actor } = await makeWiredSheet();
		confirmed = false;

		await clickRemove(sheet);

		expect(confirmCalls).toHaveLength(1);
		expect(ownedSlugs(actor)).toContain("palisade");
	});

	it("right-click revokes immediately, without asking", async () => {
		const { sheet, actor } = await makeWiredSheet();

		await rightClickRemove(sheet);

		expect(confirmCalls).toHaveLength(0);
		expect(ownedSlugs(actor)).not.toContain("palisade");
	});

	it("leaves only the revoked slug behind — the rest of the list is untouched", async () => {
		const { sheet, actor } = await makeWiredSheet();
		const before = [...ownedSlugs(actor)];

		await rightClickRemove(sheet);

		expect(ownedSlugs(actor)).toEqual(before.filter(s => s !== "palisade"));
	});

	// Deliberate: an accidental × costs no progress, and re-granting the improvement restores it —
	// the same terms on which re-applying a steadfast replaces the owned list.
	it("keeps the improvement's track state, so a re-grant restores its ticks", async () => {
		const { sheet, actor, improvements } = await makeWiredSheet();
		await improvements.setTrack("palisade", "built", 2);

		await rightClickRemove(sheet);
		expect(actor.system.improvementValues).toEqual({ palisade: { built: 2 } });

		await improvements.grant("palisade");
		const snap = await improvements.buildSnapshot();
		expect(snap.find(g => g.slug === "palisade").list[0].track.checks).toEqual([true, true]);
	});

	it("does not wire the × on a non-editable sheet", async () => {
		const { sheet, actor } = await makeWiredSheet({ editable: false });

		await rightClickRemove(sheet);
		await clickRemove(sheet);

		expect(confirmCalls).toHaveLength(0);
		expect(ownedSlugs(actor)).toContain("palisade");
	});
});

// The handler above finds its control by selector and reads data-slug off it; the template is what
// actually emits that markup in the game. Nothing renders .hbs in these tests (Foundry compiles the
// templates), so assert the two agree — otherwise renaming the class or the data attribute in one
// file leaves every test above passing against a stub that no longer matches the real sheet.
describe("steading-improvement-panel.hbs ↔ revoke handler contract", () => {
	const read = rel => readFileSync(path.resolve(process.cwd(), rel), "utf8");
	const template = read("templates/actor/partials/steading-improvement-panel.hbs");
	const sheetSource = read("src/actors/steading/StonetopSteadingSheet.js");

	it("emits the control the sheet binds to", () => {
		expect(template).toContain("steading-improvement-remove");
		expect(sheetSource).toContain(".steading-improvement-remove");
	});

	it("passes the improvement's slug as the data the handler reads", () => {
		expect(template).toContain('data-slug="{{slug}}"');
		expect(template).toContain('data-name="{{slug}}"');   // shown in the confirm prompt
	});

	it("renders the control only on an editable sheet", () => {
		expect(template).toMatch(/\{\{#if @root\.editable\}\}[\s\S]*steading-improvement-remove[\s\S]*\{\{\/if\}\}/);
	});

	it("renders each owned improvement through the shared panel partial", () => {
		const steadingTemplate = read("templates/actor/steading.hbs");
		const panelUses = steadingTemplate.match(/stonetop\.steading-improvement-panel/g) ?? [];
		expect(panelUses).toHaveLength(3);   // one per improvement column
	});
});
