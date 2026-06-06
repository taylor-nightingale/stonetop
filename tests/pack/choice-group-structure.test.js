import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "fs";
import path from "path";

const LORE_DIRS       = ["playbooks", "inserts"].map(d => path.resolve("packs/src", d));
const ARCANA_DIR      = path.resolve("packs/src/arcana");
const POSSESSIONS_DIR = path.resolve("packs/src/possessions");
const VALID_TYPES     = new Set(["entry", "pick"]);

describe("Pack possession choices use the ChoiceGroup format", () => {
	let entries;
	beforeAll(async () => { entries = await loadPlaybookChoices(); });

	it("loads at least one possession with choices", () => {
		expect(entries.length).toBeGreaterThan(0);
	});

	it("each choices has a slug and list, not an array", () => {
		for (const { name, possessionSlug, choices } of entries) {
			expect(Array.isArray(choices), `${name}/${possessionSlug}: choices must not be an array`).toBe(false);
			expect(choices, `${name}/${possessionSlug}: choices missing slug`).toHaveProperty("slug");
			expect(choices, `${name}/${possessionSlug}: choices missing list`).toHaveProperty("list");
		}
	});

	it("each list item has an explicit type", () => {
		for (const { name, possessionSlug, choices } of entries) {
			for (const item of choices.list ?? []) {
				expect(item.type, `${name}/${possessionSlug}: list item missing type`).toBeDefined();
			}
		}
	});

	it("entry items have content with title or text", () => {
		for (const { name, possessionSlug, choices } of entries) {
			for (const item of (choices.list ?? []).filter(i => i.type === "entry")) {
				expect(
					item.content?.title != null || item.content?.text != null,
					`${name}/${possessionSlug}: entry missing both content.title and content.text`,
				).toBe(true);
			}
		}
	});

	it("pick items have pickCount and options", () => {
		for (const { name, possessionSlug, choices } of entries) {
			for (const item of (choices.list ?? []).filter(i => i.type === "pick")) {
				expect(item.pickCount, `${name}/${possessionSlug}: pick item missing pickCount`).toBeDefined();
				expect(item.options,   `${name}/${possessionSlug}: pick item missing options`).toBeDefined();
			}
		}
	});

	it("each pick option has slug and text", () => {
		for (const { name, possessionSlug, choices } of entries) {
			for (const item of (choices.list ?? []).filter(i => i.type === "pick")) {
				for (const opt of item.options ?? []) {
					expect(opt.slug, `${name}/${possessionSlug}: pick option missing slug`).toBeDefined();
					expect(opt.text, `${name}/${possessionSlug}/${opt.slug}: pick option missing text`).toBeDefined();
				}
			}
		}
	});
});

async function loadLoreFiles() {
	const files = [];
	for (const dir of LORE_DIRS) {
		const entries = await fs.readdir(dir);
		for (const name of entries.filter(n => n.endsWith(".json"))) {
			const full = path.join(dir, name);
			const data = JSON.parse(await fs.readFile(full, "utf8"));
			const lore = data.system?.lore ?? data.system?.choices ?? data.flags?.stonetop?.lore ?? [];
			if (lore.length) files.push({ name, lore });
		}
	}
	return files;
}

async function loadPlaybookChoices() {
	const entries = [];
	const files = await fs.readdir(POSSESSIONS_DIR);
	for (const name of files.filter(n => n.endsWith(".json"))) {
		const full = path.join(POSSESSIONS_DIR, name);
		const data = JSON.parse(await fs.readFile(full, "utf8"));
		const choices = data.system?.choices;
		if (choices != null) entries.push({ name, possessionSlug: data.system?.slug, choices });
	}
	return entries;
}

async function loadArcanaFiles() {
	const files = [];
	async function scanDir(dir) {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory() && !entry.name.startsWith("_")) {
				await scanDir(full);
			} else if (entry.name.endsWith(".json")) {
				const data = JSON.parse(await fs.readFile(full, "utf8"));
				const unlock = data.system?.front?.unlock;
				if (unlock) files.push({ name: entry.name, unlock });
			}
		}
	}
	await scanDir(ARCANA_DIR);
	return files;
}

describe("Pack arcana unlock entries use the list format", () => {
	let files;
	beforeAll(async () => { files = await loadArcanaFiles(); });

	it("loads at least one arcana file with an unlock", () => {
		expect(files.length).toBeGreaterThan(0);
	});

	it("each unlock has a slug and list, not description/requirements", () => {
		for (const { name, unlock } of files) {
			expect(unlock, `${name}: unlock should have slug`).toHaveProperty("slug");
			expect(unlock, `${name}: unlock should have list`).toHaveProperty("list");
			expect(unlock, `${name}: unlock should not have description`).not.toHaveProperty("description");
			expect(unlock, `${name}: unlock should not have requirements`).not.toHaveProperty("requirements");
		}
	});

	it("first list item is always an entry", () => {
		for (const { name, unlock } of files) {
			expect(unlock.list?.[0]?.type, `${name}: first unlock list item must be an entry`).toBe("entry");
		}
	});

	it("each list item has an explicit type of entry or pick", () => {
		for (const { name, unlock } of files) {
			for (const item of unlock.list ?? []) {
				expect(
					VALID_TYPES.has(item.type),
					`${name}: unlock item type "${item.type}" must be entry or pick`,
				).toBe(true);
			}
		}
	});

	it("entry items with track have slug and max", () => {
		for (const { name, unlock } of files) {
			for (const item of (unlock.list ?? []).filter(i => i.type === "entry" && i.track)) {
				expect(item.slug,        `${name}: entry+track item missing slug`).toBeDefined();
				expect(item.track.max,   `${name}/${item.slug}: entry+track missing max`).toBeDefined();
			}
		}
	});

	it("entry items have content.text", () => {
		for (const { name, unlock } of files) {
			for (const item of (unlock.list ?? []).filter(i => i.type === "entry")) {
				expect(item.content?.text, `${name}: entry missing content.text`).toBeDefined();
			}
		}
	});
});

describe("Pack lore entries use the list format", () => {
	let files;
	beforeAll(async () => { files = await loadLoreFiles(); });

	it("loads at least one file with lore", () => {
		expect(files.length).toBeGreaterThan(0);
	});

	it("each lore entry has slug and list, not options/title/description at top level", () => {
		for (const { name, lore } of files) {
			for (const entry of lore) {
				expect(entry, `${name}: entry missing slug`).toHaveProperty("slug");
				expect(entry, `${name}/${entry.slug}: should have list`).toHaveProperty("list");
				expect(entry, `${name}/${entry.slug}: should not have options`).not.toHaveProperty("options");
				expect(entry, `${name}/${entry.slug}: should not have title`).not.toHaveProperty("title");
				expect(entry, `${name}/${entry.slug}: should not have description`).not.toHaveProperty("description");
			}
		}
	});

	it("each list item has an explicit type", () => {
		for (const { name, lore } of files) {
			for (const entry of lore) {
				for (const item of entry.list ?? []) {
					expect(
						VALID_TYPES.has(item.type),
						`${name}/${entry.slug}: item type "${item.type}" must be entry or pick`,
					).toBe(true);
				}
			}
		}
	});

	it("first list item is a valid type", () => {
		for (const { name, lore } of files) {
			for (const entry of lore) {
				const first = entry.list?.[0];
				if (first) expect(VALID_TYPES.has(first.type), `${name}/${entry.slug}: first item type "${first.type}" must be entry or pick`).toBe(true);
			}
		}
	});

	it("entry items with track have slug and max", () => {
		for (const { name, lore } of files) {
			for (const entry of lore) {
				for (const item of (entry.list ?? []).filter(i => i.type === "entry" && i.track)) {
					expect(item.slug,       `${name}/${entry.slug}: entry+track item missing slug`).toBeDefined();
					expect(item.track.max,  `${name}/${entry.slug}/${item.slug}: entry+track missing max`).toBeDefined();
				}
			}
		}
	});

	it("entry items have content with title or text", () => {
		for (const { name, lore } of files) {
			for (const entry of lore) {
				for (const item of (entry.list ?? []).filter(i => i.type === "entry")) {
					expect(
						item.content?.title != null || item.content?.text != null,
						`${name}/${entry.slug}: entry missing both content.title and content.text`,
					).toBe(true);
				}
			}
		}
	});
});
