import { describe, it, expect } from "vitest";
import { ResourceController } from "../../../src/actors/character/ResourceController.js";
import { StonetopFlags } from "../../../src/actors/character/StonetopFlags.js";
import { FakeFlags } from "../../fakes/FakeFlags.js";

function makeFlags() {
	return new StonetopFlags(new FakeFlags(), "resources");
}

function makeController() {
	return new ResourceController(makeFlags());
}

// ── getCurrent ────────────────────────────────────────────────────────────────

describe("ResourceController.getCurrent", () => {
	it("returns 0 when nothing saved", () => {
		expect(makeController().getCurrent("backgrounds", "foo")).toBe(0);
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
});
