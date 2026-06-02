import { describe, it, expect } from "vitest";
import { Resource } from "../../src/model/data/Resource.js";

describe("Resource", () => {
	it("stores max, maxStat, title, labels from data", () => {
		const def = new Resource({ max: 3, maxStat: null, title: "Ammo", labels: ["plenty", "low"] });
		expect(def.max).toBe(3);
		expect(def.maxStat).toBeNull();
		expect(def.title).toBe("Ammo");
		expect(def.labels).toEqual(["plenty", "low"]);
	});

	it("defaults max to null when absent", () => {
		expect(new Resource({}).max).toBeNull();
	});

	it("defaults maxStat to null when absent", () => {
		expect(new Resource({}).maxStat).toBeNull();
	});

	it("defaults title to null when absent", () => {
		expect(new Resource({}).title).toBeNull();
	});

	it("defaults labels to [] when absent", () => {
		expect(new Resource({}).labels).toEqual([]);
	});
});
