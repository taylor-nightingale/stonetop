import { describe, it, expect } from "vitest";
import { Arrivals, ArrivalRegions } from "../../../src/actors/character/ArrivalRegions.js";

describe("Arrivals", () => {
	it("reports nothing on the first draw: a sheet opening on a character is not an arrival", () => {
		expect(new Arrivals().newOf(["the-seeker"])).toEqual([]);
	});

	it("reports what is new since the last draw, once", () => {
		const arrivals = new Arrivals();
		arrivals.newOf([]);
		expect(arrivals.newOf(["thrall"])).toEqual(["thrall"]);
		expect(arrivals.newOf(["thrall"])).toEqual([]);
	});

	it("reports a swap, and nothing for what went", () => {
		const arrivals = new Arrivals();
		arrivals.newOf(["the-seeker"]);
		expect(arrivals.newOf(["the-heavy"])).toEqual(["the-heavy"]);
		expect(arrivals.newOf([])).toEqual([]);
	});

	it("ignores an empty slug", () => {
		const arrivals = new Arrivals();
		arrivals.newOf([]);
		expect(arrivals.newOf([null, ""])).toEqual([]);
	});
});

// Snapshot-shaped stand-ins: only the fields ArrivalRegions reads.
const snapshot = ({ playbook = null, inserts = [] } = {}) => ({
	playbook: playbook ? { slug: playbook } : null,
	playbookSections: playbook ? { keys: ["background", "instinct"] } : null,
	inserts: inserts.map(slug => ({ slug, sections: { keys: [`insert-${slug}-instinct`] }, moves: [{ slug: "favor" }] })),
});

describe("ArrivalRegions", () => {
	it("opens nothing on the first draw", () => {
		expect(new ArrivalRegions().regionsFor(snapshot({ playbook: "the-seeker", inserts: ["thrall"] }), "s1")).toEqual([]);
	});

	it("opens every section of a playbook just chosen", () => {
		const regions = new ArrivalRegions();
		regions.regionsFor(snapshot(), "s1");
		expect(regions.regionsFor(snapshot({ playbook: "the-seeker" }), "s1"))
			.toEqual(["s1-section-background", "s1-section-instinct"]);
	});

	it("opens a new insert's sections and its moves' text", () => {
		const regions = new ArrivalRegions();
		regions.regionsFor(snapshot({ playbook: "the-seeker" }), "s1");
		expect(regions.regionsFor(snapshot({ playbook: "the-seeker", inserts: ["thrall"] }), "s1"))
			.toEqual(["s1-section-insert-thrall-instinct", "s1-move-insert-thrall-favor"]);
	});
});
