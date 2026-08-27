// Where translation files live, and what a language is.
//
// A language exists because it has a directory under languages/compendium/. Nothing else has to be
// edited to start one: `npm run i18n:extract es` creates the directory and its files, and the check
// and the language build then discover it by listing this directory.

import { promises as fs } from "fs";
import path from "path";

// Widened one pack at a time: each needs an allowlist in src/i18n/translatablePaths.js first.
export const TRANSLATED_PACKS = [
	"playbooks", "moves", "arcana", "possessions", "followers",
	"outfit-items", "inserts", "steading-improvements", "steadfasts",
];

export const compendiumDir = (root = ".") => path.join(root, "languages", "compendium");
export const languageDir    = (lang, root = ".") => path.join(compendiumDir(root), lang);
export const authoringPath  = (lang, pack, root = ".") => path.join(languageDir(lang, root), `${pack}.json`);
export const languageFilePath = (lang, root = ".") => path.join(root, "languages", `${lang}.json`);

export async function listLanguages(root = ".") {
	let entries;
	try {
		entries = await fs.readdir(compendiumDir(root), { withFileTypes: true });
	} catch {
		return [];
	}
	return entries.filter(e => e.isDirectory() && !e.name.startsWith("_")).map(e => e.name).sort();
}

export async function readJson(file, fallback = null) {
	try {
		return JSON.parse(await fs.readFile(file, "utf8"));
	} catch (err) {
		if (err.code === "ENOENT") return fallback;
		throw new Error(`Failed parsing ${file}`, { cause: err });
	}
}

export async function writeJson(file, data) {
	await fs.mkdir(path.dirname(file), { recursive: true });
	await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export const readAuthoring  = (lang, pack, root = ".") => readJson(authoringPath(lang, pack, root), {});
export const writeAuthoring = (lang, pack, data, root = ".") => writeJson(authoringPath(lang, pack, root), data);
