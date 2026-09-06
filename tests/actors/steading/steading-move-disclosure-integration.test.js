// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { createStonetopSteadingSheetClass } from "../../../src/actors/steading/StonetopSteadingSheet.js";
import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";
import { FakeCompendiumMoveBuilder } from "../../fakes/FakeCompendiumMoveBuilder.js";
import { stonetopActorSheetBase } from "../../fakes/foundry/stonetopActorSheetBase.js";
import { steadingRepos } from "../../fakes/FakeSteadingRepos.js";
import { renderTemplate } from "../../fakes/renderTemplate.js";
import { renderSheetPart } from "../../fakes/renderSheetPart.js";

const STEADING_TEMPLATE = "systems/stonetop/templates/actor/steading.hbs";

/**
 * A move you opened in the rail has to survive the next render, and every edit anywhere on the sheet
 * causes one — a resident renamed, a pip ticked, another player's change arriving over the socket.
 * It used to shut mid-sentence, because ApplicationV2 rebuilds the part's DOM and the disclosure kept
 * its state only in that DOM.
 *
 * End to end, with only the V2 base faked: the real steading sheet, the real template and its real
 * partials, the real MoveDisclosure and the real OpenMoveRows. A unit test with a hand-written row
 * would prove the record works and miss whether the sheet ever calls it.
 */
/**
 * @param id  the application id the template scopes its region ids with. Real in play (two sheets
 *            open at once must not mint the same ids), so it is real here too — and it is what makes
 *            the "two sheets" case below a genuine one.
 */
async function makeSheet(id = "steading-1", existingActor = null) {
	const actor = existingActor ?? new FakeSteadingBuilder().build();
	const repo = new FakeMoveRepository()
		.addBasic(new FakeCompendiumMoveBuilder().withName("Bolster").withMoveType("homefront")
			.withDescription("When you **_prepare for what's coming_**, say how.").build())
		.addBasic(new FakeCompendiumMoveBuilder().withName("Deploy").withMoveType("homefront")
			.withDescription("When you **_send folk into danger_**, roll +Defenses.").build());
	actor.typedActor ??= new StonetopSteading(actor,
		steadingRepos({ improvements: { getBySlug: async () => null }, moves: repo }));
	if (!existingActor) await actor.typedActor.onCreate();

	const sheet = new (createStonetopSteadingSheetClass(stonetopActorSheetBase()))(actor);
	sheet.id = id;
	// In the document, as a rendered sheet is: a disclosure resolves the region its button controls
	// by id, which a detached tree cannot answer.
	document.body.append(sheet.element);
	return sheet;
}

/** One render of the sheet: a fresh tree, every row shut, through the real V2 render order. */
async function render(sheet) {
	return renderSheetPart(sheet, renderTemplate(STEADING_TEMPLATE, await sheet._prepareContext({})));
}

const rowFor = (root, slug) => root.querySelector(`.stonetop-move-disclosure[data-move-slug="${slug}"]`);
const bodyFor = (root, slug) =>
	root.querySelector(`#${rowFor(root, slug).getAttribute("aria-controls")}`);

const openRow = (sheet, root, slug) =>
	sheet.constructor.DEFAULT_OPTIONS.actions.toggleMoveBody
		.call(sheet, { type: "click" }, rowFor(root, slug));

describe("a rail move stays open across a re-render (integration)", () => {
	beforeEach(() => { document.body.innerHTML = ""; });

	it("renders every homefront move shut to begin with", async () => {
		const sheet = await makeSheet();
		const root = await render(sheet);

		expect(rowFor(root, "bolster")).not.toBeNull();
		expect(bodyFor(root, "bolster").hidden).toBe(true);
		expect(rowFor(root, "bolster").getAttribute("aria-expanded")).toBe("false");
	});

	it("re-opens the move the reader had open", async () => {
		const sheet = await makeSheet();
		openRow(sheet, await render(sheet), "bolster");

		const root = await render(sheet);

		expect(bodyFor(root, "bolster").hidden, "the open move shut on re-render").toBe(false);
		expect(rowFor(root, "bolster").getAttribute("aria-expanded")).toBe("true");
	});

	it("leaves the moves the reader did not open shut", async () => {
		const sheet = await makeSheet();
		openRow(sheet, await render(sheet), "bolster");

		const root = await render(sheet);

		expect(bodyFor(root, "deploy").hidden).toBe(true);
		expect(rowFor(root, "deploy").getAttribute("aria-expanded")).toBe("false");
	});

	it("does not re-open a move the reader shut again", async () => {
		const sheet = await makeSheet();
		const first = await render(sheet);
		openRow(sheet, first, "bolster");
		openRow(sheet, first, "bolster");

		expect(bodyFor(await render(sheet), "bolster").hidden).toBe(true);
	});

	// The record belongs to the sheet instance, never to the actor: what one person has open is a
	// fact about that person. Stored on the document it would open on everyone's sheet at the table.
	it("reaches no other sheet on the same steading, and writes nothing to the actor", async () => {
		const sheet = await makeSheet();
		const root = await render(sheet);
		const before = JSON.stringify(sheet.actor.system);
		openRow(sheet, root, "bolster");

		const other = await makeSheet("steading-2", sheet.actor);
		const otherRoot = await render(other);

		expect(bodyFor(otherRoot, "bolster").hidden, "one reader's open row opened on another sheet").toBe(true);
		expect(JSON.stringify(sheet.actor.system), "opening a move wrote to the steading").toBe(before);
	});
});
