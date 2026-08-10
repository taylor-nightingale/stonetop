import { describe, it, expect } from "vitest";
import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";
import { ChoiceTarget } from "../../../src/actors/character/ChoiceTarget.js";
import { SEASONAL_GAINS_GROUP } from "../../../src/model/data/steading/SeasonalGains.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";
import { FakeSteadingImprovementRepository } from "../../fakes/FakeSteadingImprovementRepository.js";
import { steadingRepos } from "../../fakes/FakeSteadingRepos.js";

// The steading answers the same four choice methods the character does, so one shared wiring drives
// either sheet. Each context lands in its own store — that is what the registry is for.

function build() {
	const actor = new FakeSteadingBuilder().build();
	const improvements = new FakeSteadingImprovementRepository()
		.withImprovement("palisade", { slug: "palisade", list: [{ slug: "built", track: { max: 2 } }] });
	return { actor, steading: new StonetopSteading(actor, steadingRepos({ improvements })) };
}

const gain = key => new ChoiceTarget({
	context: "steading", group: SEASONAL_GAINS_GROUP, option: key, siblingsCsv: "tor,news",
});
const improvementTrack = () => new ChoiceTarget({ context: "improvement", group: "palisade", option: "built" });

describe("StonetopSteading choice routing", () => {
	it("sends a steading pick to the steading's own values", async () => {
		const { actor, steading } = build();
		await steading.setChoicePickFor(gain("tor"), true);
		expect(actor.system.choiceValues[SEASONAL_GAINS_GROUP].tor).toBe(1);
	});

	// Separate stores: an improvement's track must not land in the steading's choice values.
	it("sends an improvement track to improvementValues, not choiceValues", async () => {
		const { actor, steading } = build();
		await steading.setChoiceTrackFor(improvementTrack(), "1", true);
		expect(actor.system.improvementValues.palisade.built).toBe(2);
		expect(actor.system.choiceValues.palisade).toBeUndefined();
	});

	it("unchecking a track pip empties back to it", async () => {
		const { actor, steading } = build();
		await steading.setChoiceTrackFor(improvementTrack(), "1", true);
		await steading.setChoiceTrackFor(improvementTrack(), "1", false);
		expect(actor.system.improvementValues.palisade.built).toBe(1);
	});

	it("writes free text through the same routing", async () => {
		const { actor, steading } = build();
		await steading.setChoiceTextFor(gain("news"), "a trader from Marshedge");
		expect(actor.system.choiceValues[SEASONAL_GAINS_GROUP].news).toBe("a trader from Marshedge");
	});

	describe("clearing a pick", () => {
		it("releases the option outright", async () => {
			const { actor, steading } = build();
			await steading.setChoicePickFor(gain("tor"), true);
			await steading.clearChoicePickFor(gain("tor"));
			expect(actor.system.choiceValues[SEASONAL_GAINS_GROUP].tor).toBe(0);
		});

		// setChoicePickFor(target, false) can't do this for a pick-1 row — it routes through
		// selectOption and re-selects.
		it("succeeds where unchecking the pick would have re-selected it", async () => {
			const { actor, steading } = build();
			await steading.setChoicePickFor(gain("tor"), true);
			await steading.setChoicePickFor(gain("tor"), false);
			expect(actor.system.choiceValues[SEASONAL_GAINS_GROUP].tor).toBe(1);   // still picked

			await steading.clearChoicePickFor(gain("tor"));
			expect(actor.system.choiceValues[SEASONAL_GAINS_GROUP].tor).toBe(0);
		});
	});

	// "Nothing to write" is a normal answer, not an error — the row simply isn't ours.
	it("ignores a row rendered for a context the steading does not register", async () => {
		const { actor, steading } = build();
		await steading.setChoicePickFor(new ChoiceTarget({ context: "arcana", group: "g", option: "o" }), true);
		expect(actor.system.choiceValues).toEqual({});
	});
});
