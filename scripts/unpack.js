import { extractPack } from "@foundryvtt/foundryvtt-cli";
import { promises as fs } from "fs";

const packs = [
	"playbooks",
	"playbook-moves",
	"basic-moves",
	"special-moves",
	"follower-moves",
	"homefront-moves",
];

for (const pack of packs) {
	const src = `packs/${pack}`;
	const dest = `packs/src/${pack}`;
	try {
		await fs.access(dest);
		console.log(`Skipping ${pack} — source already exists at ${dest}`);
		continue;
	} catch {}
	await extractPack(src, dest, { nedb: false, log: true });
}
