import { describe, it, expect } from "vitest";
import {
	AdvanceStep, ChooseMoveStep, InvocationStep, LevelUpProcedure,
	ReviewStep, SpendStep, StockStep,
} from "../../../../src/model/data/character/LevelUpProcedure.js";
import { MoveBullets } from "../../../../src/model/snapshot/character/MoveBullets.js";

const ALL = [
	{ kind: "spend" }, { kind: "advance" }, { kind: "chooseMove" },
	{ kind: "stock" }, { kind: "invocation" }, { kind: "review" },
];

const bullets = (...lines) => MoveBullets.from(lines.map(l => `- ${l}`).join("\n"));
const SIX = bullets("One.", "Two.", "Three.", "Four.", "Five.", "Six.");

describe("LevelUpProcedure.from", () => {
	it("builds one step per authored kind, in order", () => {
		const procedure = LevelUpProcedure.from(ALL, SIX);
		expect(procedure.steps.map(s => s.kind)).toEqual(
			["spend", "advance", "chooseMove", "stock", "invocation", "review"]);
		expect(procedure.steps[0]).toBeInstanceOf(SpendStep);
		expect(procedure.steps[1]).toBeInstanceOf(AdvanceStep);
		expect(procedure.steps[2]).toBeInstanceOf(ChooseMoveStep);
		expect(procedure.steps[3]).toBeInstanceOf(StockStep);
		expect(procedure.steps[4]).toBeInstanceOf(InvocationStep);
		expect(procedure.steps[5]).toBeInstanceOf(ReviewStep);
	});

	it("drops a kind it cannot draw rather than rendering it blank", () => {
		const procedure = LevelUpProcedure.from([{ kind: "spend" }, { kind: "sacrifice-a-goat" }],
			bullets("One.", "Two."));
		expect(procedure.steps.map(s => s.kind)).toEqual(["spend"]);
	});

	it("is empty for a move that carries no procedure, inventing nothing", () => {
		expect(LevelUpProcedure.from().isEmpty).toBe(true);
		expect(LevelUpProcedure.from([], SIX).isEmpty).toBe(true);
		expect(LevelUpProcedure.from("not an array", SIX).isEmpty).toBe(true);
	});

	it("marks both even-level clauses, and nothing else", () => {
		const steps = LevelUpProcedure.from(
			[{ kind: "spend" }, { kind: "chooseMove" }, { kind: "stock" },
			 { kind: "invocation" }, { kind: "review" }],
			bullets("One.", "Two.", "Three.", "Four.", "Five.")).steps;
		expect(steps.filter(s => s.isEvenLevel).map(s => s.kind)).toEqual(["stock", "invocation"]);
	});

	it("reads what the stock step names rather than knowing which playbook is the Blessed", () => {
		const [step] = LevelUpProcedure.from([{ kind: "stock", possession: "sacred-pouch" }], bullets("One.")).steps;
		expect(step.possession).toBe("sacred-pouch");
		expect(step.isAutomatic).toBe(true);
	});

	it("reads the invocation step's insert, group and starting count", () => {
		const [step] = LevelUpProcedure.from([
			{ kind: "invocation", insert: "lightbearer-invocations-insert", group: "lightbearer-invocations", startsKnowing: 2 },
		], bullets("One.")).steps;
		expect(step.insert).toBe("lightbearer-invocations-insert");
		expect(step.group).toBe("lightbearer-invocations");
		expect(step.startsKnowing).toBe(2);
	});

	it("defaults a missing tab to the one that answers the step", () => {
		expect(LevelUpProcedure.from([{ kind: "chooseMove" }], bullets("x")).steps[0].tab).toBe("moves");
		expect(LevelUpProcedure.from([{ kind: "review" }], bullets("x")).steps[0].tab).toBe("playbook");
	});
});

// The words come from the move's own description rather than a second copy on the step, so a
// translator answers each sentence once. See LevelUpProcedure's own note for why.
describe("LevelUpProcedure — pairing steps with the move's own bullets", () => {
	it("gives each step the bullet in its position", () => {
		const steps = LevelUpProcedure.from(ALL, SIX).steps;
		expect(steps[2].text.raw).toBe("Three.");
		expect(steps[5].text.raw).toBe("Six.");
	});

	it("labels the advance row itself instead, since the book states it as a formula", () => {
		const [spend, advance] = LevelUpProcedure.from(ALL, SIX).steps;
		expect(spend.labelKey).toBe("stonetop.character.levelUp.advanceStep");
		expect(spend.text).toBeUndefined();
		expect(advance.text).toBeUndefined();
	});

	// A GM who edits a bullet out shifts every step below it onto the wrong sentence; a step with no
	// words still carries its figures and its controls, and does not misquote the book.
	it("pairs nothing at all when the counts disagree", () => {
		const steps = LevelUpProcedure.from(ALL, bullets("One.", "Two.", "Three.")).steps;
		expect(steps.map(s => s.text)).toEqual([undefined, undefined, null, null, null, null]);
	});

	it("pairs nothing when the description spells nothing out", () => {
		expect(LevelUpProcedure.from(ALL, []).steps[2].text).toBeNull();
		expect(LevelUpProcedure.from(ALL).steps[2].text).toBeNull();
	});
});
