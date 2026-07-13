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

	it("covers every build-* script under scripts/import/pdf", () => {
		const onDisk = readdirSync(join(root, "scripts/import/pdf"))
			.filter((f) => f.startsWith("build-"))
			.map((f) => `scripts/import/pdf/${f}`)
			.sort();
		expect([...BUILDERS].sort()).toEqual(onDisk);
	});
});
