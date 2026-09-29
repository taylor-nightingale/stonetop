import { describe, it, expect } from "vitest";
import { Wound } from "../../../../src/model/data/character/Wound.js";

describe("Wound", () => {
	// A wound nobody has named yet is an empty line in the editor, not something that ails anyone.
	it("is named once its name has more than blanks in it", () => {
		expect(Wound.named("w1", "cut").isNamed).toBe(true);
		expect(Wound.named("w1", "").isNamed).toBe(false);
		expect(Wound.named("w1", "   ").isNamed).toBe(false);
	});

	it("starts active", () => {
		expect(Wound.named("w1", "broken arm").state).toBe("active");
	});

	it("reads back what was stored", () => {
		const wound = Wound.fromRaw({ id: "w1", name: "bad knee", state: "permanent" });
		expect(wound).toEqual(new Wound("w1", "bad knee", "permanent"));
	});

	it("stores its three fields and nothing else", () => {
		expect(new Wound("w1", "bad knee", "stabilized").toRaw())
			.toEqual({ id: "w1", name: "bad knee", state: "stabilized" });
	});

	it("renames without touching its state", () => {
		const wound = new Wound("w1", "arm", "stabilized").withName("broken arm");
		expect(wound).toEqual(new Wound("w1", "broken arm", "stabilized"));
	});

	it("leaves the original unchanged", () => {
		const wound = Wound.named("w1", "arm");
		wound.withName("broken arm");
		expect(wound.name).toBe("arm");
	});

	// The editor names the state it is in, and pressing it steps to the next: three values and a cycle.
	it.each([
		["active", "stabilized"],
		["stabilized", "permanent"],
		["permanent", "active"],
	])("steps from %s to %s", (from, to) => {
		expect(new Wound("w1", "arm", from).withNextState().state).toBe(to);
	});
});
