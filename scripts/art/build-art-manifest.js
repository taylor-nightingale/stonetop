// Builds art-manifest.json — the shipped index the in-Foundry artwork installer
// uses to recognize book images (see src/art/ArtManifest.js). It scans the repo
// for every `stonetop-art/...png` reference (pack data, templates, code), reads
// the referenced file from the local gitignored store, and records its content
// key; images that aren't pure line-art stencils also get a perceptual signature,
// since lossy-compressed pixels vary across decoders.
//
// Run `npm run art-manifest` after regenerating art or changing what packs
// reference. Requires a fully populated stonetop-art/ (npm run extract-art).
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Raster } from "../../src/art/Raster.js";
import { ArtManifest, ManifestEntry } from "../../src/art/ArtManifest.js";

const REF_PATTERN = /stonetop-art\/([\w\-./]+?\.png)/g;
const SCANNED = [
	{ dir: "packs/src", extensions: [".json"] },
	{ dir: "templates", extensions: [".hbs"] },
	{ dir: "src", extensions: [".js"] },
];

function* walk(dir) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) yield* walk(path);
		else yield path;
	}
}

/** Every store-relative art path referenced anywhere in the repo, sorted, unique. */
export function collectArtRefs(root) {
	const refs = new Set();
	for (const { dir, extensions } of SCANNED) {
		for (const file of walk(join(root, dir))) {
			if (!extensions.includes(extname(file))) continue;
			for (const m of readFileSync(file, "utf8").matchAll(REF_PATTERN)) refs.add(m[1]);
		}
	}
	return [...refs].sort();
}

/** Build the manifest for the given store-relative refs from the local art store. */
export async function buildManifest(root, refs) {
	const entries = [];
	for (const ref of refs) {
		let raster;
		try {
			raster = Raster.fromPng(readFileSync(join(root, "stonetop-art", ref)));
		} catch (e) {
			throw new Error(`referenced art file unreadable: stonetop-art/${ref} (${e.message}) — run "npm run extract-art" first`);
		}
		const key = await raster.key();
		// Wonders are content-addressed: the filename IS the key. A mismatch means
		// the store and the pack references have drifted apart.
		if (ref.startsWith("wonders/") && ref !== `wonders/${key}.png`) {
			throw new Error(`content-address mismatch: stonetop-art/${ref} has key ${key}`);
		}
		const match = raster.isStencil()
			? null
			: { width: raster.width, height: raster.height, thumb: raster.thumb8() };
		entries.push(new ManifestEntry(ref, key, match));
	}
	return new ArtManifest(entries);
}

async function main() {
	const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
	const refs = collectArtRefs(root);
	const manifest = await buildManifest(root, refs);
	const out = join(root, "art-manifest.json");
	writeFileSync(out, JSON.stringify(manifest.toJson(), null, "\t") + "\n");
	const lossy = manifest.entries.filter((e) => e.match).length;
	console.log(`art-manifest.json: ${manifest.size} entries (${lossy} with perceptual signatures)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
}
