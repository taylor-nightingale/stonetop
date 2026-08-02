import { describe, expect, it } from "vitest";
import { hinderRollMode } from "../../src/actors/hinderRollMode.js";

describe("hinderRollMode", () => {
	it("hinders an unmodified roll", () => {
		expect(hinderRollMode("normal")).toBe("dis");
	});

	it("cancels advantage rather than compounding into disadvantage", () => {
		expect(hinderRollMode("adv")).toBe("normal");
	});

	it("leaves an already-hindered roll alone", () => {
		expect(hinderRollMode("dis")).toBe("dis");
	});
});
