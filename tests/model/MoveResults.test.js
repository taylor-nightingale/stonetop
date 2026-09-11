import { describe, it, expect } from "vitest";
import { MoveResults, TIER_KEYS } from "../../src/model/data/MoveResults.js";
import { buildResultTiers } from "../../src/utils/rollCard.js";

// The move's three authored results, read by everything that prints them: the chat card, and the
// Seasons Change box, which draws them as the rows of the season's own roll. One class because the
// alternative was each surface keeping its own tier order and its own idea of what a row is — and
// winter's results being authored twice, once for the card and once for the box.

const raw = (over = {}) => ({
	success: { label: "10+", value: "The winter is relatively mild." },
	partial: { label: "7-9", value: "Consume additional Surplus equal to 1d4+Population." },
	failure: { label: "6-",  value: "As a 7-9, but also threats abound." },
	...over,
});

describe("MoveResults.fromRaw", () => {
	it("reads the tiers best first, whatever order they were authored in", () => {
		const results = MoveResults.fromRaw({
			failure: raw().failure, success: raw().success, partial: raw().partial,
		});
		expect(results.tiers.map(t => t.key)).toEqual(["success", "partial", "failure"]);
		expect(TIER_KEYS).toEqual(["success", "partial", "failure"]);
	});

	// The label is the move's own dice notation, not a constant here: a homebrew move that scores
	// itself differently says so on every surface at once.
	it("carries the move's own label and words", () => {
		const tier = MoveResults.fromRaw(raw()).byKey("partial");
		expect(tier.label).toBe("7-9");
		expect(tier.text.raw).toBe("Consume additional Surplus equal to 1d4+Population.");
	});

	// A homebrew move that authored no notation still gets a band with something in it — a blank
	// column beside a sentence reads as a row that failed to load.
	it("stands the tier's usual notation in for a move that authored none", () => {
		const results = MoveResults.fromRaw({
			success: { value: "a mild winter" },
			partial: { label: "7-9", value: "it costs you" },
		});
		expect(results.byKey("success").label).toBe("10+");
		expect(results.byKey("partial").label).toBe("7-9");
	});

	// A move that fills in only its 10+ has two empty results, not three: a blank row says the move
	// has something to say there and it is missing.
	it("drops a tier with no words", () => {
		const results = MoveResults.fromRaw(raw({ partial: { label: "7-9", value: "" } }));
		expect(results.tiers.map(t => t.key)).toEqual(["success", "failure"]);
		expect(results.byKey("partial")).toBeNull();
	});

	it("is null for a move with no results at all", () => {
		expect(MoveResults.fromRaw(null)).toBeNull();
		expect(MoveResults.fromRaw({ success: { label: "10+", value: "" } })).toBeNull();
	});
});

// The card reads the same class, so the rows it prints and the rows the season box draws are the
// same rows.
describe("the chat card's tiers", () => {
	it("are the move's results", () => {
		expect(buildResultTiers(raw()).map(t => [t.key, t.label, t.text.raw]))
			.toEqual(MoveResults.fromRaw(raw()).tiers.map(t => [t.key, t.label, t.text.raw]));
	});

	it("are null where the move has none, as the card's template expects", () => {
		expect(buildResultTiers(null)).toBeNull();
	});
});
