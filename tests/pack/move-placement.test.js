import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "fs";
import path from "path";

const MOVES = path.resolve("packs/src/moves");

async function movesIn(dir) {
	const out = [];
	for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
		if (entry.name === "_folders") continue;
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) out.push(...await movesIn(full));
		else if (entry.name.endsWith(".json")) out.push(JSON.parse(await fs.readFile(full, "utf8")));
	}
	return out;
}

let all;
beforeAll(async () => { all = await movesIn(MOVES); });

const bySlug = slug => all.find(m => m.system?.slug === slug);

// Book I splits the expedition moves by when they fire: a checklist before leaving, the road itself,
// and the end of the journey. The rail groups them this way.
const PHASES = {
	"outfit":             "setting-out",
	"chart-a-course":     "setting-out",
	"requisition":        "setting-out",
	"have-what-you-need": "on-the-road",
	"keep-company":       "on-the-road",
	"recover":            "on-the-road",
	"make-camp":          "on-the-road",
	"forage":             "on-the-road",
	"struggle-as-one":    "on-the-road",
	"return-triumphant":  "getting-home",
};

describe("expedition phases", () => {
	it.each(Object.entries(PHASES))("%s is for %s", (slug, phase) => {
		expect(bySlug(slug)?.system.phase).toBe(phase);
	});

	it("covers every expedition move", () => {
		const expedition = all.filter(m => m.system?.moveType === "expedition").map(m => m.system.slug);
		expect(expedition.sort()).toEqual(Object.keys(PHASES).sort());
	});

	it("gives no other move a phase", () => {
		const phased = all.filter(m => m.system?.phase).map(m => m.system.slug);
		expect(phased.sort()).toEqual(Object.keys(PHASES).sort());
	});
});

// Each insert gained by dying brings the move made at zero HP instead of glimpsing the Last Door.
describe("moves made instead of Death's Door", () => {
	it.each(["tethered", "undying", "dark-succor"])("%s replaces Death's Door", slug => {
		expect(bySlug(slug)?.system.replaces).toBe("deaths-door");
	});

	it("names no other replacement", () => {
		const replacing = all.filter(m => m.system?.replaces).map(m => m.system.slug);
		expect(replacing.sort()).toEqual(["dark-succor", "tethered", "undying"]);
	});

	it("replaces a move that exists", () => {
		expect(bySlug("deaths-door")).toBeDefined();
	});
});
