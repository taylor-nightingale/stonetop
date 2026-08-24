import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActorRolling } from "../../src/actors/ActorRolling.js";
import { RollRequest } from "../../src/actors/RollRequest.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";
import { FakeStonetopCharacter } from "../fakes/FakeStonetopCharacter.js";
import { FakeRoll } from "../fakes/foundry/FakeRoll.js";
import { FakeChatMessage } from "../fakes/foundry/FakeChatMessage.js";
import { FakeDialog } from "../fakes/foundry/FakeDialog.js";
import { renderTemplate as renderRealTemplate } from "../fakes/renderTemplate.js";

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
		...(d.results ?? []).map(r => `${r.label} ${r.text.render()}`),
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

	it("includes every result tier (a roll card shows only the rolled one)", async () => {
		const rolling = makeRolling({bonuses: {wis: 1}});
		const item = {name: "Charm Someone", system: {rollStat: "wis", description: "Roll to persuade.", moveResults: {
			success: {label: "10+", value: "They agree."},
			partial: {label: "7-9", value: "They want something."},
			failure: {label: "6-",  value: "It goes poorly."},
		}}};
		await rolling.execute(RollRequest.fromItem(item, "wis", "normal"), {descriptionOnly: true});
		const content = FakeChatMessage.lastCreated.content;
		expect(content).toContain("10+ They agree.");
		expect(content).toContain("7-9 They want something.");
		expect(content).toContain("6- It goes poorly.");
	});
});

// -- postDescription -----------------------------------------------------------

describe("ActorRolling.postDescription", () => {
	it("posts bare label + description text as the actor, no roll", async () => {
		const rolling = makeRolling();
		await rolling.postDescription("Whispered Secrets", "Ask the GM a question.");
		expect(FakeRoll.lastInstance).toBeNull();
		expect(FakeChatMessage.lastCreated.content).toContain("Whispered Secrets");
		expect(FakeChatMessage.lastCreated.content).toContain("Ask the GM a question.");
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

// The stat-pick dialog renders its body from a template, so it appears an await later than the
// call. Tests drive it through this rather than each racing the render.
const dialogShown = () => vi.waitUntil(() => FakeDialog.lastConfig);

describe("ActorRolling._pickStat", () => {
	// The dialog body is a real template now, so these render it for real — a stub returning a
	// hand-written string would only prove the stub contains what the stub was told to contain.
	beforeEach(() => {
		foundry.applications.handlebars.renderTemplate = async (path, data) => renderRealTemplate(path, data);
	});

	// _pickStat's promise settles only on click or close, so these await the dialog, never the call.
	// It comes back BOXED because an async function unwraps a returned promise recursively — handing
	// `picked` straight back would make `await openPicker(...)` wait on the very thing it must not.
	async function openPicker(stats, initialRollMode = "normal") {
		const picked = ActorRolling._pickStat("Roll", stats, initialRollMode);
		await dialogShown();
		return { picked };
	}

	const oneStat = [{key: "str", name: "STR", value: 2}];

	it("creates one button per stat", async () => {
		await openPicker([{key: "str", name: "STR", value: 2}, {key: "dex", name: "DEX", value: 0}]);
		expect(Object.keys(FakeDialog.lastConfig.buttons)).toEqual(["str", "dex"]);
	});

	it("resolves {stat, rollMode} when a button is clicked", async () => {
		const { picked } = await openPicker(oneStat);
		FakeDialog.clickButton("str", "adv");
		expect(await picked).toEqual({stat: "str", rollMode: "adv"});
	});

	it("resolves null when the dialog is closed", async () => {
		const { picked } = await openPicker(oneStat);
		FakeDialog.close();
		expect(await picked).toBeNull();
	});

	it("offers all three roll modes", async () => {
		await openPicker(oneStat);
		const content = FakeDialog.lastConfig.content;
		expect(content).toContain('value="adv"');
		expect(content).toContain('value="normal"');
		expect(content).toContain('value="dis"');
	});

	it("pre-selects the supplied initialRollMode", async () => {
		await openPicker(oneStat, "adv");
		expect(FakeDialog.lastConfig.content).toMatch(/value="adv"[^>]*checked/);
	});

	// The dialog reads its radios once, on submit; the sheet's copy of this partial writes back
	// through the change router as you click. Only the sheet passes a change action.
	it("leaves the radios out of the sheet's change router", async () => {
		await openPicker(oneStat);
		expect(FakeDialog.lastConfig.content).not.toContain("data-change-action");
	});

	it("names the radio group so the callback can read it back", async () => {
		await openPicker(oneStat);
		expect(FakeDialog.lastConfig.content).toContain('name="rollMode"');
	});

	it("adds stonetop-roll-dialog class via dialog options", async () => {
		await openPicker(oneStat);
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
		await dialogShown();
		FakeDialog.clickButton("str", "normal");
		await p;
		expect(FakeRoll.lastInstance.formula).toBe("2d6 + 1");
	});

	it("uses the rollMode from dialog, overriding request.rollMode", async () => {
		const rolling = makeAskRolling({str: 1});
		const p = rolling.execute(RollRequest.fromStat("ask", "normal"));
		await dialogShown();
		FakeDialog.clickButton("str", "adv");
		await p;
		expect(FakeRoll.lastInstance.formula).toBe("3d6kh2 + 1");
	});

	it("aborts without rolling when the dialog is closed", async () => {
		const rolling = makeAskRolling({str: 1});
		const p = rolling.execute(RollRequest.fromStat("ask", "normal"));
		await dialogShown();
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

	it("offers the Mark XP button when the roll totals 6-, without marking on its own", async () => {
		const rolling = makeRolling({ bonuses: { str: 0 } });
		FakeRoll.setNextTotal(6);
		await rolling.execute(moveRequest());
		expect(rolling._actor.typedActor.xpMarks).toBe(0);
		expect(FakeChatMessage.lastCreated.content).toContain("stonetop.rollResults.xpMark");
		expect(FakeChatMessage.lastCreated.content).toContain("stonetop-xp-toggle");
	});

	it("offers nothing on a 7-9 or 10+", async () => {
		const rolling = makeRolling({ bonuses: { str: 0 } });
		for (const total of [7, 10]) {
			FakeRoll.setNextTotal(total);
			await rolling.execute(moveRequest());
		}
		expect(FakeChatMessage.lastCreated.content).not.toContain("xpMark");
	});

	it("offers nothing when the move says otherwise (xpOnMiss: false)", async () => {
		const rolling = makeRolling({ bonuses: { str: 0 } });
		FakeRoll.setNextTotal(3);
		await rolling.execute(moveRequest({ xpOnMiss: false }));
		expect(FakeChatMessage.lastCreated.content).not.toContain("xpMark");
	});

	it("offers on a bare stat-prompt roll too (rolling a stat is still rolling for a move)", async () => {
		const rolling = makeRolling({ bonuses: { wis: 1 } });
		FakeRoll.setNextTotal(5);
		await rolling.execute(statRequest("wis"));
		expect(FakeChatMessage.lastCreated.content).toContain("stonetop.rollResults.xpMark");
	});

	it("stamps the card with the unmarked xpMark flag alongside the offer", async () => {
		const rolling = makeRolling({ bonuses: { str: 0 } });
		FakeRoll.setNextTotal(6);
		await rolling.execute(moveRequest());
		expect(FakeChatMessage.lastCreated.flags).toEqual({ stonetop: { xpMark: { marked: false } } });
	});

	it("stamps no flag when there is no offer", async () => {
		const rolling = makeRolling({ bonuses: { str: 0 } });
		FakeRoll.setNextTotal(10);
		await rolling.execute(moveRequest());
		expect(FakeChatMessage.lastCreated.flags).toBeUndefined();
	});

	it("offers nothing to actors without an XP track (no markXp on the typed actor)", async () => {
		const rolling = makeRolling({ bonuses: { str: 0 } });
		delete rolling._actor.typedActor.markXp; // instance shadow-delete falls back to the class method
		rolling._actor.typedActor.markXp = undefined;
		FakeRoll.setNextTotal(2);
		await rolling.execute(moveRequest());
		expect(FakeChatMessage.lastCreated.content).not.toContain("xpMark");
	});
});
