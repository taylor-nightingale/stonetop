import { describe, it, expect } from "vitest";
import { Advancement } from "../../../../src/model/data/character/Advancement.js";
import { LevelUpProcedure } from "../../../../src/model/data/character/LevelUpProcedure.js";
import { MoveBullets } from "../../../../src/model/snapshot/character/MoveBullets.js";
import {
	AdvanceRow, ChooseMoveRow, InvocationRow, LevelUpSnapshotBuilder, ReviewRow, StockRow,
} from "../../../../src/model/snapshot/character/LevelUpSnapshot.js";

const stepOf = raw => LevelUpProcedure.from([raw], MoveBullets.from("- The move's own words.")).steps[0];

describe("AdvanceRow", () => {
	const step = stepOf({ kind: "spend" });

	it("states what the press costs and what it buys", () => {
		const row = new AdvanceRow(step, new Advancement(5, 19));
		expect(row.cost).toBe(16);
		expect(row.xpBefore).toBe(19);
		expect(row.xpAfter).toBe(3);
		expect(row.from).toBe(5);
		expect(row.to).toBe(6);
	});

	// The book states the threshold as "6 + twice your current level"; the XP track has already
	// printed the answer as 19 / 16, so this row names itself rather than quoting the sum.
	it("names itself rather than quoting the move's bullet", () => {
		const row = new AdvanceRow(step, new Advancement(5, 19));
		expect(row.labelKey).toBe("stonetop.character.levelUp.advanceStep");
		expect(row.text).toBeNull();
	});

	it("carries the one control while there is a level to buy", () => {
		const row = new AdvanceRow(step, new Advancement(5, 19));
		expect(row.done).toBe(false);
		expect(row.hasControl).toBe(true);
		expect(row.hasFigure).toBe(true);
	});

	// Pressing it again would spend XP the character no longer owes and hand them a second level;
	// its figures would describe that next level-up rather than the one just taken.
	it("drops the control and its figures once there is no level left to buy", () => {
		const row = new AdvanceRow(step, new Advancement(6, 3));
		expect(row.done).toBe(true);
		expect(row.hasControl).toBe(false);
		expect(row.hasFigure).toBe(false);
	});
});

describe("ChooseMoveRow", () => {
	const step = stepOf({ kind: "chooseMove", tab: "moves" });

	it("expects one chosen move per level gained", () => {
		const row = new ChooseMoveRow(step, new Advancement(5, 0), 4);
		expect(row.expected).toBe(4);
		expect(row.done).toBe(true);
		expect(row.behind).toBe(0);
	});

	it("is owed while the count is behind the level", () => {
		const row = new ChooseMoveRow(step, new Advancement(6, 3), 4);
		expect(row.done).toBe(false);
		expect(row.behind).toBe(1);
		expect(row.isOwed).toBe(true);
	});

	it("reads as done when a GM granted more than the level called for", () => {
		expect(new ChooseMoveRow(step, new Advancement(5, 0), 7).done).toBe(true);
	});

	it("points at the tab that answers it", () => {
		expect(new ChooseMoveRow(step, new Advancement(5, 0), 0).tab).toBe("moves");
		expect(new ChooseMoveRow(step, new Advancement(5, 0), 0).tabLabelKey).toBe("stonetop.sheet.tabs.moves");
	});

	it("speaks the move's own words, with no label of its own", () => {
		const row = new ChooseMoveRow(step, new Advancement(5, 0), 0);
		expect(row.text.raw).toBe("The move's own words.");
		expect(row.labelKey).toBeNull();
	});
});

describe("StockRow", () => {
	const step = stepOf({ kind: "stock", possession: "sacred-pouch" });

	it("states the rise the possession's own scaling will produce", () => {
		const row = new StockRow(step, 2, 3);
		expect(row.changed).toBe(true);
		expect(row.isAutomatic).toBe(true);
	});

	it("is never owed and never pending — the sheet has already applied it", () => {
		const row = new StockRow(step, 3, 3);
		expect(row.changed).toBe(false);
		expect(row.done).toBe(true);
		expect(row.isOwed).toBe(false);
	});
});

describe("InvocationRow", () => {
	const step = stepOf({
		kind: "invocation", insert: "lightbearer-invocations-insert",
		group: "lightbearer-invocations", startsKnowing: 2,
	});

	it("counts the two you start with plus one per even level", () => {
		expect(new InvocationRow(step, new Advancement(5, 0), 4).expected).toBe(4);
		expect(new InvocationRow(step, new Advancement(6, 0), 4).expected).toBe(5);
	});

	it("is owed once the level has been taken and the Invocation has not", () => {
		const row = new InvocationRow(step, new Advancement(6, 3), 4);
		expect(row.done).toBe(false);
		expect(row.behind).toBe(1);
		expect(row.isOwed).toBe(true);
	});

	it("points at the insert's own tab, named by the insert", () => {
		const row = new InvocationRow(step, new Advancement(6, 3), 4, "Invocations");
		expect(row.tab).toBe("insert-lightbearer-invocations-insert");
		expect(row.tabLabelKey).toBeNull();
		expect(row.tabLabel).toBe("Invocations");
	});
});

describe("ReviewRow", () => {
	it("never ticks and is never owed — nothing records that a review happened", () => {
		const row = new ReviewRow(stepOf({ kind: "review", tab: "playbook" }));
		expect(row.done).toBe(false);
		expect(row.isOwed).toBe(false);
		expect(row.tab).toBe("playbook");
	});
});

describe("LevelUpSnapshot", () => {
	const advancement = new Advancement(6, 3);
	const chooseMove  = new ChooseMoveRow(stepOf({ kind: "chooseMove" }), advancement, 4);
	const review      = new ReviewRow(stepOf({ kind: "review" }));

	const snapshot = ({ rows, isReady }) => new LevelUpSnapshotBuilder()
		.withRows(rows).withIsReady(isReady).build();

	it("collects the steps still owed", () => {
		expect(snapshot({ rows: [chooseMove, review], isReady: false }).owed).toEqual([chooseMove]);
	});

	it("is offered while the move has triggered", () => {
		const done = new ChooseMoveRow(stepOf({ kind: "chooseMove" }), advancement, 9);
		expect(snapshot({ rows: [done, review], isReady: true }).isOffered).toBe(true);
	});

	it("stays offered after the XP is spent while something is outstanding", () => {
		expect(snapshot({ rows: [chooseMove, review], isReady: false }).isOffered).toBe(true);
	});

	it("is silent when the move has not triggered and nothing is owed", () => {
		const done = new ChooseMoveRow(stepOf({ kind: "chooseMove" }), advancement, 9);
		expect(snapshot({ rows: [done, review], isReady: false }).isOffered).toBe(false);
	});

	it("is silent for a move that carries no procedure", () => {
		expect(snapshot({ rows: [], isReady: true }).isOffered).toBe(false);
	});
});
