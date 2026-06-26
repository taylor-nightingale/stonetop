import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "fs";
import path from "path";

// Onboarding relies on two kinds of move-name references in the playbook data:
//   • moves.choices[].options[]  — "either X OR Y" starting picks (the Heavy's
//     Armored OR Uncanny Reflexes). These are excluded from the auto-granted
//     starting moves, granted by the chosen one, and restored on resume by NAME.
//   • backgrounds[].moves[]      — moves a background grants (the Marshal's Veteran
//     Crew, the Ranger's Animal Companion). ensureStartingMoves grants these by name.
// Either reference breaks silently if a move is renamed in the pack, so hold the data
// to the contract: every referenced name must match a real move item in the playbook's
// move folder.

const PLAYBOOKS_DIR = path.resolve("packs/src/stonetop-items/playbooks");
const MOVES_DIR     = path.resolve("packs/src/stonetop-items/playbook-moves");

// "The Blessed" → "the-blessed", "The Would-Be Hero" → "the-would-be-hero".
const folderFor = name => name.toLowerCase().replace(/\s+/g, "-");

async function movesInPlaybook(playbookName) {
	const dir = path.join(MOVES_DIR, folderFor(playbookName));
	const files = (await fs.readdir(dir)).filter(f => f.endsWith(".json"));
	const names = await Promise.all(files.map(async f => {
		const doc = JSON.parse(await fs.readFile(path.join(dir, f), "utf-8"));
		return doc.name;
	}));
	return new Set(names);
}

async function loadPlaybooks() {
	const files = (await fs.readdir(PLAYBOOKS_DIR)).filter(f => f.endsWith(".json"));
	return Promise.all(files.map(async f => {
		const doc = JSON.parse(await fs.readFile(path.join(PLAYBOOKS_DIR, f), "utf-8"));
		return { name: doc.name, fields: doc.flags?.stonetop ?? {} };
	}));
}

describe("playbook move-name references resolve to real moves", () => {
	let playbooks;
	beforeAll(async () => { playbooks = await loadPlaybooks(); });

	it("covers every playbook with a moves source folder", async () => {
		const folders = (await fs.readdir(MOVES_DIR, { withFileTypes: true }))
			.filter(e => e.isDirectory()).map(e => e.name).sort();
		expect(playbooks.map(p => folderFor(p.name)).sort()).toEqual(folders);
	});

	it("resolves every 'either X OR Y' choice option to a real move", async () => {
		for (const pb of playbooks) {
			const choices = pb.fields.moves?.choices ?? [];
			if (!choices.length) continue;
			const actual = await movesInPlaybook(pb.name);
			for (const group of choices) {
				expect(group.options?.length, `${pb.name}: empty choice group`).toBeGreaterThan(0);
				for (const name of group.options) {
					expect(actual, `${pb.name} choice: "${name}"`).toContain(name);
				}
			}
		}
	});

	it("resolves every background-granted move to a real move", async () => {
		for (const pb of playbooks) {
			const backgrounds = pb.fields.backgrounds ?? [];
			const referenced = backgrounds.flatMap(b => b.moves ?? []);
			if (!referenced.length) continue;
			const actual = await movesInPlaybook(pb.name);
			for (const name of referenced) {
				expect(actual, `${pb.name} background move: "${name}"`).toContain(name);
			}
		}
	});
});
