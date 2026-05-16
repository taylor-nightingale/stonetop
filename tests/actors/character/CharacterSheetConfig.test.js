import { describe, it, expect } from "vitest";
import { characterSheetConfig } from "../../../module/actors/character/CharacterSheetConfig.js";

describe("characterSheetConfig moveTypes", () => {
	it("includes 'other' with creation enabled", () => {
		const config = characterSheetConfig();
		expect(config.moveTypes.other).toBeDefined();
		expect(config.moveTypes.other.creation).toBe(true);
	});
});
