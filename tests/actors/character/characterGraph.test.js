import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The character's subsystems must form a DAG.
//
// Assembling them in one function body with `const` and constructor arguments makes a
// constructor-level cycle *structurally impossible* — a forward reference is a ReferenceError, not a
// design mistake that ships. That is the real protection, and it is why this refactor was worth
// doing. What this file guards is the way back in: setter injection, which defers the reference past
// initialization and is exactly how the playbook → moves → requirements → playbook cycle existed.
//
// Scope: edges from CONSTRUCTOR ARGUMENTS. Observer registration (factory.subscribe) is deliberately
// excluded — a subject depending on a `handle(change)` role is the pattern working, not accidental
// coupling, and breaking it would remove the notification it exists for.

const SOURCE = readFileSync("src/actors/character/CharacterSubsystems.js", "utf8");

/**
 * name → the locals it is constructed with. Two passes, so a forward reference is not dropped, and
 * property accesses are skipped: `repos.moves` is a repository, not the `moves` subsystem.
 */
export function constructorGraph(source) {
	const built = [...source.matchAll(/const (\w+)\s*=\s*new \w+\(([^;]*?)\);/gu)]
		.map(([, name, args]) => [name, args]);
	const names = new Set(built.map(([name]) => name));
	return new Map(built.map(([name, args]) => [
		name,
		new Set([...args.matchAll(/(?<![.\w])([a-z]\w*)\b/gu)].map(m => m[1]).filter(dep => names.has(dep) && dep !== name)),
	]));
}

export function cyclesIn(graph) {
	const found = [];
	const state = new Map();
	const walk = (node, path) => {
		if (state.get(node) === "open") return found.push([...path.slice(path.indexOf(node)), node]);
		if (state.get(node) === "done") return;
		state.set(node, "open");
		for (const dep of graph.get(node) ?? []) walk(dep, [...path, node]);
		state.set(node, "done");
	};
	for (const node of graph.keys()) walk(node, []);
	return found;
}

describe("the cycle detector itself", () => {
	// Without this the assertions below could pass by finding nothing at all.
	it("finds a cycle when there is one", () => {
		const graph = new Map([
			["playbook",     new Set(["moves"])],
			["moves",        new Set(["requirements"])],
			["requirements", new Set(["playbook"])],
		]);
		expect(cyclesIn(graph)).not.toEqual([]);
	});

	it("sees a forward reference rather than dropping it", () => {
		const graph = constructorGraph(`
			const requirements = new MoveRequirements(vitals, playbook);
			const playbook     = new CharacterPlaybook(actor, requirements);
		`);
		expect(graph.get("requirements")).toEqual(new Set(["playbook"]));
		expect(cyclesIn(graph)).not.toEqual([]);
	});
});

describe("the character subsystem graph", () => {
	const graph = constructorGraph(SOURCE);

	it("reads the assembler — a guard over nothing would pass silently", () => {
		expect(graph.size).toBeGreaterThan(10);
		for (const name of ["moves", "playbook", "requirements", "arcana", "followers"]) {
			expect([...graph.keys()], name).toContain(name);
		}
	});

	it("is acyclic, with no exceptions", () => {
		expect(cyclesIn(graph).map(c => c.join(" → "))).toEqual([]);
	});

	// The actual guard: every dependency is a constructor argument, so build order is forced by the
	// language rather than by a convention the next reader has to notice.
	it("assembles without setter injection", () => {
		expect([...SOURCE.matchAll(/\b\w+\.(set[A-Z]\w*)\(/gu)].map(m => m[1])).toEqual([]);
	});

	// The reason MoveRequirements exists at all: holding CharacterPlaybook closed the cycle.
	it("keeps the requirement policy on leaves, never on a subsystem", () => {
		expect(graph.get("requirements")).toEqual(new Set(["vitals", "playbookSelection"]));
	});

	it("builds the leaves before anything depends on them", () => {
		for (const leaf of ["vitals", "playbookSelection", "stats", "origin"]) {
			expect(graph.get(leaf), leaf).toEqual(new Set());
		}
	});
});
