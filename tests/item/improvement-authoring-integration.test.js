// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createStonetopImprovementSheetClass } from "../../src/item/StonetopImprovementSheet.js";
import { withViewStateV2 } from "../../src/utils/withViewStateV2.js";
import { SteadingImprovements } from "../../src/actors/steading/SteadingImprovements.js";
import { FoundrySteadingImprovementRepository } from "../../src/actors/steading/repositories/FoundrySteadingImprovementRepository.js";
import { StonetopSteading } from "../../src/actors/steading/StonetopSteading.js";
import { ChoiceTarget } from "../../src/actors/character/ChoiceTarget.js";
import { FakeActorBuilder } from "../fakes/FakeActorBuilder.js";
import { steadingRepos } from "../fakes/FakeSteadingRepos.js";
import { applyDocumentUpdate } from "../fakes/foundry/applyDocumentUpdate.js";
import { renderTemplate } from "../fakes/renderTemplate.js";
import { renderSheetPart } from "../fakes/renderSheetPart.js";

// End to end: a custom improvement authored on its REAL sheet, through its own controls over the REAL
// templates, then owned by a steading that resolves it through the REAL catalog and ticks it through
// the REAL choice wiring. Only Foundry is faked — core's ItemSheetV2, the item document, and the
// game's item and pack lists.
//
// The claim is the bug the sheet was rebuilt for: a custom improvement used to have no rule, read as
// "requires nothing", and so was finished on the steading before a single box was ticked.

const TEMPLATE = "systems/stonetop/templates/item/improvement.hbs";
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

function makeItem() {
	const item = { id: "world-watchtower", name: "Watchtower", img: "x.png", type: "improvement", getRollData: () => ({}),
		system: { slug: "watchtower", choices: { slug: "watchtower", list: [] }, requires: null, effects: [] } };
	item.update = vi.fn(async data => applyDocumentUpdate(item, data));
	// What the world's item store reads: the document as stored.
	item.toObject = () => structuredClone({ _id: item.id, name: item.name, type: item.type, system: item.system });
	return item;
}

class FakeCoreItemSheet {
	constructor(item) {
		this._item = item;
		this.isEditable = true;
		this.id = "sheet";
		this.element = document.createElement("form");
		this.render = vi.fn();
		document.body.appendChild(this.element);
	}
	get item() { return this._item; }
	async _prepareContext() { return {}; }
	async _onFirstRender() {}
	_onRender() {}
	_preSyncPartState() {}
	_syncPartState() {}
}

const Sheet = createStonetopImprovementSheetClass(withViewStateV2(FakeCoreItemSheet));

async function render(sheet, first = false) {
	const context = await sheet._prepareContext({});
	return renderSheetPart(sheet, renderTemplate(TEMPLATE, context), { first });
}

async function press(sheet, target) {
	const action = sheet.constructor.DEFAULT_OPTIONS.actions[target.dataset.action];
	await (action.handler ?? action).call(sheet, new MouseEvent("click", { button: 0 }), target);
	await settle();
}

/** Author a heading over two single-box requirements, through the sheet's own buttons. */
async function authorTwoRequirements(sheet) {
	let root = await render(sheet, true);
	await press(sheet, root.querySelector("[data-action='addHeading']"));
	root = await render(sheet);
	await press(sheet, root.querySelector("[data-action='addRequirementTo']"));
	return render(sheet);
}

function stubGame(worldItems) {
	const empty = { getIndex: async () => {}, index: [], getDocuments: async () => [], folders: [] };
	vi.stubGlobal("game", { ...globalThis.game, packs: { get: () => empty }, items: { contents: worldItems } });
}

/** A steading that owns the improvement, read through a fresh catalog — the catalog caches. */
function steadingOwning(item, actor) {
	const repo = new FoundrySteadingImprovementRepository();
	return {
		card: async () => (await new SteadingImprovements(actor, repo).buildSnapshot()).entries[0],
		tick: row => new StonetopSteading(actor, steadingRepos({ improvements: repo }))
			.setChoiceTrackFor(new ChoiceTarget({ context: "improvement", group: item.system.slug, option: row }), "0", true),
	};
}

beforeEach(() => { document.body.innerHTML = ""; });
afterEach(() => vi.unstubAllGlobals());

describe("A custom improvement, authored on its sheet and built on a steading (integration)", () => {
	it("is finished when every box is ticked, and not before", async () => {
		const item = makeItem();
		stubGame([item]);
		await authorTwoRequirements(new Sheet(item));
		const [first, second] = item.system.choices.list.filter(r => r.track).map(r => r.slug);

		const actor = new FakeActorBuilder().withSystem({ improvements: [item.system.slug], improvementValues: {} }).build();
		let card = await steadingOwning(item, actor).card();
		expect([card.ticked, card.total, card.isComplete]).toEqual([0, 2, false]);

		await steadingOwning(item, actor).tick(first);
		card = await steadingOwning(item, actor).card();
		expect([card.ticked, card.isComplete]).toEqual([1, false]);

		await steadingOwning(item, actor).tick(second);
		card = await steadingOwning(item, actor).card();
		expect([card.ticked, card.isComplete]).toEqual([2, true]);
	});

	it("is finished at one box once its author sets the section to some of these", async () => {
		const item = makeItem();
		stubGame([item]);
		const sheet = new Sheet(item);
		let root = await authorTwoRequirements(sheet);
		await press(sheet, root.querySelector("[data-action='openHeading']"));
		root = await render(sheet);
		const some = root.querySelector("[data-change-action='sectionRule'][value='some']");
		some.checked = true;
		some.dispatchEvent(new Event("change", { bubbles: true }));
		await settle();

		const actor = new FakeActorBuilder().withSystem({ improvements: [item.system.slug], improvementValues: {} }).build();
		expect((await steadingOwning(item, actor).card()).total).toBe(1);
		await steadingOwning(item, actor).tick(item.system.choices.list.filter(r => r.track)[1].slug);
		expect((await steadingOwning(item, actor).card()).isComplete).toBe(true);
	});

	// What it gives you, authored on the sheet, is what the steading's card offers once it is built.
	it("offers the steading the result its author gave it", async () => {
		const item = makeItem();
		stubGame([item]);
		const sheet = new Sheet(item);
		let root = await authorTwoRequirements(sheet);
		await press(sheet, root.querySelector("[data-action='openResultAdder'][data-half='completion']"));
		root = await render(sheet);
		const does = root.querySelector(".stonetop-improvement-adder [data-change-action='resultDoes'][value='change']");
		does.checked = true;
		does.dispatchEvent(new Event("change", { bubbles: true }));
		await settle();
		// A steading reads a result only by its words (ImprovementEffects drops a wordless one).
		root = await render(sheet);
		const words = root.querySelector(".stonetop-improvement-adder [data-change-action='resultText']");
		words.value = "increase Fortunes by 1";
		words.dispatchEvent(new Event("change", { bubbles: true }));
		await settle();
		root = await render(sheet);
		await press(sheet, root.querySelector("[data-action='addResultDraft']"));

		const repo = new FoundrySteadingImprovementRepository();
		const [improvement] = await repo.getAll();
		expect(improvement.effects.all().map(e => [e.change?.target, e.change?.amount])).toEqual([["fortunes", 1]]);
	});
});
