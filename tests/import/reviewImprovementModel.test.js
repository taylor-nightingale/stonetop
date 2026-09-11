import { describe, it, expect } from "vitest";
import { loadImprovements, reviewImprovementModel } from "../../scripts/import/review-improvement-model.js";

/**
 * The review file is the surface the hand-authored model is checked against: each improvement's
 * requirement as the book would say it, each result beside the sentence it was read from. It is the
 * half that catches an OMISSION — a review showing only what was modelled cannot show what was
 * missed — so what matters is that the book's own words reach it, and that a broken model stops the
 * rebuild before it is written.
 */
describe("reviewImprovementModel", () => {
	it("reads all twenty-four improvements, both halves", () => {
		const docs = loadImprovements();
		expect(docs).toHaveLength(24);
		expect(docs.map(d => d.system.slug)).toContain("market");
		expect(docs.map(d => d.system.slug)).toContain("trade-with-barrier-pass");
	});

	it("passes the committed pack, and counts what the sheet may apply", () => {
		const { problems, applied, stated } = reviewImprovementModel({ write: false });
		expect(problems).toEqual([]);
		expect(applied).toBeGreaterThan(0);
		expect(stated).toBeGreaterThan(0);
	});

	it("reports rather than writes when an improvement's model is broken", () => {
		const docs = loadImprovements();
		const broken = docs.map(doc => doc.system.slug === "market"
			? { ...doc, system: { ...doc.system, requires: { all: ["no-such-row"] } } }
			: doc);
		const { problems } = reviewImprovementModel({ write: false, docs: broken });
		expect(problems.some(p => /market: requires names "no-such-row"/.test(p))).toBe(true);
	});
});
