// Resolves a translation merge, for the authoring files git cannot merge on its own.
//   npm run i18n:merge            — during a conflicted merge, unions HEAD against MERGE_HEAD
//   npm run i18n:merge <ref>      — unions the working tree against that ref instead
//
// Run this INSTEAD of resolving languages/compendium/<lang>/*.json by hand, then `npm run
// i18n:extract` to reconcile the union against the packs. See mergeAuthoring.js for which side
// wins and why.
import { execFileSync } from "child_process";
import { pathToFileURL } from "url";
import path from "path";
import { AuthoringFile } from "./mergeAuthoring.js";
import { TRANSLATED_PACKS, authoringPath, listLanguages, writeAuthoring } from "./files.js";
import { TAG_PACK } from "./tagLabels.js";

const MERGED_PACKS = [...TRANSLATED_PACKS, TAG_PACK];

/** An authoring file as of a git ref, or an empty one if the ref never had it. */
export function authoringAt(ref, file, root = ".") {
	const relative = path.relative(root, file).split(path.sep).join("/");
	try {
		return JSON.parse(execFileSync("git", ["show", `${ref}:${relative}`], {
			cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
		}));
	} catch {
		return {};
	}
}

/** True while a merge is in progress, which is the only time MERGE_HEAD resolves. */
export function mergeInProgress(root = ".") {
	try {
		execFileSync("git", ["rev-parse", "--verify", "MERGE_HEAD"], { cwd: root, stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

export async function mergeTranslations({ incoming, root = "." } = {}) {
	const theirRef = incoming ?? "MERGE_HEAD";
	if (!incoming && !mergeInProgress(root)) {
		throw new Error("No merge in progress. Pass the incoming ref explicitly: npm run i18n:merge -- origin/main");
	}

	const languages = await listLanguages(root);
	const summaries = [];

	for (const lang of languages) {
		for (const pack of MERGED_PACKS) {
			const file = authoringPath(lang, pack, root);

			// Ours comes from HEAD rather than the working tree: git has already written its own
			// textual merge (or conflict markers) into the file on disk, and neither is our input.
			const mine     = AuthoringFile.fromJson(authoringAt("HEAD", file, root));
			const theirs   = AuthoringFile.fromJson(authoringAt(theirRef, file, root));
			const merged   = mine.mergedWith(theirs);

			await writeAuthoring(lang, pack, merged.toJson(), root);
			summaries.push({
				lang, pack,
				ours: mine.translatedCount, theirs: theirs.translatedCount, merged: merged.translatedCount,
			});
		}
	}

	for (const s of summaries) {
		const gained = s.merged - s.ours;
		console.log(`${s.lang}/${s.pack}: ${s.merged} translated (ours ${s.ours} + ${gained} incoming)`);
	}
	const total = summaries.reduce((n, s) => n + s.merged, 0);
	const ours  = summaries.reduce((n, s) => n + s.ours, 0);
	console.log(`\n${total} translated strings after merge, up from ${ours}.`);
	console.log("Now run: npm run i18n:extract");
	return summaries;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const incoming = process.argv.slice(2).find(arg => !arg.startsWith("-"));
	mergeTranslations({ incoming }).catch(err => { console.error(err.message); process.exit(1); });
}
