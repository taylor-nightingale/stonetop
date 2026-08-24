import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { ActorRolling } from "../../../src/actors/ActorRolling.js";
import { RollRequest } from "../../../src/actors/RollRequest.js";
import { StonetopCharacter } from "../../../src/actors/character/StonetopCharacter.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakeRepositoryFactory } from "../../fakes/FakeRepositoryFactory.js";
import { FakeRoll } from "../../fakes/foundry/FakeRoll.js";
import { FakeChatMessage } from "../../fakes/foundry/FakeChatMessage.js";
import { FakeDialog } from "../../fakes/foundry/FakeDialog.js";

// End-to-end for a move that rolls a track rather than a stat: the SHIPPED Dark Succor and Favor
// pack items on a real StonetopCharacter carrying the Thrall insert. The insert names the `favor`
// move, that move carries the track, and Dark Succor's rollStat points at it — a break in any of
// those three lands here.

let darkSuccor, favorMove, thrallInsert;

const _read = async (rel) => JSON.parse(await fs.readFile(path.join(process.cwd(), "packs/src", rel), "utf8"));

beforeEach(async () => {
	darkSuccor   ??= await _read("moves/post-death/thrall/dark-succor.json");
	favorMove    ??= await _read("moves/post-death/thrall/favor.json");
	thrallInsert ??= await _read("inserts/thrall.json");
	FakeRoll.reset();
	FakeChatMessage.reset();
	FakeDialog.reset();
	vi.stubGlobal("Roll", FakeRoll);
	vi.stubGlobal("ChatMessage", FakeChatMessage);
	vi.stubGlobal("Dialog", FakeDialog);
	vi.stubGlobal("game", { i18n: { localize: k => k } });
	foundry.applications.handlebars.renderTemplate = async (_p, d) =>
		`${d.name ?? ""} | ${d.dice?.mod ?? ""}`;
});

afterEach(() => {
	vi.unstubAllGlobals();
	foundry.applications.handlebars.renderTemplate = async () => "";
});

// A character who died and called on a Thing Below: the insert, plus the moves it granted, embedded
// the way CharacterInserts embeds them.
function makeRolling({ withInsert = true } = {}) {
	const items = [
		{ ...favorMove, _id: "m-favor", system: { ...favorMove.system, categoryKey: "insert-thrall" } },
		{ ...darkSuccor, _id: "m-succor", system: { ...darkSuccor.system, categoryKey: "insert-thrall" } },
	];
	if (withInsert) items.unshift({ ...thrallInsert, _id: "i-thrall" });

	const actor = new FakeCharacterActorBuilder().withItems(items).build();
	actor.getRollData = () => ({});
	actor.typedActor  = new StonetopCharacter(actor, new FakeRepositoryFactory());
	return new ActorRolling(actor);
}

const rollDarkSuccor = (rolling) =>
	rolling.execute(RollRequest.fromItem(darkSuccor, null, "normal"));

describe("Dark Succor roll (integration)", () => {
	it("the shipped move rolls the Thrall's Favor track", () => {
		expect(darkSuccor.system.rollStat).toBe("favor");
		expect(thrallInsert.system.moves).toContain("favor");
		expect(favorMove.system.resource.title).toBe("Favor");
	});

	it("adds the current Favor to the roll", async () => {
		const rolling = makeRolling();
		await rolling._actor.typedActor.setMoveResourceCurrent("favor", 2);
		await rollDarkSuccor(rolling);
		expect(FakeRoll.lastInstance.formula).toBe("2d6 + 2");
	});

	// Favor starts at 0 and resets to 0 after this very move — +0 is a real roll, not a refusal.
	it("rolls +0 at empty Favor rather than posting the text", async () => {
		await rollDarkSuccor(makeRolling());
		expect(FakeRoll.lastInstance.formula).toBe("2d6 + 0");
	});

	it("names the track on the chat card", async () => {
		await rollDarkSuccor(makeRolling());
		const content = FakeChatMessage.lastCreated.content;
		expect(content).toContain("Dark Succor");
		expect(content).toContain("(FAVOR)");
	});

	// Without the insert nothing owns the track, so the move posts as text instead of rolling +0.
	it("posts the move text when the character has no Thrall insert", async () => {
		await rollDarkSuccor(makeRolling({ withInsert: false }));
		expect(FakeRoll.lastInstance).toBeNull();
		expect(FakeChatMessage.lastCreated).not.toBeNull();
	});
});
