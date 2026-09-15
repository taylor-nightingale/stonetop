import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

/**
 * Stonetop's neighbouring places, checked against the book rather than against a mirror of
 * themselves.
 *
 * `packs/src/steadfasts/stonetop.json` is hand-authored — build-steadfasts.js keeps it in its KEEP
 * set and regenerates every other steadfast around it — so nothing else in the build would notice a
 * value drifting. Two of these fields are transcriptions of printed tables and are exactly the kind
 * of thing that rots quietly:
 *
 *   size    each place's own settlement box (and packs/src/steadfasts/<slug>.json, generated from it)
 *   travel  the GM playbook's "Travel Times" table, block "From Stonetop via the Roads to…"
 */
const root = process.cwd();
const stonetop = JSON.parse(readFileSync(path.join(root, "packs/src/steadfasts/stonetop.json"), "utf8"));
const places = stonetop.system.neighborPlaces;
const bySlug = Object.fromEntries(places.map(p => [p.slug, p]));

// Journey → Time, verbatim from the table's From-Stonetop block. Lygos is the one figure it does not
// print from Stonetop: it prints Marshedge → Lygos at 30 days, and Marshedge is itself 10 away.
const PRINTED_TRAVEL = {
	marshedge:       "10 days",
	"gordins-delve": "4 days",
	steplands:       "4 days",
	"barrier-pass":  "5 days",
	lygos:           "40 days",
};

describe("Stonetop's neighbouring places", () => {
	it("lists the places the steading playbook prints, in its order", () => {
		expect(places.map(p => p.slug))
			.toEqual(["marshedge", "gordins-delve", "steplands", "lygos", "barrier-pass", "other"]);
	});

	it("carries the book's travel time for every place that has one", () => {
		for (const [slug, time] of Object.entries(PRINTED_TRAVEL))
			expect(bySlug[slug].travel, slug).toBe(time);
	});

	// A grouping is several journeys, so it can be none of them. Barrier Pass was split out of this
	// row precisely because the book DOES print a time for it.
	it("leaves the catch-all row without a travel time", () => {
		expect(bySlug.other.travel).toBe("");
		expect(bySlug.other.subtitle).not.toContain("Barrier Pass");
	});

	// Sizes come from each place's own settlement box, which is also what build-steadfasts.js reads
	// when it generates that place's steadfast — so the two must agree.
	it("sizes each neighbour as its own steadfast does", () => {
		for (const slug of ["marshedge", "gordins-delve", "barrier-pass"]) {
			const own = JSON.parse(readFileSync(path.join(root, `packs/src/steadfasts/${slug}.json`), "utf8"));
			expect(bySlug[slug].size, slug).toBe(own.system.attributes.size);
		}
	});

	it("leaves the regions unsized — they are not steadings and the book gives them none", () => {
		for (const slug of ["steplands", "lygos", "other"]) expect(bySlug[slug].size, slug).toBe("");
	});

	// The note is the table's, and ships blank: a steading seeds its copy from here.
	it("ships every row with an empty note", () => {
		expect(places.map(p => p.note)).toEqual(places.map(() => ""));
	});
});
