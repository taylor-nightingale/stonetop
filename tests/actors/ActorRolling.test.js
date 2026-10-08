import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActorRolling } from "../../src/actors/ActorRolling.js";
import { RollRequest } from "../../src/actors/RollRequest.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";
import { FakeStonetopCharacter } from "../fakes/FakeStonetopCharacter.js";
import { FakeRoll } from "../fakes/foundry/FakeRoll.js";
import { FakeDiceTerm } from "../fakes/foundry/FakeDiceTerm.js";
import { FakeChatMessage } from "../fakes/foundry/FakeChatMessage.js";
import { FakeRollModeDialog } from "../fakes/FakeRollModeDialog.js";
import { RollChoice, RollRule } from "../../src/actors/RollPrompt.js";
import { RollableStat } from "../../src/actors/RollableStat.js";
import { RollModeNote, RollModeNotes } from "../../src/model/snapshot/steading/RollModeNote.js";
import { FormulaRollCard } from "../../src/model/snapshot/FormulaRollCard.js";
import { AppliedStepRoll } from "../../src/model/data/steading/AppliedStepRoll.js";

// -- helpers -------------------------------------------------------------------

function makeRolling({ die, bonuses = {}, dialog = new FakeRollModeDialog() } = {}) {
	const actor = new FakeCharacterActorBuilder().withDamage(die).build();
	actor.typedActor = new FakeStonetopCharacter();
	for (const [stat, bonus] of Object.entries(bonuses)) {
		actor.typedActor.withBonus(stat, bonus);
	}
	return new ActorRolling(actor, dialog);
}

// A one-die roll that totalled something other than its die — the shape every formula roll has once
// a rating is added to it.
function formulaRoll(die, total) {
	return { dice: [FakeDiceTerm.kept([die], 4)], total };
}

function statRequest(stat, rollMode = "normal") {
	return RollRequest.fromStat(stat, rollMode);
}

// -- setup ---------------------------------------------------------------------

beforeEach(() => {
	FakeRoll.reset();
	FakeChatMessage.reset();
	vi.stubGlobal("Roll", FakeRoll);
	vi.stubGlobal("ChatMessage", FakeChatMessage);
	vi.stubGlobal("game", {i18n: {localize: k => k}});
	// Card-aware renderTemplate stub: flatten the card's text + dice so content assertions hold
	// without a real Handlebars render. The template itself is exercised by Foundry.
	foundry.applications.handlebars.renderTemplate = async (_path, d) => [
		d.name ?? "",
		d.description ? d.description.render() : "",
		d.resultText ? d.resultText.render() : "",
		...(d.results ?? []).map(r => `${r.label} ${r.text.render()}`),
		d.dice ? d.dice.rolls.map(r => r.result).join(",") : "",
		d.dice?.formula ?? "",
		d.dice?.mod ?? "",
		d.applied ? d.applied.labelKey : "",
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

// -- formula rolls -------------------------------------------------------------

// Not every roll a move calls for is a 2d6 landing on 10+/7-9/6-. Winter's Seasons Change opens by
// rolling 1d4+Population to see what the season costs, and the answer is a NUMBER: read as a move
// result, a 10 that means ten Surplus gone would come back "success".
//
// Rolling and reporting are two calls, because what the roll DID belongs on the card and is not
// known until the caller has applied it.
describe("ActorRolling.evaluateFormula", () => {
	it("rolls exactly the formula it is handed", async () => {
		await makeRolling().evaluateFormula("1d4 + 2");
		expect(FakeRoll.lastInstance.formula).toBe("1d4 + 2");
	});

	it("hands back the evaluated roll, so the caller can move what it came to", async () => {
		FakeRoll.setNextTotal(5);
		expect((await makeRolling().evaluateFormula("1d4 + 2")).total).toBe(5);
	});

	it("posts nothing on its own", async () => {
		await makeRolling().evaluateFormula("1d4 + 2");
		expect(FakeChatMessage.lastCreated).toBeNull();
	});
});

describe("ActorRolling.postFormulaCard", () => {
	const card = (over = {}) => new FormulaRollCard({
		name: "Winter — Consumption", roll: formulaRoll(1, 0), formula: "1d4 + Population", ...over,
	});

	it("posts a card titled by what the season did", async () => {
		await makeRolling().postFormulaCard(card());
		expect(FakeChatMessage.lastCreated.content).toContain("Winter — Consumption");
	});

	// The rating is named on the formula line; the dice row carries what it came to. Between them a
	// 1 that totalled 0 is accounted for, which is exactly what the card used to leave out.
	it("states the formula it was named with", async () => {
		await makeRolling().postFormulaCard(card());
		expect(FakeChatMessage.lastCreated.content).toContain("1d4 + Population");
	});

	it("states the modifier the dice did not account for", async () => {
		await makeRolling().postFormulaCard(card());
		expect(FakeChatMessage.lastCreated.content).toContain("-1");
	});

	// No tiers on the card: there is no 10+/7-9/6- to report, and a badge saying one would be
	// reading a quantity as an outcome.
	it("reports no result tier", async () => {
		await makeRolling().postFormulaCard(card({ formula: null }));
		expect(FakeChatMessage.lastCreated.content).not.toContain("stonetop.roll.outcome");
	});

	it("sends the roll along with the message, so the dice animate", async () => {
		await makeRolling().postFormulaCard(card());
		expect(FakeChatMessage.lastCreated.rolls).toHaveLength(1);
	});

	// The record the step keeps of what it moved — the card says it in the same words the sheet does.
	it("says what the roll did, where the caller applied it", async () => {
		const applied = new AppliedStepRoll({ total: 3, from: 5, to: 2 });
		await makeRolling().postFormulaCard(card({ applied }));
		expect(FakeChatMessage.lastCreated.content).toContain(applied.labelKey);
	});

	it("says nothing about what it did when it moved nothing", async () => {
		await makeRolling().postFormulaCard(card());
		expect(FakeChatMessage.lastCreated.content).not.toContain("applied");
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

// -- execute — asking for the mode ---------------------------------------------

// Every 2d6 roll asks Advantage, Normal or Disadvantage — unless the request already carries a mode,
// which is what a shift-click sends: Normal, straight away.

describe("ActorRolling.execute — asking for the mode", () => {
	const ask = stat => RollRequest.fromStat(stat, null);

	it("asks when the request names no mode, and rolls the mode picked", async () => {
		const dialog = new FakeRollModeDialog().answer(new RollChoice(null, "adv"));
		await makeRolling({bonuses: {wis: 1}, dialog}).execute(ask("wis"));
		expect(dialog.prompts).toHaveLength(1);
		expect(FakeRoll.lastInstance.formula).toBe("3d6kh2 + 1");
	});

	it("rolls without asking when the request carries a mode", async () => {
		const dialog = new FakeRollModeDialog();
		await makeRolling({bonuses: {wis: 1}, dialog}).execute(statRequest("wis", "normal"));
		expect(dialog.prompts).toHaveLength(0);
		expect(FakeRoll.lastInstance.formula).toBe("2d6 + 1");
	});

	it("rolls nothing when the dialog is dismissed", async () => {
		const rolling = makeRolling({bonuses: {wis: 1}});
		await rolling.execute(ask("wis"));
		expect(FakeRoll.lastInstance).toBeNull();
		expect(FakeChatMessage.lastCreated).toBeNull();
		expect(rolling._actor.typedActor.outcomes).toEqual([]);
	});

	it("is titled by what is rolled, and shows the stat with its value", async () => {
		const dialog = new FakeRollModeDialog();
		const rolling = makeRolling({bonuses: {wis: 1}, dialog});
		rolling._actor.typedActor.getRollableStats = () => [new RollableStat("wis", "Wisdom", 1, "WIS")];
		await rolling.execute(ask("wis"));
		expect(dialog.lastPrompt.title).toBe("WIS");
		expect(dialog.lastPrompt.stat).toEqual(new RollableStat("wis", "Wisdom", 1, "WIS"));
		expect(dialog.lastPrompt.choosesStat).toBe(false);
	});

	// A rating that is not one of the actor's own — a character rolling the steading's Fortunes for
	// Requisition — is still shown, by the name the chat card gives it.
	it("shows a rating the actor borrows by its key", async () => {
		const dialog = new FakeRollModeDialog();
		await makeRolling({bonuses: {fortunes: 2}, dialog}).execute(ask("fortunes"));
		expect(dialog.lastPrompt.stat).toEqual(new RollableStat("fortunes", "FORTUNES", 2));
	});

	it("shows no stat for a bare 2d6", async () => {
		const dialog = new FakeRollModeDialog();
		await makeRolling({dialog}).execute(ask("prompt"));
		expect(dialog.lastPrompt.stat).toBeNull();
	});

	it("hands the dialog the move's reminders and the rule", async () => {
		const dialog = new FakeRollModeDialog();
		const rolling = makeRolling({bonuses: {fortunes: 0}, dialog});
		const notes = new RollModeNotes([new RollModeNote({ mode: "adv", source: "Township" })]);
		rolling._actor.typedActor.notesBySlug.set("muster", notes);
		rolling._actor.typedActor.rule = new RollRule("advantage-disadvantage", "Advantage/Disadvantage");
		await rolling.execute(RollRequest.fromItem({ name: "Muster", system: { rollStat: "fortunes", slug: "muster" } }, null, null));
		expect(dialog.lastPrompt.notes).toBe(notes);
		expect(dialog.lastPrompt.rule).toBe(rolling._actor.typedActor.rule);
	});

	// The heading's second line: whose roll it is, with the note the Actors sidebar shows beside them.
	it("says who is rolling", async () => {
		const dialog = new FakeRollModeDialog();
		const rolling = makeRolling({bonuses: {wis: 1}, dialog});
		rolling._actor.name = "Maelen";
		rolling._actor.typedActor.directoryNote = "The Seeker";
		await rolling.execute(ask("wis"));
		expect(dialog.lastPrompt.rollerName).toBe("Maelen");
		expect(dialog.lastPrompt.rollerNote).toBe("The Seeker");
	});

	it("opens the rule through the actor that rolled", async () => {
		const dialog = new FakeRollModeDialog();
		const rolling = makeRolling({bonuses: {wis: 1}, dialog});
		await rolling.execute(ask("wis"));
		await dialog.options.openRule("advantage-disadvantage");
		expect(rolling._actor.typedActor.opened).toEqual(["advantage-disadvantage"]);
	});

	// A debility is not a choice: it bends whatever was picked, as it bent the sheet's mode before.
	it("lets the actor's debilities bend the mode picked", async () => {
		const dialog = new FakeRollModeDialog().answer(new RollChoice(null, "adv"));
		const rolling = makeRolling({bonuses: {str: 0}, dialog});
		rolling._actor.typedActor.applyRollMode = (stat, mode) => (mode === "adv" ? "normal" : "dis");
		await rolling.execute(ask("str"));
		expect(FakeRoll.lastInstance.formula).toBe("2d6 + 0");
	});

	// Nothing to ask about: a damage die takes no advantage, and a move with no rating posts its text.
	it("does not ask for a damage roll", async () => {
		const dialog = new FakeRollModeDialog();
		await makeRolling({die: "d6", dialog}).execute(ask("damage"));
		expect(dialog.prompts).toHaveLength(0);
	});

	it("does not ask for a move it cannot roll", async () => {
		const dialog = new FakeRollModeDialog();
		await makeRolling({dialog}).execute(ask("loyalty"));
		expect(dialog.prompts).toHaveLength(0);
		expect(FakeChatMessage.lastCreated.content).toContain("LOYALTY");
	});

	it("does not ask when only posting the move's text", async () => {
		const dialog = new FakeRollModeDialog();
		await makeRolling({bonuses: {wis: 1}, dialog}).execute(ask("wis"), {descriptionOnly: true});
		expect(dialog.prompts).toHaveLength(0);
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

// -- execute — ask stat --------------------------------------------------------

// A move that rolls "ask" names no stat: the dialog offers the actor's rollable stats as well as the
// modes, and asks even when the request carries a mode, since a shift-click cannot pick the stat.

describe("ActorRolling.execute — ask stat", () => {
	function makeAskRolling(bonuses, choice) {
		const dialog = new FakeRollModeDialog().answer(choice);
		const rolling = makeRolling({bonuses, dialog});
		rolling._actor.typedActor.getRollableStats = () =>
			Object.entries(bonuses).map(([k, v]) => new RollableStat(k, k.toUpperCase(), v));
		return { rolling, dialog };
	}

	it("offers every rollable stat to choose from", async () => {
		const { rolling, dialog } = makeAskRolling({str: 1, dex: 0}, null);
		await rolling.execute(RollRequest.fromStat("ask", null));
		expect(dialog.lastPrompt.choosesStat).toBe(true);
		expect(dialog.lastPrompt.choices.map(s => s.key)).toEqual(["str", "dex"]);
	});

	it("rolls the stat and the mode picked", async () => {
		const { rolling } = makeAskRolling({str: 1, dex: 0}, new RollChoice("str", "adv"));
		await rolling.execute(RollRequest.fromStat("ask", null));
		expect(FakeRoll.lastInstance.formula).toBe("3d6kh2 + 1");
	});

	it("asks even when the request carries a mode", async () => {
		const { rolling, dialog } = makeAskRolling({str: 1}, new RollChoice("str", "dis"));
		await rolling.execute(RollRequest.fromStat("ask", "normal"));
		expect(dialog.prompts).toHaveLength(1);
		expect(FakeRoll.lastInstance.formula).toBe("3d6kl2 + 1");
	});

	it("names the stat picked on the chat card", async () => {
		const { rolling } = makeAskRolling({str: 1}, new RollChoice("str", "normal"));
		await rolling.execute(RollRequest.fromStat("ask", null));
		expect(FakeChatMessage.lastCreated.content).toContain("(STR)");
	});

	it("aborts without rolling when the dialog is closed", async () => {
		const { rolling } = makeAskRolling({str: 1}, null);
		await rolling.execute(RollRequest.fromStat("ask", null));
		expect(FakeRoll.lastInstance).toBeNull();
	});
});

// -- execute — XP on a miss ------------------------------------------------------

// Every move roll hands the tier it landed in back to the actor that made it, because a sheet can
// have something waiting on it — the steading keeps its own Seasons Change result so the season box
// can light the row the dice landed on. Offered from here rather than from each roll site: the die
// on a move row, the die in the season box and the turn's own rollItem are three paths to one roll.
describe("ActorRolling.execute — the tier it landed in", () => {
	const moveRequest = slug => RollRequest.fromItem({
		name: "Seasons Change: Winter",
		system: { rollStat: "fortunes", slug, description: "", moveResults: null },
	}, null, "normal");

	it("hands the actor the move and the tier it rolled", async () => {
		const rolling = makeRolling({ bonuses: { fortunes: 0 } });
		FakeRoll.setNextTotal(8);
		await rolling.execute(moveRequest("seasons-change-winter"));
		expect(rolling._actor.typedActor.outcomes).toEqual([
			{ moveSlug: "seasons-change-winter", outcome: expect.objectContaining({ key: "partial" }) },
		]);
	});

	it("offers a bare rating roll too, with no move to name", async () => {
		const rolling = makeRolling({ bonuses: { str: 0 } });
		FakeRoll.setNextTotal(12);
		await rolling.execute(statRequest("str"));
		expect(rolling._actor.typedActor.outcomes).toEqual([
			{ moveSlug: null, outcome: expect.objectContaining({ key: "success" }) },
		]);
	});

	// A roll that never happened has no tier to offer: a move with no rating rolls nothing and posts
	// its text instead.
	it("offers nothing where nothing was rolled", async () => {
		const rolling = makeRolling();
		await rolling.execute(statRequest("loyalty"));
		expect(rolling._actor.typedActor.outcomes).toEqual([]);
	});
});

describe("ActorRolling.execute — XP on a 6-", () => {
	function moveRequest({ xpOnMiss } = {}) {
		return RollRequest.fromItem({
			name: "Defy Danger",
			system: { rollStat: "str", description: "", moveResults: null, ...(xpOnMiss === undefined ? {} : { xpOnMiss }) },
		}, null, "normal");
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
