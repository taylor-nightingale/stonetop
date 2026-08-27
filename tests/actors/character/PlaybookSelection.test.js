import { describe, expect, it, vi } from "vitest";
import { PlaybookSelection } from "../../../src/actors/character/PlaybookSelection.js";

const actor = (playbookSlug = null) => ({ system: { playbookSlug }, update: vi.fn(async () => {}) });

describe("PlaybookSelection", () => {
	it("reads the chosen playbook", () => {
		expect(new PlaybookSelection(actor("the-heavy")).slug).toBe("the-heavy");
	});

	// Read live: a character can change playbook mid-session, and anything holding a copy goes stale.
	it("reads it afresh every time", () => {
		const a = actor("the-heavy");
		const selection = new PlaybookSelection(a);
		expect(selection.slug).toBe("the-heavy");

		a.system.playbookSlug = "the-fox";
		expect(selection.slug).toBe("the-fox");
	});

	it("reports no choice as null rather than empty string", () => {
		expect(new PlaybookSelection(actor("")).slug).toBeNull();
		expect(new PlaybookSelection(actor()).slug).toBeNull();
		expect(new PlaybookSelection({}).slug).toBeNull();
	});

	it("knows whether a playbook has been chosen", () => {
		expect(new PlaybookSelection(actor("the-fox")).isChosen).toBe(true);
		expect(new PlaybookSelection(actor()).isChosen).toBe(false);
	});

	it("is the one writer of the slug", async () => {
		const a = actor();
		await new PlaybookSelection(a).select("the-judge");
		expect(a.update).toHaveBeenCalledWith({ "system.playbookSlug": "the-judge" });
	});

	it("clears to null rather than undefined", async () => {
		const a = actor("the-judge");
		await new PlaybookSelection(a).select(null);
		expect(a.update).toHaveBeenCalledWith({ "system.playbookSlug": null });
	});
});
