import { renderSelectionRow, stripStatPlusSigns } from "./character-sheet.js";
import { characterSheetConfig, buildCreation } from "./character-sheet-config.js";

function slugify(name) {
	return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
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

	// -- Sheet Rendering --------------------------------------------

	async renderSheet(sheet, html) {
		const flags = await this._getPlaybookFlags();
		renderSelectionRow(this._actor, html, flags);
		stripStatPlusSigns(html);
	}

	// -- Playbook flags ---------------------------------------------

	// Always resolve from the compendium — the embedded item copy can have stale flags.
	// Results are cached by slug; compendium data doesn't change during a session.
	async _getPlaybookFlags() {
		const slug = this._actor.system?.playbook?.slug;
		if (!slug) {
			console.warn("Stonetop | _getPlaybookFlags: no slug on actor.system.playbook:", this._actor.system?.playbook);
			return null;
		}

		const cached = StonetopCharacterActor._playbookFlagCache.get(slug);
		if (cached !== undefined) return cached;

		const pack = game.packs.get("stonetop.playbooks");
		if (!pack) {
			console.warn("Stonetop | _getPlaybookFlags: pack 'stonetop.playbooks' not found");
			return null;
		}

		await pack.getIndex();
		const entry = pack.index.find(e => slugify(e.name) === slug);
		if (!entry) {
			console.warn(`Stonetop | _getPlaybookFlags: no entry with slug "${slug}"`);
			return null;
		}

		const doc = await pack.getDocument(entry._id);
		const flags = doc?.flags?.stonetop ?? null;
		if (!flags) console.warn("Stonetop | _getPlaybookFlags: no flags.stonetop on", doc?.name);

		StonetopCharacterActor._playbookFlagCache.set(slug, flags);
		return flags;
	}

	static _playbookFlagCache = new Map();

	// -- Static API -------------------------------------------------

	static sheetConfig()               { return characterSheetConfig(); }
	static buildCreation(flags, saved) { return buildCreation(flags, saved); }
}
