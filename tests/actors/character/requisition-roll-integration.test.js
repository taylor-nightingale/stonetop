import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { ActorRolling } from "../../../src/actors/ActorRolling.js";
import { RollRequest } from "../../../src/actors/RollRequest.js";
import { StonetopCharacter } from "../../../src/actors/character/StonetopCharacter.js";
import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";
import { FoundrySteadingRepository } from "../../../src/actors/character/repositories/FoundrySteadingRepository.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakeRepositoryFactory } from "../../fakes/FakeRepositoryFactory.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";
import { FakeRoll } from "../../fakes/foundry/FakeRoll.js";
import { FakeChatMessage } from "../../fakes/foundry/FakeChatMessage.js";
import { FakeDialog } from "../../fakes/foundry/FakeDialog.js";
import { steadingRepos } from "../../fakes/FakeSteadingRepos.js";

// End-to-end for the one move that rolls a stat the character doesn't own: the SHIPPED Requisition
// pack item, a real StonetopCharacter, the real steading repository picking the world's steading,
// and a real StonetopSteading answering +Fortunes. Only Foundry itself is faked. A break anywhere in
// that chain — pack rollStat, repository lookup, the character's fall-through — lands here.

let requisition, forage;

const packMove = async (slug) => JSON.parse(await fs.readFile(
	path.join(process.cwd(), `packs/src/moves/expedition/${slug}.json`), "utf8"));

beforeEach(async () => {
	requisition ??= await packMove("requisition");
	forage      ??= await packMove("forage");
	FakeRoll.reset();
	FakeChatMessage.reset();
	FakeDialog.reset();
	vi.stubGlobal("Roll", FakeRoll);
	vi.stubGlobal("ChatMessage", FakeChatMessage);
	vi.stubGlobal("Dialog", FakeDialog);
	foundry.applications.handlebars.renderTemplate = async (_p, d) => d.name ?? "";
});

afterEach(() => {
	vi.unstubAllGlobals();
	foundry.applications.handlebars.renderTemplate = async () => "";
});

// A world holding `steadings`, seen through the same globals production reads.
function stubWorld(steadings) {
	vi.stubGlobal("game", {
		actors: steadings,
		i18n:   { localize: k => k },
	});
}

function makeSteadingActor({ name = "Stonetop", fortunes = 1, lacking = false } = {}) {
	const doc = { type: "steading", name, system: { attributes: { fortunes }, debilities: { lacking } } };
	doc.typedActor = new StonetopSteading(doc, steadingRepos({ improvements: { getAll: async () => [] }, moves: new FakeMoveRepository() }));
	return doc;
}

function makeRolling() {
	const actor = new FakeCharacterActorBuilder().build();
	actor.getRollData = () => ({});
	actor.typedActor = new StonetopCharacter(actor,
		new FakeRepositoryFactory({ steading: new FoundrySteadingRepository() }));
	return new ActorRolling(actor);
}

const rollRequisition = (rolling) =>
	rolling.execute(RollRequest.fromItem(requisition, null, "normal"));

describe("Requisition roll (integration)", () => {
	it("adds the steading's Fortunes to the character's roll", async () => {
		stubWorld([makeSteadingActor({ fortunes: 1 })]);
		await rollRequisition(makeRolling());
		expect(FakeRoll.lastInstance.formula).toBe("2d6 + 1");
	});

	it("carries a negative Fortunes rating into the formula", async () => {
		stubWorld([makeSteadingActor({ fortunes: -1 })]);
		await rollRequisition(makeRolling());
		expect(FakeRoll.lastInstance.formula).toBe("2d6 + -1");
	});

	// The lacking adjustment is Prosperity's alone — a lacking steading still requisitions at full
	// Fortunes.
	it("is unaffected by the lacking debility", async () => {
		stubWorld([makeSteadingActor({ fortunes: 1, lacking: true })]);
		await rollRequisition(makeRolling());
		expect(FakeRoll.lastInstance.formula).toBe("2d6 + 1");
	});

	it("names the stat on the chat card", async () => {
		stubWorld([makeSteadingActor()]);
		await rollRequisition(makeRolling());
		expect(FakeChatMessage.lastCreated.content).toContain("Requisition (+FORTUNES)");
	});

	it("rolls against the primary steading when strays are in the world", async () => {
		stubWorld([
			makeSteadingActor({ name: "New Steading", fortunes: 3 }),
			makeSteadingActor({ name: "Stonetop", fortunes: 1 }),
		]);
		await rollRequisition(makeRolling());
		expect(FakeRoll.lastInstance.formula).toBe("2d6 + 1");
	});

	// The move says "don't mark XP" on a 6-, so its pack data carries xpOnMiss: false and the card
	// must not offer the button it offers for every other missed move.
	it("offers no Mark XP on a miss", async () => {
		stubWorld([makeSteadingActor()]);
		FakeRoll.setNextTotal(5);
		await rollRequisition(makeRolling());
		expect(FakeChatMessage.lastCreated.flags?.stonetop?.xpMark).toBeUndefined();
	});

	// Control for the case above: an expedition move that doesn't say otherwise still offers it.
	it("still offers Mark XP on a missed Forage", async () => {
		stubWorld([makeSteadingActor()]);
		FakeRoll.setNextTotal(5);
		await makeRolling().execute(RollRequest.fromItem(forage, null, "normal"));
		expect(FakeChatMessage.lastCreated.flags.stonetop.xpMark).toEqual({ marked: false });
	});

	// No steading yet (a fresh world): nothing to roll against, so the move posts as text rather
	// than silently rolling +0.
	it("posts the move text instead of rolling when the world has no steading", async () => {
		stubWorld([]);
		await rollRequisition(makeRolling());
		expect(FakeRoll.lastInstance).toBeNull();
		expect(FakeChatMessage.lastCreated).not.toBeNull();
	});
});
