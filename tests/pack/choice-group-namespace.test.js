import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "fs";
import path from "path";

// A choice group's slug names the value store its values live in, and that store is PER DOCUMENT:
// `item.system.choiceValues[<group slug>]`. So the slug only has to be unique among the groups on its
// own item — it is not a global key, and it carries no relationship to the container's own slug.
//
// The one thing that genuinely breaks is two groups on the SAME item sharing a slug: they silently
// share a store, so ticking one moves the other. That is what this guards.
//
// Arcana are excluded deliberately: they give `front.unlock` and `back.choices` the same slug on
// purpose, because a follower entry printed on both faces of the card must stay in one store.

const CONTAINERS = [
	{ type: "possession", dir: "packs/src/possessions" },
	{ type: "follower",   dir: "packs/src/followers" },
	{ type: "move",       dir: "packs/src/moves" },
];

describe("Pack choice groups do not collide within a container", () => {
	let containers;
	beforeAll(async () => { containers = await loadContainers(); });

	it("loads choice groups from every container type", () => {
		for (const { type } of CONTAINERS) {
			expect(
				containers.filter(c => c.type === type).length,
				`no ${type} files with choice groups were loaded`,
			).toBeGreaterThan(0);
		}
	});

	it("every group declares a slug", () => {
		const bad = containers
			.flatMap(({ name, groups }) => groups.filter(g => !g?.slug).map(() => `${name}: group with no slug`));
		expect(bad).toEqual([]);
	});

	it("no container has two groups sharing a slug", () => {
		const bad = [];
		for (const { name, groups } of containers) {
			const seen = new Set();
			for (const g of groups) {
				if (seen.has(g.slug)) bad.push(`${name}: duplicate group slug "${g.slug}"`);
				seen.add(g.slug);
			}
		}
		expect(bad).toEqual([]);
	});
});

// `system.choices` is a single group on possessions and moves, and an array of groups on followers.
// Normalizing here keeps the assertions above shape-agnostic.
async function loadContainers() {
	const containers = [];
	for (const { type, dir } of CONTAINERS) {
		for (const full of await jsonFilesIn(path.resolve(dir))) {
			const data    = JSON.parse(await fs.readFile(full, "utf8"));
			const choices = data.system?.choices;
			if (choices == null) continue;
			const groups = Array.isArray(choices) ? choices : [choices];
			containers.push({ type, name: path.relative(path.resolve(dir), full), groups });
		}
	}
	return containers;
}

async function jsonFilesIn(dir) {
	const found = [];
	for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (!entry.name.startsWith("_")) found.push(...await jsonFilesIn(full));
		} else if (entry.name.endsWith(".json")) {
			found.push(full);
		}
	}
	return found;
}
