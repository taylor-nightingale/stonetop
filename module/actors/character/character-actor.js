import { characterSheetConfig, buildCreation } from "./character-sheet-config.js";

function slugify(name) {
	return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

const _playbookFlagCache = new Map();

export async function getPlaybookFlags(actor) {
	const slug = actor.system?.playbook?.slug;
	if (!slug) return null;

	const cached = _playbookFlagCache.get(slug);
	if (cached !== undefined) return cached;

	const pack = game.packs.get("stonetop.playbooks");
	if (!pack) {
		console.warn("Stonetop | getPlaybookFlags: pack 'stonetop.playbooks' not found");
		return null;
	}

	await pack.getIndex();
	const entry = pack.index.find(e => slugify(e.name) === slug);
	if (!entry) {
		console.warn(`Stonetop | getPlaybookFlags: no entry with slug "${slug}"`);
		return null;
	}

	const doc = await pack.getDocument(entry._id);
	const flags = doc?.flags?.stonetop ?? null;
	if (!flags) console.warn("Stonetop | getPlaybookFlags: no flags.stonetop on", doc?.name);

	_playbookFlagCache.set(slug, flags);
	return flags;
}

export class StonetopCharacterActor {
	constructor(actor) {
		this._actor = actor;
	}

	// -- Lifecycle --------------------------------------------------

	async onPlaybookAdded(documents) {
		const playbook = documents.find(d => d.type === "playbook");
		if (!playbook) return;

		const hp = playbook.flags?.stonetop?.hp;
		const damage = playbook.flags?.stonetop?.damage;
		if (!hp || !damage) return;
		await this._actor.update({
			"system.attributes.hp.max": hp,
			"system.attributes.hp.value": hp,
			"system.attributes.damage.value": damage,
		});
	}

	// -- Static API -------------------------------------------------

	static sheetConfig()               { return characterSheetConfig(); }
	static buildCreation(flags, saved) { return buildCreation(flags, saved); }
}
