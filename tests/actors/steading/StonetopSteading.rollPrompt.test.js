import { beforeEach, describe, expect, it, vi } from "vitest";
import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";
import { RollRule } from "../../../src/actors/RollPrompt.js";
import { RollModeNotes } from "../../../src/model/snapshot/steading/RollModeNote.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";
import { steadingRepos } from "../../fakes/FakeSteadingRepos.js";
import { fakeI18n } from "../../fakes/foundry/FakeI18n.js";

// What a steading's roll dialog shows beside the modes (ActorRolling#execute): the same reminders
// its move rows carry, and the rule.

const advantageMove = { _id: "adv-1", type: "move", name: "Advantage/Disadvantage", system: { slug: "advantage-disadvantage", moveType: "special" } };

const make = (moves = new FakeMoveRepository()) =>
	new StonetopSteading(new FakeSteadingBuilder().build(), steadingRepos({ moves }));

beforeEach(() => {
	vi.stubGlobal("game", { i18n: fakeI18n() });
});

describe("StonetopSteading.rollNotesFor", () => {
	it("carries the reminders the move's row carries", async () => {
		const steading = make();
		await steading.setDebility("diminished", true);
		const notes = await steading.rollNotesFor("muster");
		expect(notes).toBeInstanceOf(RollModeNotes);
		expect(notes.all.map(n => n.mode)).toEqual(["dis"]);
	});

	it("has none for a move nothing speaks for", async () => {
		const steading = make();
		await steading.setDebility("diminished", true);
		expect(await steading.rollNotesFor("seasons-change-winter")).toBeNull();
	});

	it("has none for a bare rating roll, which names no move", async () => {
		expect(await make().rollNotesFor(null)).toBeNull();
	});
});

describe("StonetopSteading.rollModeRule", () => {
	it("links the Advantage/Disadvantage move from the pack", async () => {
		const rule = await make(new FakeMoveRepository([], [advantageMove])).rollModeRule();
		expect(rule).toEqual(new RollRule("advantage-disadvantage", "Advantage/Disadvantage"));
	});

	it("links nothing when the move is nowhere to be found", async () => {
		expect(await make().rollModeRule()).toBeNull();
	});
});
