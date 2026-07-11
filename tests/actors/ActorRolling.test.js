import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActorRolling } from "../../src/actors/ActorRolling.js";
import { RollRequest } from "../../src/actors/RollRequest.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";
import { FakeStonetopCharacter } from "../fakes/FakeStonetopCharacter.js";
import { FakeRoll } from "../fakes/foundry/FakeRoll.js";
import { FakeChatMessage } from "../fakes/foundry/FakeChatMessage.js";
import { FakeDialog } from "../fakes/foundry/FakeDialog.js";

// -- helpers -------------------------------------------------------------------

function makeRolling({ die, bonuses = {} } = {}) {
	const actor = new FakeCharacterActorBuilder().withDamage(die).build();
	actor.typedActor = new FakeStonetopCharacter();
	for (const [stat, bonus] of Object.entries(bonuses)) {
		actor.typedActor.withBonus(stat, bonus);
	}
	return new ActorRolling(actor);
}

function statRequest(stat, rollMode = "normal") {
	return RollRequest.fromStat(stat, rollMode);
}

// -- setup ---------------------------------------------------------------------

beforeEach(() => {
	FakeRoll.reset();
	FakeChatMessage.reset();
	FakeDialog.reset();
	vi.stubGlobal("Roll", FakeRoll);
	vi.stubGlobal("ChatMessage", FakeChatMessage);
	vi.stubGlobal("Dialog", FakeDialog);
	vi.stubGlobal("game", {i18n: {localize: k => k}});
	// Card-aware renderTemplate stub: flatten the card's text + dice so content assertions hold
	// without a real Handlebars render. The template itself is exercised by Foundry.
	foundry.applications.handlebars.renderTemplate = async (_path, d) => [
		d.name ?? "",
		d.description ? d.description.render() : "",
		d.resultText ? d.resultText.render() : "",
		d.dice ? d.dice.diceGroups.flatMap(g => g.values).join(",") : "",
		d.xpLine ?? "",
	].join(" | ");
});

afterEach(() => {
	vi.unstubAllGlobals();
	foundry.applications.handlebars.renderTemplate = async () => "";
});

// -- execute — damage ----------------------------------------------------------

describe("ActorRolling.execute — damage", () => {
	it("rolls with formula '1d6' for die 'd6'", async () => {
		const rolling = makeRolling({die: "d6"});
		await rolling.execute(statRequest("damage"));
		expect(FakeRoll.lastInstance.formula).toBe("1d6");
	});

	it("does not double-prefix when die is already '1d6'", async () => {
		const rolling = makeRolling({die: "1d6"});
		await rolling.execute(statRequest("damage"));
		expect(FakeRoll.lastInstance.formula).toBe("1d6");
	});

	it("uses die as-is when it already has a count like '2d8'", async () => {
		const rolling = makeRolling({die: "2d8"});
		await rolling.execute(statRequest("damage"));
		expect(FakeRoll.lastInstance.formula).toBe("2d8");
	});

	it("preserves modifier in die formula", async () => {
		const rolling = makeRolling({die: "d6+1"});
		await rolling.execute(statRequest("damage"));
		expect(FakeRoll.lastInstance.formula).toBe("1d6+1");
	});

	it("posts ChatMessage with damage title", async () => {
		const rolling = makeRolling({die: "d6"});
		await rolling.execute(statRequest("damage"));
		expect(FakeChatMessage.lastCreated.content).toContain("stonetop.character.attributes.damage");
	});

	it("is a no-op when actor has no damage die value", async () => {
		const rolling = makeRolling();
		await expect(rolling.execute(statRequest("damage"))).resolves.toBeUndefined();
	});
});

// -- execute — stat roll -------------------------------------------------------

describe("ActorRolling.execute — stat roll", () => {
	it("uses '2d6 + bonus' formula for default mode", async () => {
		const rolling = makeRolling({bonuses: {str: 2}});
		await rolling.execute(statRequest("str", "normal"));
		expect(FakeRoll.lastInstance.formula).toBe("2d6 + 2");
	});

	it("uses '3d6kh2 + bonus' formula for adv mode", async () => {
		const rolling = makeRolling({bonuses: {wis: 1}});
		await rolling.execute(statRequest("wis", "adv"));
		expect(FakeRoll.lastInstance.formula).toBe("3d6kh2 + 1");
	});

	it("uses '3d6kl2 + bonus' formula for dis mode", async () => {
		const rolling = makeRolling({bonuses: {str: 0}});
		await rolling.execute(statRequest("str", "dis"));
		expect(FakeRoll.lastInstance.formula).toBe("3d6kl2 + 0");
	});

	it("posts to ChatMessage", async () => {
		const rolling = makeRolling({bonuses: {wis: 1}});
		await rolling.execute(statRequest("wis"));
		expect(FakeChatMessage.lastCreated).not.toBeNull();
	});

	it("posts description-only message when resolveBonus returns null", async () => {
		const rolling = makeRolling();
		await rolling.execute(statRequest("loyalty"));
		expect(FakeRoll.lastInstance).toBeNull();
		expect(FakeChatMessage.lastCreated.content).toContain("LOYALTY");
	});
});

// -- execute — description only ------------------------------------------------

describe("ActorRolling.execute — description only", () => {
	it("creates a ChatMessage with label and description, no roll", async () => {
		const rolling = makeRolling({bonuses: {wis: 1}});
		const item = {name: "Charm Someone", system: {rollStat: "wis", description: "Roll to persuade.", moveResults: null}};
		const request = RollRequest.fromItem(item, "wis", "normal");
		await rolling.execute(request, {descriptionOnly: true});
		expect(FakeRoll.lastInstance).toBeNull();
		expect(FakeChatMessage.lastCreated.content).toContain("Charm Someone");
		expect(FakeChatMessage.lastCreated.content).toContain("Roll to persuade.");
	});
});

// -- rich-text chat card (integration) -----------------------------------------

describe("ActorRolling.execute — rich-text chat card", () => {
	it("renders a description's markdown and @UUID link through the one pipeline", async () => {
		const rolling = makeRolling({bonuses: {wis: 1}});
		const item = {name: "Charm", system: {rollStat: "wis", description: "**charm** see @UUID[JournalEntry.x]{Barrow}", moveResults: null}};
		const request = RollRequest.fromItem(item, "wis", "normal");

		const orig = foundry.applications.ux.TextEditor.implementation.enrichHTML;
		foundry.applications.ux.TextEditor.implementation.enrichHTML =
			async html => html.replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, '<a class="content-link">$1</a>');
		try {
			await rolling.execute(request, {descriptionOnly: true});
		} finally {
			foundry.applications.ux.TextEditor.implementation.enrichHTML = orig;
		}

		const content = FakeChatMessage.lastCreated.content;
		expect(content).toContain("<strong>charm</strong>");
		expect(content).toContain('<a class="content-link">Barrow</a>');
	});
});

// -- _pickStat -----------------------------------------------------------------

describe("ActorRolling._pickStat", () => {
	it("creates one button per stat", () => {
		const stats = [{key: "str", name: "STR", value: 2}, {key: "dex", name: "DEX", value: 0}];
		ActorRolling._pickStat("Roll", stats, "normal");
		expect(Object.keys(FakeDialog.lastConfig.buttons)).toEqual(["str", "dex"]);
	});

	it("resolves {stat, rollMode} when a button is clicked", async () => {
		const promise = ActorRolling._pickStat("Roll", [{key: "str", name: "STR", value: 2}], "normal");
		FakeDialog.clickButton("str", "adv");
		expect(await promise).toEqual({stat: "str", rollMode: "adv"});
	});

	it("resolves null when the dialog is closed", async () => {
		const promise = ActorRolling._pickStat("Roll", [{key: "str", name: "STR", value: 2}], "normal");
		FakeDialog.close();
		expect(await promise).toBeNull();
	});

	it("content includes all three roll mode options", () => {
		ActorRolling._pickStat("Roll", [{key: "str", name: "STR", value: 2}], "normal");
		const content = FakeDialog.lastConfig.content;
		expect(content).toContain('value="adv"');
		expect(content).toContain('value="normal"');
		expect(content).toContain('value="dis"');
	});

	it("pre-selects the supplied initialRollMode", () => {
		ActorRolling._pickStat("Roll", [{key: "str", name: "STR", value: 2}], "adv");
		expect(FakeDialog.lastConfig.content).toMatch(/value="adv"[^>]*checked/);
	});

	it("adds stonetop-roll-dialog class via dialog options", () => {
		ActorRolling._pickStat("Roll", [{key: "str", name: "STR", value: 2}], "normal");
		expect(FakeDialog.lastOptions.classes).toContain("stonetop-roll-dialog");
	});
});

// -- execute — ask stat --------------------------------------------------------

describe("ActorRolling.execute — ask stat", () => {
	function makeAskRolling(bonuses = {}) {
		const rolling = makeRolling({bonuses});
		rolling._actor.typedActor.getRollableStats = () =>
			Object.entries(bonuses).map(([k, v]) => ({key: k, name: k.toUpperCase(), value: v}));
		return rolling;
	}

	it("uses the stat returned by _pickStat", async () => {
		const rolling = makeAskRolling({str: 1});
		const p = rolling.execute(RollRequest.fromStat("ask", "normal"));
		FakeDialog.clickButton("str", "normal");
		await p;
		expect(FakeRoll.lastInstance.formula).toBe("2d6 + 1");
	});

	it("uses the rollMode from dialog, overriding request.rollMode", async () => {
		const rolling = makeAskRolling({str: 1});
		const p = rolling.execute(RollRequest.fromStat("ask", "normal"));
		FakeDialog.clickButton("str", "adv");
		await p;
		expect(FakeRoll.lastInstance.formula).toBe("3d6kh2 + 1");
	});

	it("aborts without rolling when the dialog is closed", async () => {
		const rolling = makeAskRolling({str: 1});
		const p = rolling.execute(RollRequest.fromStat("ask", "normal"));
		FakeDialog.close();
		await p;
		expect(FakeRoll.lastInstance).toBeNull();
	});
});

// -- execute — XP on a miss ------------------------------------------------------

describe("ActorRolling.execute — XP on a 6-", () => {
	function moveRequest({ xpOnMiss } = {}) {
		return RollRequest.fromItem({
			name: "Defy Danger",
			system: { rollStat: "str", description: "", moveResults: null, ...(xpOnMiss === undefined ? {} : { xpOnMiss }) },
		});
	}

	it("marks 1 XP when the roll totals 6-", async () => {
		const rolling = makeRolling({ bonuses: { str: 0 } });
		FakeRoll.setNextTotal(6);
		await rolling.execute(moveRequest());
		expect(rolling._actor.typedActor.xpMarks).toBe(1);
		expect(FakeChatMessage.lastCreated.content).toContain("stonetop.rollResults.xpMarked");
	});

	it("marks nothing on a 7-9 or 10+", async () => {
		const rolling = makeRolling({ bonuses: { str: 0 } });
		for (const total of [7, 10]) {
			FakeRoll.setNextTotal(total);
			await rolling.execute(moveRequest());
		}
		expect(rolling._actor.typedActor.xpMarks).toBe(0);
		expect(FakeChatMessage.lastCreated.content).not.toContain("xpMarked");
	});

	it("skips the mark when the move says otherwise (xpOnMiss: false)", async () => {
		const rolling = makeRolling({ bonuses: { str: 0 } });
		FakeRoll.setNextTotal(3);
		await rolling.execute(moveRequest({ xpOnMiss: false }));
		expect(rolling._actor.typedActor.xpMarks).toBe(0);
	});

	it("marks on a bare stat-prompt roll too (rolling a stat is still rolling for a move)", async () => {
		const rolling = makeRolling({ bonuses: { wis: 1 } });
		FakeRoll.setNextTotal(5);
		await rolling.execute(statRequest("wis"));
		expect(rolling._actor.typedActor.xpMarks).toBe(1);
	});

	it("stamps the card with the xpMark flag and undo toggle when the mark lands", async () => {
		const rolling = makeRolling({ bonuses: { str: 0 } });
		FakeRoll.setNextTotal(6);
		await rolling.execute(moveRequest());
		expect(FakeChatMessage.lastCreated.flags).toEqual({ stonetop: { xpMark: { undone: false } } });
		expect(FakeChatMessage.lastCreated.content).toContain("stonetop-xp-toggle");
	});

	it("stamps no flag when nothing was marked", async () => {
		const rolling = makeRolling({ bonuses: { str: 0 } });
		FakeRoll.setNextTotal(10);
		await rolling.execute(moveRequest());
		expect(FakeChatMessage.lastCreated.flags).toBeUndefined();
	});

	it("shows no XP line when the track is already full", async () => {
		const rolling = makeRolling({ bonuses: { str: 0 } });
		rolling._actor.typedActor.xpFull = true;
		FakeRoll.setNextTotal(4);
		await rolling.execute(moveRequest());
		expect(rolling._actor.typedActor.xpMarks).toBe(0);
		expect(FakeChatMessage.lastCreated.content).not.toContain("xpMarked");
	});

	it("tolerates actors without an XP track (no markXp on the typed actor)", async () => {
		const rolling = makeRolling({ bonuses: { str: 0 } });
		delete rolling._actor.typedActor.markXp; // instance shadow-delete falls back to the class method
		rolling._actor.typedActor.markXp = undefined;
		FakeRoll.setNextTotal(2);
		await rolling.execute(moveRequest());
		expect(FakeChatMessage.lastCreated.content).not.toContain("xpMarked");
	});
});
