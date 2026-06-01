import { describe, it, expect, vi } from "vitest";
import { ResourceController } from "../../../module/actors/character/ResourceController.js";

function makeFlags(store = {}) {
	return {
		getFlag: (key) => store[key] ?? null,
		setFlag: vi.fn(async (key, val) => { store[key] = val; }),
	};
}

// -- getCurrent ----------------------------------------------------------------

describe("ResourceController.getCurrent", () => {
	it("returns 0 when no resources saved", () => {
		expect(new ResourceController(makeFlags()).getCurrent("foo")).toBe(0);
	});

	it("returns the saved count for a slug", () => {
		expect(new ResourceController(makeFlags({ resources: { foo: 2 } })).getCurrent("foo")).toBe(2);
	});

	it("returns 0 for an unknown slug when others are saved", () => {
		expect(new ResourceController(makeFlags({ resources: { bar: 1 } })).getCurrent("foo")).toBe(0);
	});
});

// -- set -----------------------------------------------------------------------

describe("ResourceController.set", () => {
	it("saves the count to the resources map", async () => {
		const store = {};
		await new ResourceController(makeFlags(store)).set("foo", 3);
		expect(store.resources).toEqual({ foo: 3 });
	});

	it("merges into existing resources", async () => {
		const store = { resources: { bar: 1 } };
		await new ResourceController(makeFlags(store)).set("foo", 2);
		expect(store.resources).toEqual({ bar: 1, foo: 2 });
	});
});

// -- buildSnapshot (instance) --------------------------------------------------

describe("ResourceController.buildSnapshot", () => {
	it("returns null when def is null", () => {
		expect(new ResourceController(makeFlags()).buildSnapshot(null, "foo")).toBeNull();
	});

	it("uses getCurrent for the slug", () => {
		const ctrl = new ResourceController(makeFlags({ resources: { foo: 2 } }));
		const snap = ctrl.buildSnapshot({ max: 3, title: null, labels: [] }, "foo");
		expect(snap.current).toBe(2);
		expect(snap.max).toBe(3);
	});

	it("uses 0 as current when slug has no saved value", () => {
		const snap = new ResourceController(makeFlags()).buildSnapshot({ max: 2, title: null, labels: [] }, "foo");
		expect(snap.current).toBe(0);
	});
});

// -- build (static) ------------------------------------------------------------

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
