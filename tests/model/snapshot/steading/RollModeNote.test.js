import { describe, it, expect } from "vitest";
import { RollModeNote, RollModeNotes } from "../../../../src/model/snapshot/steading/RollModeNote.js";

const adv = (source, clause = null) => new RollModeNote({ mode: "adv", source, clause });
const dis = source => new RollModeNote({ mode: "dis", source, enforced: true });

describe("RollModeNote — one reminder", () => {
	// The roll-mode control's own key, so "Advantage" is not a second string for a word the sheet
	// already has.
	it("names its mode through the roll-mode control's key", () => {
		expect(adv("Township").modeKey).toBe("stonetop.rollMode.adv");
		expect(dis("diminished").modeKey).toBe("stonetop.rollMode.dis");
	});

	it("knows whether it waits on fiction", () => {
		expect(adv("Township").isConditional).toBe(false);
		expect(adv("Stone Wall", "when **_you take advantage of the stone wall_**").isConditional).toBe(true);
	});

	// The line has to say what CAN be done, not what is true: anything phrased as a fact about the row
	// reads as "advantage is already on", which is the whole reason this class exists.
	it("offers advantage rather than asserting it", () => {
		expect(adv("Township").verdictKey).toBe("stonetop.steading.rollNote.canApply");
	});

	// Not symmetrical, because the rules are not. SteadingRolls really does flip the die for a
	// debility, so "can be applied" would be the one untrue thing on the row.
	it("states an enforced hindrance as already applying", () => {
		expect(dis("diminished").verdictKey).toBe("stonetop.steading.rollNote.applies");
	});
});

describe("RollModeNotes — what a row states", () => {
	it("shows nothing where nothing speaks for the move", () => {
		expect(new RollModeNotes().isEmpty).toBe(true);
		expect(new RollModeNotes().all).toEqual([]);
	});

	// One line per SOURCE, never collapsed per mode: naming the improvement that permits it is what
	// makes the line an offer rather than a status, and that is only possible one source at a time.
	it("keeps one line per source", () => {
		const notes = new RollModeNotes([
			adv("Township"),
			adv("Trade with Barrier Pass", "you are trading for timber"),
			adv("Aetherium Crucible", "you are trading for aetherium"),
		]);
		expect(notes.all.map(n => n.source))
			.toEqual(["Township", "Trade with Barrier Pass", "Aetherium Crucible"]);
	});

	// Deploy can be permitted by the wall and hindered by *diminished* at the same time. Both are true
	// and the row says both — collapsing them would be the sheet deciding.
	it("keeps an entitlement and a hindrance side by side", () => {
		const notes = new RollModeNotes([dis("diminished"), adv("Stone Wall", "you use the wall")]);
		expect(notes.all.map(n => n.mode)).toEqual(["dis", "adv"]);
		expect(notes.all.map(n => n.verdictKey)).toEqual([
			"stonetop.steading.rollNote.applies",
			"stonetop.steading.rollNote.canApply",
		]);
	});
});
