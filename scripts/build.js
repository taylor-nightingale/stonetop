// Bundles the client code into dist/, the single file system.json asks Foundry to load.
//
// Foundry serves that file under an unversioned URL, so browsers cache it across releases. The version
// is compiled in rather than written down: a browser running last release's bundle then reports last
// release's version, which is what lets ClientVersionCheck notice it and say so.
import esbuild from "esbuild";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The esbuild call this build is, manifest version and all. */
export function buildOptions() {
	const manifest = JSON.parse(readFileSync(join(root, "system.json"), "utf8"));
	return {
		entryPoints: [join(root, "stonetop.js")],
		outfile:     join(root, "dist/stonetop.js"),
		bundle:      true,
		format:      "esm",
		target:      "es2022",
		charset:     "utf8",
		sourcemap:   true,
		// Unminified on purpose: a stack trace in someone else's console is worth more than the bytes.
		minify:      false,
		define:      { __SYSTEM_VERSION__: JSON.stringify(manifest.version) },
	};
}

/** Where the manifest says the bundle lives, relative to the system folder Foundry serves. */
export function manifestPath() {
	return "dist/stonetop.js";
}

async function main() {
	const result = await esbuild.build({ ...buildOptions(), metafile: true });
	const [path, output] = Object.entries(result.metafile.outputs).find(([p]) => p.endsWith(".js"));
	console.log(`${path} — ${(output.bytes / 1024).toFixed(1)}kb`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		console.error(error.message);
		process.exit(1);
	});
}
