import { extractPack } from "@foundryvtt/foundryvtt-cli";
import { promises as fs } from "fs";
import { PACKS } from "./packs.js";

for (const pack of PACKS) {
	const src = `packs/${pack}`;
	const dest = `packs/src/${pack}`;
	try {
		await fs.access(dest);
		console.log(`Skipping ${pack} — source already exists at ${dest}`);
		continue;
	} catch {}
	await extractPack(src, dest, { nedb: false, log: true });
}
