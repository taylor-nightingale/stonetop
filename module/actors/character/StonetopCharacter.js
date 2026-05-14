import {StonetopPlaybook} from "../../item/StonetopPlaybook.js";
import {MoveResources} from "./MoveResources.js";
import {StonetopFlags} from "./StonetopFlags.js";
import {CharacterBackgrounds} from "./CharacterBackgrounds.js";
import {CharacterInstincts} from "./CharacterInstincts.js";


const _playbookCache = new Map();

export class StonetopCharacter {
	_actor;

	/**
	 *
	 * @param stonetopActor {stonetopActor}
	 */
	constructor(stonetopActor) {
		this._actor = stonetopActor;
		this._moveResources = new MoveResources(new StonetopFlags(this._actor, "moves"));
		this._background = new CharacterBackgrounds(new StonetopFlags(this._actor, "background"));
		this._instincts = new CharacterInstincts(new StonetopFlags(this._actor, "instincts"));
	}

	get type() {
		return this._actor.type;
	}

	get background() {
		return this._background;
	}

	get moveResources() {
		return this._moveResources;
	}

	get instinct() {
		return this._instincts;
	}

	async updateName(name) {
		await this._actor.update({name});
	}

	async _onCreateDescendantDocuments(documents) {
		const stonetopItem = documents.find(d => d.type === "playbook");
		if (!stonetopItem) return;
		const stonetopPlaybook = stonetopItem.asPlaybook()

		const hp = stonetopPlaybook.hp
		const damage = stonetopPlaybook.damage;

		if (!hp || !damage) return;
		await this._actor.update({
			"system.attributes.hp.max": hp,
			"system.attributes.hp.value": hp,
			"system.attributes.damage.value": damage,
		});
	}

	async playbook() {
		const slug = this.system?.playbook?.slug;
		if (!slug) return null;

		const cached = _playbookCache.get(slug);
		if (cached !== undefined) return cached;

		const pack = game.packs.get("stonetop.playbooks");
		if (!pack) {
			console.warn("Stonetop | getStonetopPlaybook: pack 'stonetop.playbooks' not found");
			return null;
		}

		await pack.getIndex();
		const entry = pack.index.find(e => this.slugify(e.name) === slug);
		if (!entry) {
			console.warn(`Stonetop | getPlaybookFlags: no entry with slug "${slug}"`);
			return null;
		}

		const doc = await pack.getDocument(entry._id);
		const playbook = new StonetopPlaybook(doc)
		_playbookCache.set(slug, playbook);

		return playbook;
	}

	slugify(name) {
		return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
	}

}
