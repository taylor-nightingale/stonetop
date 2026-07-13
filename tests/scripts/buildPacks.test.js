import { describe, expect, it } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { BUILDERS } from "../../scripts/build-packs.js";

const root = join(import.meta.dirname, "../..");

describe("build-packs builder list", () => {
	it("references only builders that exist", () => {
		for (const builder of BUILDERS) {
			expect(existsSync(join(root, builder)), `${builder} missing`).toBe(true);
		}
	});

	it("covers every build-* script under scripts/import", () => {
		const onDisk = ["scripts/import", "scripts/import/pdf"]
			.flatMap((dir) => readdirSync(join(root, dir))
				.filter((f) => f.startsWith("build-"))
				.map((f) => `${dir}/${f}`))
			.sort();
		expect([...BUILDERS].sort()).toEqual(onDisk);
	});

	it("builds npc and arcana sources before the journal that links to them, and the journal before the artifacts extracted from it", () => {
		const at = (name) => BUILDERS.findIndex((b) => b.includes(name));
		expect(at("build-npcs")).toBeLessThan(at("build-journal"));
		expect(at("build-arcana")).toBeLessThan(at("build-journal"));
		expect(at("build-journal")).toBeLessThan(at("build-artifacts"));
	});
});
