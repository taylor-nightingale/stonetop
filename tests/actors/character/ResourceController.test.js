import { describe, it, expect } from "vitest";
import { ResourceController } from "../../../src/actors/character/ResourceController.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";

function makeController() {
	return new ResourceController(new FakeCharacterActorBuilder().build());
}

// ── getCurrent ────────────────────────────────────────────────────────────────

describe("ResourceController.getCurrent", () => {
	it("returns 0 when nothing saved", () => {
		expect(makeController().getCurrent("backgrounds", "foo")).toBe(0);
	});

	// A follower that arrives holding loyalty ("treat it as a follower, with 3 Loyalty to start") has
	// nothing recorded yet; the caller names where it starts.
	it("returns the caller's starting count when nothing is saved", () => {
		expect(makeController().getCurrent("followers", "void", 3)).toBe(3);
	});

	it("keeps a saved 0 rather than the starting count — spent is not unset", async () => {
		const ctrl = makeController();
		await ctrl.set("followers", "void", 0);
		expect(ctrl.getCurrent("followers", "void", 3)).toBe(0);
	});

	it("returns the saved count for a namespace and slug", async () => {
		const ctrl = makeController();
		await ctrl.set("backgrounds", "foo", 2);
		expect(ctrl.getCurrent("backgrounds", "foo")).toBe(2);
	});

	it("returns 0 for an unknown slug when other slugs are saved", async () => {
		const ctrl = makeController();
		await ctrl.set("backgrounds", "bar", 1);
		expect(ctrl.getCurrent("backgrounds", "foo")).toBe(0);
	});
});

// ── set ───────────────────────────────────────────────────────────────────────

describe("ResourceController.set", () => {
	it("saves the count for a namespace and slug", async () => {
		const ctrl = makeController();
		await ctrl.set("backgrounds", "foo", 3);
		expect(ctrl.getCurrent("backgrounds", "foo")).toBe(3);
	});

	it("merges into existing counts in the same namespace", async () => {
		const ctrl = makeController();
		await ctrl.set("backgrounds", "bar", 1);
		await ctrl.set("backgrounds", "foo", 2);
		expect(ctrl.getCurrent("backgrounds", "bar")).toBe(1);
		expect(ctrl.getCurrent("backgrounds", "foo")).toBe(2);
	});
});

// ── getText / setText (fill-in blank) ─────────────────────────────────────────

describe("ResourceController.getText / setText", () => {
	it("returns '' when nothing saved", () => {
		expect(makeController().getText("moves", "battery")).toBe("");
	});

	it("saves and reads back the fill-in text for a namespace and slug", async () => {
		const ctrl = makeController();
		await ctrl.setText("moves", "battery", "a bolt of lightning");
		expect(ctrl.getText("moves", "battery")).toBe("a bolt of lightning");
	});

	it("keeps text and count independent for the same namespace and slug", async () => {
		const ctrl = makeController();
		await ctrl.set("moves", "battery", 1);
		await ctrl.setText("moves", "battery", "a summer gale");
		expect(ctrl.getCurrent("moves", "battery")).toBe(1);
		expect(ctrl.getText("moves", "battery")).toBe("a summer gale");
	});

	it("isolates text by namespace", async () => {
		const ctrl = makeController();
		await ctrl.setText("moves", "battery", "stored energy");
		expect(ctrl.getText("possessions", "battery")).toBe("");
	});
});

// ── buildSnapshot (instance) ──────────────────────────────────────────────────

describe("ResourceController.buildSnapshot", () => {
	it("returns null when def is null", () => {
		expect(makeController().buildSnapshot("backgrounds", null, "foo")).toBeNull();
	});

	it("uses getCurrent for the namespace and slug", async () => {
		const ctrl = makeController();
		await ctrl.set("backgrounds", "foo", 2);
		const snap = ctrl.buildSnapshot("backgrounds", { max: 3, title: null, labels: [] }, "foo");
		expect(snap.current).toBe(2);
		expect(snap.max).toBe(3);
	});

	it("uses 0 as current when slug has no saved value", () => {
		const snap = makeController().buildSnapshot("backgrounds", { max: 2, title: null, labels: [] }, "foo");
		expect(snap.current).toBe(0);
	});

	it("resolves a resource's fill-in input value from saved text", async () => {
		const ctrl = makeController();
		await ctrl.setText("moves", "battery", "a caged storm");
		const snap = ctrl.buildSnapshot("moves", { max: 1, input: { type: "inline" } }, "battery");
		expect(snap.input).toEqual({ value: "a caged storm", placeholder: null, type: "inline" });
	});

	it("leaves input null for a resource def without an input", () => {
		const snap = makeController().buildSnapshot("moves", { max: 3, title: null }, "mindwalking");
		expect(snap.input).toBeNull();
	});
});

// ── namespace isolation ───────────────────────────────────────────────────────

describe("ResourceController — namespace isolation", () => {
	it("two namespaces with the same slug do not collide", async () => {
		const ctrl = makeController();
		await ctrl.set("backgrounds", "foo", 1);
		await ctrl.set("inventory", "foo", 3);
		expect(ctrl.getCurrent("backgrounds", "foo")).toBe(1);
		expect(ctrl.getCurrent("inventory", "foo")).toBe(3);
	});

	it("setting a slug in one namespace does not affect another", async () => {
		const ctrl = makeController();
		await ctrl.set("followers", "enfys", 2);
		expect(ctrl.getCurrent("backgrounds", "enfys")).toBe(0);
	});
});

// ── build (static) ────────────────────────────────────────────────────────────

describe("ResourceController.build", () => {
	it("returns null when def is null", () => {
		expect(ResourceController.build(null, 0)).toBeNull();
	});

	it("builds a ResourceSnapshot from def and current", () => {
		const snap = ResourceController.build({ max: 2, title: "Rations", labels: ["hungry", "starving"] }, 1);
		expect(snap.current).toBe(1);
		expect(snap.max).toBe(2);
		expect(snap.title).toBe("Rations");
		expect(snap.labels).toEqual(["hungry", "starving"]);
	});

	it("passes maxStat through", () => {
		const snap = ResourceController.build({ max: 4, maxStat: "wis", title: null, labels: [] }, 0);
		expect(snap.maxStat).toBe("wis");
	});

	it("defaults title to null when absent", () => {
		expect(ResourceController.build({ max: 1, labels: [] }, 0).title).toBeNull();
	});

	it("defaults labels to empty array when absent", () => {
		expect(ResourceController.build({ max: 1 }, 0).labels).toEqual([]);
	});

	it("defaults maxStat to null when absent", () => {
		expect(ResourceController.build({ max: 1 }, 0).maxStat).toBeNull();
	});

	it("builds an input from a def with a fill-in blank, using the passed value", () => {
		const snap = ResourceController.build({ max: 1, input: { type: "inline", placeholder: "what?" } }, 0, "a gale");
		expect(snap.input).toEqual({ value: "a gale", placeholder: "what?", type: "inline" });
	});

	it("falls back to the input's default when no value is passed", () => {
		const snap = ResourceController.build({ max: 1, input: { default: "nothing yet" } }, 0);
		expect(snap.input).toEqual({ value: "nothing yet", placeholder: null, type: "inline" });
	});

	it("leaves input null when the def has no input", () => {
		expect(ResourceController.build({ max: 2, title: null }, 1).input).toBeNull();
	});
});
