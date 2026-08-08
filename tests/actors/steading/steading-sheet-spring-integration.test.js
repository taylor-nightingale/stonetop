// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { createStonetopSteadingSheetClass } from "../../../src/actors/steading/StonetopSteadingSheet.js";
import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";
import { FakeCoreActorSheetBase } from "../../fakes/foundry/FakeCoreActorSheetBase.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";
import { FakeSteadingImprovementRepository } from "../../fakes/FakeSteadingImprovementRepository.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";
import { FakeCompendiumMoveBuilder } from "../../fakes/FakeCompendiumMoveBuilder.js";
import { FakeGameBuilder } from "../../fakes/FakeGameBuilder.js";
import { FakeGameBuilder } from "../../fakes/FakeGameBuilder.js";
import { fire, settle } from "../../fakes/domEvents.js";

// End-to-end for "Let Spring Break Forth": a real StonetopSteading + SteadingFirstSession behind the
// sheet's own V2 lifecycle, with only the Foundry boundary faked. The unit tests prove the domain
// class stores what it's told; this proves the sheet's handlers actually reach it — a binding wired
// to the wrong selector or reading the wrong dataset key passes every unit test and does nothing in
// the game.

const StonetopSteadingSheet = createStonetopSteadingSheetClass(FakeCoreActorSheetBase);


const springMove = () => new FakeCompendiumMoveBuilder()
	.withName("Seasons Change: Spring")
	.withMoveType("seasons")
	.withRollStat("fortunes")
	.withDescription("When spring bursts forth upon the land…")
	.build();

function moveRepo() {
	const repo = new FakeMoveRepository();
	repo.addBasic(springMove());
	return repo;
}

// Mirrors what spring-section.hbs emits. The "template ↔ handler contract" tests at the bottom keep
// this stub honest about the real markup.
const SECTION_HTML = `
	<section class="steading-spring steading-panel-frame">
		<input type="text" class="steading-spring-hopeful" value="">
		<button type="button" class="steading-spring-post-move" data-view-state
		        data-action="moveToChat" data-move-slug="seasons-change-spring"></button>
		<div class="steading-spring-gains stonetop-choice-entry" data-slug="seasonal-gains">
			${["population", "bounty", "news"].map(key => `
				<label><input type="radio" class="stonetop-item-check stonetop-cg-pick"
				       name="-seasonal-gains-row-0" data-change-action="cgPick"
				       data-cg-context="steading" data-cg-group="seasonal-gains"
				       data-cg-option="${key}" data-cg-siblings="population,bounty,news"></label>`).join("")}
		</div>
		<textarea class="steading-spring-hook"></textarea>
		<ul class="steading-spring-excites">
			<li><textarea class="steading-spring-excites-answer" data-actor-id="pc1"></textarea></li>
			<li><textarea class="steading-spring-excites-answer" data-actor-id="pc2"></textarea></li>
		</ul>
		<button type="button" class="steading-spring-done"></button>
		<button type="button" class="steading-spring-reopen"></button>
	</section>`;

async function makeWiredSheet({ editable = true } = {}) {
	const actor = new FakeSteadingBuilder()
		.withTypedActor(a => new StonetopSteading(a, new FakeSteadingImprovementRepository(), moveRepo()))
		.build();

	const sheet = new StonetopSteadingSheet(actor);
	sheet.isEditable = editable;
	sheet.element.innerHTML = SECTION_HTML;
	await sheet._onFirstRender({}, {});
	sheet._onRender({}, {});
	return { sheet, actor, firstSession: actor.typedActor.firstSession };
}

const el = (sheet, selector) => sheet.element.querySelector(selector);

async function type(sheet, selector, value) {
	const field = el(sheet, selector);
	field.value = value;
	fire(field, "change");
	await settle();
}

async function pickGain(sheet, gainKey) {
	const radio = el(sheet, `.stonetop-cg-pick[data-cg-option="${gainKey}"]`);
	radio.checked = true;
	fire(radio, "change");
	await settle();
}

const pickedGains = firstSession =>
	firstSession.buildSnapshot().gains.list[0].options.filter(o => o.checked).map(o => o.slug);

async function click(sheet, selector) {
	fire(el(sheet, selector), "click");
	await settle();
}

describe("StonetopSteadingSheet — Let Spring Break Forth", () => {
	// The excites rows are one per player character, so the section needs a world with characters in it.
	beforeEach(() => {
		new FakeGameBuilder()
			.withWorldActor({ id: "pc1", name: "Blodwen",  type: "character" })
			.withWorldActor({ id: "pc2", name: "Vahid",    type: "character" })
			.withWorldActor({ id: "st1", name: "Stonetop", type: "steading" })
			.build();
	});
	afterEach(() => { vi.unstubAllGlobals(); });

	it("records the most hopeful character typed into the field", async () => {
		const { sheet, actor, firstSession } = await makeWiredSheet();

		await type(sheet, ".steading-spring-hopeful", "Blodwen");

		expect(firstSession.hopeful).toBe("Blodwen");
		expect(actor.system.firstSession.hopeful).toBe("Blodwen");
	});

	it("records the hook the roll opened", async () => {
		const { sheet, firstSession } = await makeWiredSheet();

		await type(sheet, ".steading-spring-hook", "A trader wants an escort to Marshedge.");

		expect(firstSession.hook).toBe("A trader wants an escort to Marshedge.");
	});

	it("records the seasonal gain the table picked", async () => {
		const { sheet, firstSession } = await makeWiredSheet();

		await pickGain(sheet, "news");

		expect(pickedGains(firstSession)).toEqual(["news"]);
	});

	// The bug the bespoke checkboxes had: a gain, once ticked, could never be released, so the
	// section accumulated every gain the table considered. Picking again has to replace.
	it("replaces the pick when the table changes its mind", async () => {
		const { sheet, firstSession } = await makeWiredSheet();

		await pickGain(sheet, "news");
		await pickGain(sheet, "bounty");

		expect(pickedGains(firstSession)).toEqual(["bounty"]);
	});

	// The section records what the table picked; applying it is the GM's call on the ratings above.
	it("does not change the steading's ratings when a gain is ticked", async () => {
		const { sheet, actor } = await makeWiredSheet();
		const before = { ...actor.system.attributes };

		await pickGain(sheet, "population");   // "Increase Population by 1"
		await pickGain(sheet, "bounty");       // "generates 1 Surplus, now"

		expect(actor.system.attributes).toEqual(before);
	});

	// An embedded move's picks live in that item's own pickValues; a row rendered in any other
	// context must not be swept into the steading's store, where nothing would read it back.
	it("ignores a pick row rendered for something other than the steading", async () => {
		const { sheet, actor } = await makeWiredSheet();
		const stray = sheet.element.querySelector('.stonetop-cg-pick[data-cg-option="news"]').cloneNode();
		stray.dataset.cgContext = "move";
		stray.dataset.cgOption  = "some-move-option";
		sheet.element.appendChild(stray);

		stray.checked = true;
		fire(stray, "change");
		await settle();

		expect(actor.system.choiceValues ?? {}).toEqual({});
	});

	it("stores each player's answer against their own character", async () => {
		const { sheet, firstSession } = await makeWiredSheet();

		await type(sheet, '.steading-spring-excites-answer[data-actor-id="pc2"]', "The Mindgem.");

		expect(firstSession.excitesFor("pc2")).toBe("The Mindgem.");
		expect(firstSession.excitesFor("pc1")).toBe("");
	});

	it("closes the section, and reopens it with everything intact", async () => {
		const { sheet, firstSession } = await makeWiredSheet();
		await type(sheet, ".steading-spring-hook", "Bandits on the road.");
		await pickGain(sheet, "news");

		await click(sheet, ".steading-spring-done");
		expect(firstSession.isDone).toBe(true);

		await click(sheet, ".steading-spring-reopen");
		expect(firstSession.isDone).toBe(false);
		expect(firstSession.hook).toBe("Bandits on the road.");
		expect(pickedGains(firstSession)).toEqual(["news"]);
	});

	it("posts the spring move to chat from the section's shortcut", async () => {
		const { sheet, actor } = await makeWiredSheet();
		await actor.typedActor.moves.seedReferenceMoves();

		// The shortcut is core's data-action, not a bound listener: invoke it the way core does,
		// handler.call(app, event, target), with the button the template emits.
		const button = el(sheet, ".steading-spring-post-move");
		await sheet.constructor.DEFAULT_OPTIONS.actions.moveToChat.call(sheet, { type: "click" }, button);

		expect(actor.chatItems).toHaveLength(1);
		expect(actor.chatItems[0].name).toBe("Seasons Change: Spring");
	});

	it("renders the section from the steading's own snapshot", async () => {
		const { actor } = await makeWiredSheet();
		await actor.typedActor.moves.seedReferenceMoves();

		const snapshot = await actor.typedActor.buildSnapshot({ isGM: true });

		expect(snapshot.firstSession.gains.list[0].options).toHaveLength(6);
		expect(snapshot.firstSession.excites.map(r => r.name)).toEqual(["Blodwen", "Vahid"]);
		expect(snapshot.firstSession.hasSpringMove).toBe(true);
	});

	it("drops the post-to-chat shortcut when the steading no longer carries the spring move", async () => {
		const { actor } = await makeWiredSheet();

		const snapshot = await actor.typedActor.buildSnapshot({ isGM: true });

		expect(snapshot.firstSession.hasSpringMove).toBe(false);
	});
});

// Nothing renders .hbs in these tests (Foundry compiles the templates), so assert the template and
// the handlers agree — otherwise renaming a class or a data attribute in one file leaves every test
// above passing against a stub that no longer matches the real sheet.
describe("spring-section.hbs ↔ first-session handler contract", () => {
	const read = rel => readFileSync(path.resolve(process.cwd(), rel), "utf8");
	const template = read("templates/actor/partials/spring-section.hbs");
	const sheetSource = read("src/actors/steading/StonetopSteadingSheet.js");

	it.each([
		"steading-spring-hopeful",
		"steading-spring-hook",
		"steading-spring-excites-answer",
		"steading-spring-done",
		"steading-spring-reopen",
	])("emits %s, which the sheet binds", cls => {
		expect(template).toContain(cls);
		expect(sheetSource).toContain(`.${cls}`);
	});

	it("passes the actor id the excites handler reads", () => {
		expect(template).toContain('data-actor-id="{{actorId}}"');
	});

	// The gains are an ordinary choice group: rendered by the shared row, written by the shared
	// controller. A bespoke checkbox here is what let a pick be made and never released.
	it("renders the gains through the shared choice-row rather than its own checkbox", () => {
		expect(template).toContain('{{> "stonetop.choice-group" cgContext="steading"}}');
		expect(template).not.toContain("gain-check");
	});

	it("binds the pick class the shared choice-row emits", () => {
		expect(read("templates/actor/partials/choice-row.hbs")).toContain("stonetop-cg-pick");
		expect(sheetSource).toContain('.stonetop-cg-pick');
	});

	it("reuses the sheet's moveToChat action rather than a second roll route", () => {
		expect(template).toContain('data-action="moveToChat"');
		expect(template).toContain('data-move-slug="seasons-change-spring"');
		expect(sheetSource).toContain("moveToChat");
	});

	it("is rendered on the steading's overview tab, fed the first-session snapshot", () => {
		const steadingTemplate = read("templates/actor/steading.hbs");
		expect(steadingTemplate).toContain('{{> "stonetop.spring-section" spring=stonetop.firstSession}}');
	});

	it("says on the section itself that only the GM sees it", () => {
		expect(template).toContain('{{localize "stonetop.steading.spring.gmOnly"}}');
	});

	// GM-facing prep: the section is the GM's, and its prompts give away the reading of the roll.
	it("is gated on isGM, which the sheet puts in the render context", () => {
		const steadingTemplate = read("templates/actor/steading.hbs");
		expect(steadingTemplate).toMatch(/\{\{#if isGM\}\}\s*\{\{> "stonetop\.spring-section"/);
		expect(sheetSource).toContain("ctx.isGM");
	});

	it("is registered as a partial", () => {
		expect(read("stonetop.js")).toContain("stonetop.spring-section");
	});
});
