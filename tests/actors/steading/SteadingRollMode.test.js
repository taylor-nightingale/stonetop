import { describe, it, expect } from "vitest";
import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";
import { steadingRepos } from "../../fakes/FakeSteadingRepos.js";

/**
 * The steading's roll mode, and the trap it shared with the character's.
 *
 * Advantage is FORWARD in this family of games: you pick it, it applies to your next roll, and then
 * it is gone. Held as a flag that nothing ever cleared it behaved as neither forward nor ongoing —
 * set once, it bent every homefront roll after it, and the picker went on showing the right word for
 * a state nobody meant to still be in.
 *
 * The steading carries the same control as the character (one partial, both sheets), so it carries
 * the same fix. ActorRolling spends it through the typed actor, which is why both have the method.
 */
const make = () => new StonetopSteading(new FakeSteadingBuilder().build(), steadingRepos());

describe("StonetopSteading.clearRollMode", () => {
	it("gives the mode back to normal", async () => {
		const steading = make();
		await steading.setRollMode("adv");
		await steading.clearRollMode();
		expect(steading.rollMode).toBe("normal");
	});

	it("clears disadvantage too, not just advantage", async () => {
		const steading = make();
		await steading.setRollMode("dis");
		await steading.clearRollMode();
		expect(steading.rollMode).toBe("normal");
	});

	it("is idempotent", async () => {
		const steading = make();
		await steading.setRollMode("adv");
		await steading.clearRollMode();
		await steading.clearRollMode();
		expect(steading.rollMode).toBe("normal");
	});

	// A write per roll on a flag that already reads "normal" is a document update, and a document
	// update is a re-render on every client with the sheet open — for nothing. Most rolls are normal,
	// and a steading sheet is the one six people have open at once.
	it("writes nothing when the mode is already normal", async () => {
		const actor = new FakeSteadingBuilder().build();
		let writes = 0;
		const original = actor.setFlag.bind(actor);
		actor.setFlag = (...args) => { writes++; return original(...args); };

		await new StonetopSteading(actor, steadingRepos()).clearRollMode();

		expect(writes, "an already-normal mode was rewritten").toBe(0);
	});
});
