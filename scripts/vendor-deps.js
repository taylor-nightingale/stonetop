// Copies the ESM builds of runtime npm dependencies into ./lib so they ship in the
// release zip and resolve by relative path in the browser (Foundry has no bundler).
// Run automatically via the "postinstall" npm script. ./lib is git-ignored.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const libDir = join(root, "lib");
mkdirSync(libDir, { recursive: true });

const vendored = [
	["node_modules/snarkdown/dist/snarkdown.es.js", "lib/snarkdown.es.js"],
];

for (const [from, to] of vendored) {
	// Strip the trailing sourceMappingURL so the browser doesn't 404 on the missing map.
	const src = readFileSync(join(root, from), "utf8")
		.replace(/\n?\/\/# sourceMappingURL=.*$/m, "\n");
	writeFileSync(join(root, to), src);
	console.log(`vendored ${from} -> ${to}`);
}
