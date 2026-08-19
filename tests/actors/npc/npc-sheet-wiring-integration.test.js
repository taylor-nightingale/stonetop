// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createStonetopNpcSheetClass } from "../../../src/actors/npc/StonetopNpcSheet.js";
import { StonetopNpc } from "../../../src/actors/npc/StonetopNpc.js";
import { FakeNpcActorBuilder } from "../../fakes/FakeNpcActorBuilder.js";
import { stonetopActorSheetBase } from "../../fakes/foundry/stonetopActorSheetBase.js";
import { Selection } from "../../../src/model/data/Selection.js";
import { fire, settle } from "../../fakes/domEvents.js";
import { warn } from "../../../src/utils/logger.js";

vi.mock("../../../src/utils/logger.js", () => ({ warn: vi.fn(), log: vi.fn(), error: vi.fn() }));

// End-to-end for the NPC card's tag chips against a REAL StonetopNpc.
//
// The chips used to be bound by CSS class on the NPC sheet even though the shared selection-chips
// partial already stamped `toggleTag` / `tagAdd` — the character sheet honoured those names and the
// NPC did not. Both now route through the one shared description, so this walks the NPC's half of
// it down to actor state.

const StonetopNpcSheet = createStonetopNpcSheetClass(stonetopActorSheetBase());

async function makeWiredSheet({ tags = "", editable = true } = {}) {
	const actor = new FakeNpcActorBuilder().withTagList(tags).build();
	actor.typedActor = new StonetopNpc(actor);
	const sheet = new StonetopNpcSheet(actor);
	sheet.isEditable = editable;
	await sheet._onFirstRender({}, {});
	return { sheet, actor };
}

const chips = (slug = "") => `
	<div class="stonetop-tags" data-slug="${slug}" data-field="tagList">
		<button class="stonetop-tag-chip" data-action="toggleTag" data-tag="devious"></button>
		<input class="stonetop-tag-add" data-change-action="tagAdd" value="  sneaky  ">
	</div>`;

const selected = actor => Selection.fromStored(actor.system.tagList).values;

async function clickChip(sheet) {
	const target = sheet.element.querySelector(".stonetop-tag-chip");
	await StonetopNpcSheet.DEFAULT_OPTIONS.actions.toggleTag
		.call(sheet, { type: "click", button: 0, preventDefault() {} }, target);
	await settle();
}

beforeEach(() => { document.body.innerHTML = ""; warn.mockClear(); });

describe("NPC tag chips (integration)", () => {
	it("removes a selected tag when its chip is clicked", async () => {
		const { sheet, actor } = await makeWiredSheet({ tags: "devious, quick" });
		sheet.element.innerHTML = chips();

		await clickChip(sheet);

		expect(selected(actor)).toEqual(["quick"]);
	});

	it("adds an unselected tag when its chip is clicked", async () => {
		const { sheet, actor } = await makeWiredSheet({ tags: "quick" });
		sheet.element.innerHTML = chips();

		await clickChip(sheet);

		expect(selected(actor)).toEqual(["quick", "devious"]);
	});

	it("adds a trimmed free-text tag through the add box", async () => {
		const { sheet, actor } = await makeWiredSheet({ tags: "quick" });
		sheet.element.innerHTML = chips();

		fire(sheet.element.querySelector(".stonetop-tag-add"), "change");
		await settle();

		expect(selected(actor)).toEqual(["quick", "sneaky"]);
	});

	// Pressing Enter fires TWO change events (native commit + the combobox's synthetic one). Since
	// the domain call toggles, a second firing would remove what the first added.
	it("commits an Enter-added tag exactly once across the paired change events", async () => {
		const { sheet, actor } = await makeWiredSheet();
		sheet.element.innerHTML = chips();
		const add = sheet.element.querySelector(".stonetop-tag-add");

		fire(add, "change");
		fire(add, "change");
		await settle();

		expect(selected(actor)).toEqual(["sneaky"]);
		expect(add.value).toBe("");
	});

	it("writes nothing while the sheet is not editable", async () => {
		const { sheet, actor } = await makeWiredSheet({ tags: "quick", editable: false });
		sheet.element.innerHTML = chips();

		await clickChip(sheet);
		fire(sheet.element.querySelector(".stonetop-tag-add"), "change");
		await settle();

		expect(selected(actor)).toEqual(["quick"]);
	});

	it("routes the chips without reporting template drift", async () => {
		const { sheet } = await makeWiredSheet();
		sheet.element.innerHTML = chips();

		fire(sheet.element.querySelector(".stonetop-tag-add"), "change");
		await settle();

		expect(warn).not.toHaveBeenCalled();
	});
});
