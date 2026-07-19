import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { postDescriptionCard, buildResultTiers } from "../../src/utils/rollCard.js";
import { FakeChatMessage } from "../fakes/foundry/FakeChatMessage.js";

const RESULTS = {
	success: { label: "10+", value: "You pull it off." },
	partial: { label: "7-9", value: "A lesser success." },
	failure: { label: "6-",  value: "Things get bad." },
};

beforeEach(() => {
	FakeChatMessage.reset();
	vi.stubGlobal("ChatMessage", FakeChatMessage);
	// Card-aware renderTemplate stub: flatten the card's text so content assertions hold without a
	// real Handlebars render (same approach as ActorRolling.test.js).
	foundry.applications.handlebars.renderTemplate = async (_path, d) => [
		d.name ?? "",
		d.description ? d.description.render() : "",
		...(d.results ?? []).map(r => `${r.label} ${r.text.render()}`),
	].join(" | ");
});

afterEach(() => {
	vi.unstubAllGlobals();
	foundry.applications.handlebars.renderTemplate = async () => "";
});

describe("buildResultTiers", () => {
	it("returns the tiers in success → partial → failure order", () => {
		const tiers = buildResultTiers(RESULTS);
		expect(tiers.map(t => t.key)).toEqual(["success", "partial", "failure"]);
		expect(tiers.map(t => t.label)).toEqual(["10+", "7-9", "6-"]);
		expect(tiers[0].text.raw).toBe("You pull it off.");
	});

	it("skips tiers without text", () => {
		const tiers = buildResultTiers({ success: { label: "10+", value: "Yes." }, partial: { label: "7-9", value: "" } });
		expect(tiers.map(t => t.key)).toEqual(["success"]);
	});

	it("returns null for absent or all-empty results", () => {
		expect(buildResultTiers(null)).toBeNull();
		expect(buildResultTiers({ success: { label: "10+", value: "" } })).toBeNull();
	});
});

describe("postDescriptionCard", () => {
	it("posts name, description, and every result tier with the given speaker", async () => {
		const speaker = { alias: "Vahid" };
		await postDescriptionCard(speaker, { name: "Defy Danger", description: "When danger looms…", moveResults: RESULTS });
		const msg = FakeChatMessage.lastCreated;
		expect(msg.speaker).toBe(speaker);
		expect(msg.content).toContain("Defy Danger");
		expect(msg.content).toContain("When danger looms…");
		expect(msg.content).toContain("10+ You pull it off.");
		expect(msg.content).toContain("7-9 A lesser success.");
		expect(msg.content).toContain("6- Things get bad.");
	});

	it("posts a plain description card when the move has no result tiers", async () => {
		await postDescriptionCard({}, { name: "Sigil", description: "Hold Authority." });
		expect(FakeChatMessage.lastCreated.content).toContain("Sigil");
		expect(FakeChatMessage.lastCreated.content).toContain("Hold Authority.");
	});
});
