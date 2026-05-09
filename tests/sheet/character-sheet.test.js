import { describe, it, expect } from "vitest";
import { createStonetopCharacterSheetClass } from "../../module/sheets/stonetop-character-sheet.js";

class MockPbtaActorSheet {
	static get defaultOptions() {
		return { classes: ["pbta", "sheet", "actor"], width: 840, height: 780 };
	}
	async getData() {
		return { actor: this.actor, system: this.actor?.system ?? {} };
	}
}

const StonetopCharacterSheet = createStonetopCharacterSheetClass(MockPbtaActorSheet);

describe("StonetopCharacterSheet", () => {
	describe("defaultOptions", () => {
		it('includes "stonetop" and "character" in classes', () => {
			const { classes } = StonetopCharacterSheet.defaultOptions;
			expect(classes).toContain("stonetop");
			expect(classes).toContain("character");
		});

		it("preserves inherited pbta classes", () => {
			const { classes } = StonetopCharacterSheet.defaultOptions;
			expect(classes).toContain("pbta");
		});

		it("sets stonetop width and height", () => {
			const { width, height } = StonetopCharacterSheet.defaultOptions;
			expect(width).toBe(720);
			expect(height).toBe(800);
		});
	});

	describe("getData", () => {
		it("returns context from super", async () => {
			const sheet = new StonetopCharacterSheet();
			sheet.actor = { system: { attributes: { hp: { value: 10, max: 16 } } } };
			const context = await sheet.getData();
			expect(context).toHaveProperty("actor");
			expect(context).toHaveProperty("system");
		});
	});
});
