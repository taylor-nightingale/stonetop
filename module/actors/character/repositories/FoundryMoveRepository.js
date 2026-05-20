import { MoveDefinition } from "../../../model/MoveDefinition.js";

const _playbookCache = new Map();
let   _basicCache    = null;

export class FoundryMoveRepository {
	async getPlaybookMoves(playbookName) {
		if (_playbookCache.has(playbookName)) return _playbookCache.get(playbookName);
		const pack = game.packs.get("stonetop.playbook-moves");
		if (!pack) return [];
		await pack.getIndex({
			fields: ["system.playbook", "system.isStartingMove", "system.requirement",
			         "system.rollType", "system.description", "system.repeatMax", "system.resource"],
		});
		const entries = pack.index
			.filter(e => e.system?.playbook === playbookName)
			.map(e => new MoveDefinition(e));
		_playbookCache.set(playbookName, entries);
		return entries;
	}

	async getPlaybookMoveDocument(id) {
		const pack = game.packs.get("stonetop.playbook-moves");
		if (!pack) return null;
		return pack.getDocument(id);
	}

	async getBasicMoves() {
		if (_basicCache) return _basicCache;
		const pack = game.packs.get("stonetop.basic-moves");
		if (!pack) return [];
		await pack.getIndex({ fields: ["system.rollType"] });
		_basicCache = [...pack.index].map(e => new MoveDefinition(e));
		return _basicCache;
	}

	async getBasicMoveDocument(id) {
		const pack = game.packs.get("stonetop.basic-moves");
		if (!pack) return null;
		return pack.getDocument(id);
	}
}
