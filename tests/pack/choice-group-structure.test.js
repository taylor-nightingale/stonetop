import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "fs";
import path from "path";

const LORE_DIRS    = ["playbooks", "post-death-inserts"].map(d => path.resolve("packs/src", d));
const ARCANA_DIR   = path.resolve("packs/src/arcana");
const PLAYBOOK_DIR = path.resolve("packs/src/playbooks");
const VALID_TYPES  = new Set(["heading", "input", "track"]);

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

	it("heading items have title or description", () => {
		for (const { name, possessionSlug, choices } of entries) {
			for (const item of (choices.list ?? []).filter(i => i.type === "heading")) {
				expect(
					item.title != null || item.description != null,
					`${name}/${possessionSlug}: heading missing both title and description`,
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
			const lore = data.flags?.stonetop?.lore ?? [];
			if (lore.length) files.push({ name, lore });
		}
	}
	return files;
}

async function loadPlaybookChoices() {
	const entries = [];
	const files = await fs.readdir(PLAYBOOK_DIR);
	for (const name of files.filter(n => n.endsWith(".json"))) {
		const full = path.join(PLAYBOOK_DIR, name);
		const data = JSON.parse(await fs.readFile(full, "utf8"));
		const options = data.flags?.stonetop?.specialPossessions?.options ?? [];
		for (const opt of options) {
			if (opt.choices != null) entries.push({ name, possessionSlug: opt.slug, choices: opt.choices });
		}
	}
	return entries;
}

async function loadArcanaFiles() {
	const files = [];
	const entries = await fs.readdir(ARCANA_DIR);
	for (const name of entries.filter(n => n.endsWith(".json"))) {
		const full = path.join(ARCANA_DIR, name);
		const data = JSON.parse(await fs.readFile(full, "utf8"));
		const unlock = data.flags?.stonetop?.front?.unlock;
		if (unlock) files.push({ name, unlock });
	}
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

	it("first list item is always a heading", () => {
		for (const { name, unlock } of files) {
			expect(unlock.list?.[0]?.type, `${name}: first unlock list item must be a heading`).toBe("heading");
		}
	});

	it("each list item has an explicit type of heading or track", () => {
		for (const { name, unlock } of files) {
			for (const item of unlock.list ?? []) {
				expect(
					item.type === "heading" || item.type === "track",
					`${name}: unlock item type "${item.type}" must be heading or track`,
				).toBe(true);
			}
		}
	});

	it("track items have slug, description, and max", () => {
		for (const { name, unlock } of files) {
			for (const item of (unlock.list ?? []).filter(i => i.type === "track")) {
				expect(item.slug,        `${name}: track item missing slug`).toBeDefined();
				expect(item.description, `${name}/${item.slug}: track missing description`).toBeDefined();
				expect(item.max,         `${name}/${item.slug}: track missing max`).toBeDefined();
			}
		}
	});

	it("heading items have description", () => {
		for (const { name, unlock } of files) {
			for (const item of (unlock.list ?? []).filter(i => i.type === "heading")) {
				expect(item.description, `${name}: heading missing description`).toBeDefined();
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
						`${name}/${entry.slug}: item type "${item.type}" must be heading, input, or track`,
					).toBe(true);
				}
			}
		}
	});

	it("first list item is always a heading", () => {
		for (const { name, lore } of files) {
			for (const entry of lore) {
				const first = entry.list?.[0];
				expect(first?.type, `${name}/${entry.slug}: first list item must be a heading`).toBe("heading");
			}
		}
	});

	it("track items have slug, description, and max", () => {
		for (const { name, lore } of files) {
			for (const entry of lore) {
				for (const item of (entry.list ?? []).filter(i => i.type === "track")) {
					expect(item.slug,        `${name}/${entry.slug}: track item missing slug`).toBeDefined();
					expect(item.description, `${name}/${entry.slug}/${item.slug}: track missing description`).toBeDefined();
					expect(item.max,         `${name}/${entry.slug}/${item.slug}: track missing max`).toBeDefined();
				}
			}
		}
	});

	it("input items have slug and text", () => {
		for (const { name, lore } of files) {
			for (const entry of lore) {
				for (const item of (entry.list ?? []).filter(i => i.type === "input")) {
					expect(item.slug, `${name}/${entry.slug}: input item missing slug`).toBeDefined();
					expect(item.text, `${name}/${entry.slug}/${item.slug}: input item missing text`).toBeDefined();
				}
			}
		}
	});

	it("heading items have title or description", () => {
		for (const { name, lore } of files) {
			for (const entry of lore) {
				for (const item of (entry.list ?? []).filter(i => i.type === "heading")) {
					expect(
						item.title != null || item.description != null,
						`${name}/${entry.slug}: heading missing both title and description`,
					).toBe(true);
				}
			}
		}
	});
});
