import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { ActorRolling } from "../../../src/actors/ActorRolling.js";
import { RollRequest } from "../../../src/actors/RollRequest.js";
import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";
import { FakeRoll } from "../../fakes/foundry/FakeRoll.js";
import { FakeChatMessage } from "../../fakes/foundry/FakeChatMessage.js";
import { FakeDialog } from "../../fakes/foundry/FakeDialog.js";
import { steadingRepos } from "../../fakes/FakeSteadingRepos.js";

// End-to-end: a real StonetopSteading resolves the bonus, ActorRolling builds the formula.
// Locks the off-by-one fix at the boundary that actually matters — the dice formula the player rolls.

function makeRolling() {
	const actor = new FakeSteadingBuilder().build();
	actor.getRollData = () => ({});
	actor.typedActor = new StonetopSteading(actor, steadingRepos({ improvements: { getAll: async () => [] }, moves: new FakeMoveRepository() }));
	return new ActorRolling(actor);
}

beforeEach(() => {
	FakeRoll.reset();
	FakeChatMessage.reset();
	FakeDialog.reset();
	vi.stubGlobal("Roll", FakeRoll);
	vi.stubGlobal("ChatMessage", FakeChatMessage);
	vi.stubGlobal("Dialog", FakeDialog);
	vi.stubGlobal("game", { i18n: { localize: k => k } });
	foundry.applications.handlebars.renderTemplate = async () => "";
});

afterEach(() => {
	vi.unstubAllGlobals();
	foundry.applications.handlebars.renderTemplate = async () => "";
});

describe("Steading roll — attribute bonus (integration)", () => {
	it("rolls population index 1 as +0, not +1", async () => {
		const rolling = makeRolling();
		await rolling.execute(RollRequest.fromStat("population", "normal"));
		expect(FakeRoll.lastInstance.formula).toBe("2d6 + 0");
	});

	it("rolls fortunes index 2 as +1, not +2", async () => {
		const rolling = makeRolling();
		await rolling.execute(RollRequest.fromStat("fortunes", "normal"));
		expect(FakeRoll.lastInstance.formula).toBe("2d6 + 1");
	});

	it("reflects a raised prosperity value in the formula (+3)", async () => {
		const rolling = makeRolling();
		await rolling._actor.typedActor.setAttribute("prosperity", 3);
		await rolling.execute(RollRequest.fromStat("prosperity", "normal"));
		expect(FakeRoll.lastInstance.formula).toBe("2d6 + 3");
	});

	// The book: while the steading is *lacking*, treat Prosperity as 1 lower. The rule lives on the
	// steading, so it reaches the dice without any caller applying it.
	it("rolls a lacking steading's prosperity 1 lower", async () => {
		const rolling = makeRolling();
		await rolling._actor.typedActor.setAttribute("prosperity", 2);
		await rolling._actor.typedActor.setDebility("lacking", true);
		await rolling.execute(RollRequest.fromStat("prosperity", "normal"));
		expect(FakeRoll.lastInstance.formula).toBe("2d6 + 1");
	});

	it("leaves the other ratings alone while lacking", async () => {
		const rolling = makeRolling();
		await rolling._actor.typedActor.setDebility("lacking", true);
		await rolling.execute(RollRequest.fromStat("fortunes", "normal"));
		expect(FakeRoll.lastInstance.formula).toBe("2d6 + 1");
	});

	it("reflects a lowered defenses value in the formula (-1)", async () => {
		const rolling = makeRolling();
		await rolling._actor.typedActor.setAttribute("defenses", -1);
		await rolling.execute(RollRequest.fromStat("defenses", "normal"));
		expect(FakeRoll.lastInstance.formula).toBe("2d6 + -1");
	});
});

// The book: while the steading is *diminished*, roll Deploy, Muster and Pull Together at
// disadvantage. Driven off the REAL pack moves, so the rule keys off the slug those moves actually
// ship with — a renamed or re-slugged move would fail here rather than silently stop being hindered.
const homefrontMove = slug =>
	JSON.parse(readFileSync(new URL(`../../../packs/src/moves/homefront/${slug}.json`, import.meta.url)));

describe("Steading roll — diminished (integration)", () => {
	async function diminishedRolling() {
		const rolling = makeRolling();
		await rolling._actor.typedActor.setDebility("diminished", true);
		return rolling;
	}

	it("rolls Deploy at disadvantage", async () => {
		const rolling = await diminishedRolling();
		await rolling.execute(RollRequest.fromItem(homefrontMove("deploy"), null, "normal"));
		expect(FakeRoll.lastInstance.formula).toBe("3d6kl2 + 0");
	});

	it("rolls Muster at disadvantage", async () => {
		const rolling = await diminishedRolling();
		await rolling.execute(RollRequest.fromItem(homefrontMove("muster"), null, "normal"));
		expect(FakeRoll.lastInstance.formula).toBe("3d6kl2 + 0");
	});

	it("rolls Pull Together at disadvantage", async () => {
		const rolling = await diminishedRolling();
		await rolling.execute(RollRequest.fromItem(homefrontMove("pull-together"), null, "normal"));
		expect(FakeRoll.lastInstance.formula).toBe("3d6kl2 + 0");
	});

	it("cancels advantage on Deploy instead of compounding it", async () => {
		const rolling = await diminishedRolling();
		await rolling.execute(RollRequest.fromItem(homefrontMove("deploy"), null, "adv"));
		expect(FakeRoll.lastInstance.formula).toBe("2d6 + 0");
	});

	it("leaves Trade & Barter alone — diminished names three moves, not a rating", async () => {
		const rolling = await diminishedRolling();
		await rolling.execute(RollRequest.fromItem(homefrontMove("trade-and-barter"), null, "normal"));
		expect(FakeRoll.lastInstance.formula).toBe("2d6 + 0");
	});

	it("leaves a bare Population roll alone", async () => {
		const rolling = await diminishedRolling();
		await rolling.execute(RollRequest.fromStat("population", "normal"));
		expect(FakeRoll.lastInstance.formula).toBe("2d6 + 0");
	});

	it("rolls Deploy normally once diminished is cleared", async () => {
		const rolling = await diminishedRolling();
		await rolling._actor.typedActor.setDebility("diminished", false);
		await rolling.execute(RollRequest.fromItem(homefrontMove("deploy"), null, "normal"));
		expect(FakeRoll.lastInstance.formula).toBe("2d6 + 0");
	});
});
