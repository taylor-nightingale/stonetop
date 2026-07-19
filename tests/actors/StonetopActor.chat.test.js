import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStonetopActorClass } from "../../src/actors/StonetopActor.js";
import { FakeRoll } from "../fakes/foundry/FakeRoll.js";
import { FakeChatMessage } from "../fakes/foundry/FakeChatMessage.js";

// The real StonetopActor mixin over a bare base: sendItemToChat / sendDescriptionToChat run the
// real ActorRolling → postDescriptionCard pipeline; only the Foundry globals are faked.
function makeActor() {
	const Base = class {};
	return new (createStonetopActorClass(Base))();
}

beforeEach(() => {
	FakeRoll.reset();
	FakeChatMessage.reset();
	vi.stubGlobal("Roll", FakeRoll);
	vi.stubGlobal("ChatMessage", FakeChatMessage);
	vi.stubGlobal("game", {i18n: {localize: k => k}});
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

describe("StonetopActor.sendItemToChat", () => {
	it("posts the item's name, description, and all result tiers without rolling", async () => {
		const actor = makeActor();
		const item = {name: "Defend", system: {rollStat: "con", description: "Stand in harm's way.", moveResults: {
			success: {label: "10+", value: "Hold 3 Readiness."},
			partial: {label: "7-9", value: "Hold 1 Readiness."},
		}}};
		await actor.sendItemToChat(item);
		expect(FakeRoll.lastInstance).toBeNull();
		const content = FakeChatMessage.lastCreated.content;
		expect(content).toContain("Defend");
		expect(content).toContain("Stand in harm's way.");
		expect(content).toContain("10+ Hold 3 Readiness.");
		expect(content).toContain("7-9 Hold 1 Readiness.");
	});

	it("posts a non-rollable item (no rollStat) as a plain description card", async () => {
		const actor = makeActor();
		await actor.sendItemToChat({name: "Well Versed", system: {rollStat: null, description: "You know things.", moveResults: null}});
		expect(FakeRoll.lastInstance).toBeNull();
		expect(FakeChatMessage.lastCreated.content).toContain("Well Versed");
		expect(FakeChatMessage.lastCreated.content).toContain("You know things.");
	});
});

describe("StonetopActor.sendDescriptionToChat", () => {
	it("posts bare label + text with no item behind it", async () => {
		const actor = makeActor();
		await actor.sendDescriptionToChat("Ring of Whispers", "Hear the unspoken.");
		expect(FakeRoll.lastInstance).toBeNull();
		expect(FakeChatMessage.lastCreated.content).toContain("Ring of Whispers");
		expect(FakeChatMessage.lastCreated.content).toContain("Hear the unspoken.");
	});
});
