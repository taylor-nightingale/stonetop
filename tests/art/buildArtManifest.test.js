import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { collectArtRefs, buildManifest } from "../../scripts/art/build-art-manifest.js";
import { Raster } from "../../src/art/Raster.js";

// A stencil (black RGB + binary alpha) and a gray photo-like raster.
const stencil = new Raster(4, 2, 4, new Uint8Array([
	0, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 255, 0, 0, 0, 0,
	0, 0, 0, 0, 0, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 255,
]));
const photo = new Raster(2, 2, 1, new Uint8Array([10, 20, 30, 40]));

let root, stencilKey, photoKey;

beforeAll(async () => {
	stencilKey = await stencil.key();
	photoKey = await photo.key();

	root = mkdtempSync(join(tmpdir(), "art-manifest-"));
	mkdirSync(join(root, "packs/src/arcana"), { recursive: true });
	mkdirSync(join(root, "templates/actor"), { recursive: true });
	mkdirSync(join(root, "src/hooks"), { recursive: true });
	mkdirSync(join(root, "stonetop-art/wonders"), { recursive: true });
	mkdirSync(join(root, "stonetop-art/steading"), { recursive: true });

	writeFileSync(join(root, "stonetop-art/wonders", `${stencilKey}.png`), stencil.toPng());
	writeFileSync(join(root, "stonetop-art/steading/residents.png"), photo.toPng());

	// References spread across the three scanned sources, with a duplicate.
	writeFileSync(join(root, "packs/src/arcana/a.json"), JSON.stringify({ img: `stonetop-art/wonders/${stencilKey}.png` }));
	writeFileSync(join(root, "templates/actor/steading.hbs"), `<img src="stonetop-art/steading/residents.png">`);
	writeFileSync(join(root, "src/hooks/x.js"), `const again = "stonetop-art/steading/residents.png";`);
	// Non-art mention that must NOT be collected.
	writeFileSync(join(root, "src/hooks/y.js"), `// stonetop-art/ is the store root`);
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("collectArtRefs", () => {
	it("finds unique references across pack data, templates and code", () => {
		expect(collectArtRefs(root)).toEqual([
			"steading/residents.png",
			`wonders/${stencilKey}.png`,
		]);
	});
});

describe("buildManifest", () => {
	it("keys every referenced file and adds signatures only to non-stencils", async () => {
		const manifest = await buildManifest(root, collectArtRefs(root));
		expect(manifest.size).toBe(2);

		expect(manifest.pathForKey(stencilKey)).toBe(`wonders/${stencilKey}.png`);
		const stencilEntry = manifest.entries.find((e) => e.path.startsWith("wonders/"));
		expect(stencilEntry.match).toBeNull();

		const photoEntry = manifest.entries.find((e) => e.path === "steading/residents.png");
		expect(photoEntry.key).toBe(photoKey);
		expect(photoEntry.match).toEqual({ width: 2, height: 2, thumb: photo.thumb8() });
	});

	it("fails when a referenced file is missing from the store", async () => {
		await expect(buildManifest(root, ["arcana/gone.png"])).rejects.toThrow(/unreadable.*arcana\/gone\.png/s);
	});

	it("fails when a wonders filename does not match its content key", async () => {
		writeFileSync(join(root, "stonetop-art/wonders/deadbeef.png"), photo.toPng());
		await expect(buildManifest(root, ["wonders/deadbeef.png"])).rejects.toThrow(/content-address mismatch/);
	});
});
