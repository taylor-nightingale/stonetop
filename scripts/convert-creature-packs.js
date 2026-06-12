// One-time, idempotent converter that rewrites follower/creature pack JSON to the current
// CreatureData shape: hp {value,max}, armor as prose string, damage as prose string,
// instinct split into instinct + markdown `moves`, and cost/notes promoted out of the
// `choices` entries into first-class fields (those entries are then dropped, leaving picks).
//
//   node scripts/convert-creature-packs.js
//
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC  = join(ROOT, "packs/src/followers");
const PROMOTED = ["weapon", "damage", "cost", "notes"];

function walk(dir) {
	return readdirSync(dir).flatMap(name => {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) return name === "_folders" ? [] : walk(p);
		return p.endsWith(".json") ? [p] : [];
	});
}

function composeArmor(a) {
	if (a == null) return "";
	if (typeof a === "string") return a;
	return `${a.value ?? ""} ${a.note ?? ""}`.trim();
}

function composeDamage(d) {
	if (d == null) return "";
	if (typeof d === "string") return d;
	const die = d.value ?? d.die ?? "";
	const core = [d.label, die].filter(Boolean).join(" ");
	return (d.tags ? (core ? `${core} (${d.tags})` : `(${d.tags})`) : core).trim();
}

function convert(sys) {
	if (sys.hp && typeof sys.hp === "object") sys.hp = { value: sys.hp.value ?? 0, max: sys.hp.max ?? 0 };
	sys.armor  = composeArmor(sys.armor);
	sys.damage = composeDamage(sys.damage);

	const group = Array.isArray(sys.choices) ? sys.choices[0] : null;
	const entryDefault = slug => (group?.list ?? []).find(e => e.slug === slug)?.input?.default ?? "";

	if (sys.moves === undefined) {
		if (typeof sys.instinct === "string" && sys.instinct.includes("\n")) {
			const lines = sys.instinct.split("\n");
			sys.instinct = lines[0].trim();
			sys.moves = lines.slice(1)
				.map(l => l.replace(/^\s*[-ä>•]\s*/, "").trim()).filter(Boolean)
				.map(l => `- ${l}`).join("\n");
		} else {
			sys.moves = "";
		}
	}
	if (sys.cost  === undefined) sys.cost  = entryDefault("cost");
	if (sys.notes === undefined) sys.notes = entryDefault("notes");
	if (sys.reference === undefined) sys.reference = null;

	// The cost text trailing "; Loyalty" is redundant with the loyalty track — drop it.
	if (typeof sys.cost === "string") sys.cost = sys.cost.replace(/[;,]?\s*loyalty\s*$/i, "").trim();

	if (group?.list) group.list = group.list.filter(e => !PROMOTED.includes(e.slug));
	return sys;
}

let changed = 0;
for (const file of walk(SRC)) {
	const doc = JSON.parse(readFileSync(file, "utf8"));
	if (!doc.system) continue;
	const before = JSON.stringify(doc.system);
	convert(doc.system);
	if (JSON.stringify(doc.system) !== before) {
		writeFileSync(file, JSON.stringify(doc, null, "\t") + "\n");
		changed++;
		console.log(`converted ${file.replace(ROOT + "/", "")}`);
	}
}
console.log(`Done — ${changed} file(s) changed.`);
