import { describe, expect, it } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { BUILDERS, BUILDER_ARGS } from "../../scripts/build-packs.js";

const root = join(import.meta.dirname, "../..");

describe("build-packs builder list", () => {
	it("references only builders that exist", () => {
		for (const builder of BUILDERS) {
			expect(existsSync(join(root, builder)), `${builder} missing`).toBe(true);
		}
	});

	// Two things at once: a new builder that nobody listed here never runs in a rebuild, and a listed
	// script that is not a builder has to be a deliberate one — the review pass writes no source, but
	// it fails the rebuild when the hand-authored improvement model has drifted from the pack.
	const NOT_BUILDERS = ["scripts/import/review-improvement-model.js"];

	it("covers every build-* script under scripts/import, and lists nothing else unaccounted for", () => {
		const onDisk = ["scripts/import", "scripts/import/pdf"]
			.flatMap((dir) => readdirSync(join(root, dir))
				.filter((f) => f.startsWith("build-"))
				.map((f) => `${dir}/${f}`))
			.sort();
		expect([...BUILDERS].filter((b) => !NOT_BUILDERS.includes(b)).sort()).toEqual(onDisk);
		expect(BUILDERS).toEqual(expect.arrayContaining(NOT_BUILDERS));
	});

	// build-arcana writes nothing without these — it is a report generator by default, so a flagless
	// entry here silently drops every arcanum card out of the rebuild (and out of the regen diff).
	it("tells build-arcana to write the arcana cards", () => {
		expect(BUILDER_ARGS["scripts/import/pdf/build-arcana.js"]).toEqual(["--write-arcana", "--write-minor"]);
	});

	it("only passes args to builders it actually lists", () => {
		for (const builder of Object.keys(BUILDER_ARGS)) expect(BUILDERS).toContain(builder);
	});

	it("builds npc and arcana sources before the journal that links to them, and the journal before the artifacts extracted from it", () => {
		const at = (name) => BUILDERS.findIndex((b) => b.includes(name));
		expect(at("build-npcs")).toBeLessThan(at("build-journal"));
		expect(at("build-arcana")).toBeLessThan(at("build-journal"));
		expect(at("build-journal")).toBeLessThan(at("build-artifacts"));
	});
});
