const _indexCache = new Map();

export class FoundryPlaybookMoveRepository {
	async getMovesForPlaybook(playbookName) {
		if (_indexCache.has(playbookName)) return _indexCache.get(playbookName);
		const pack = game.packs.get("stonetop.playbook-moves");
		if (!pack) return [];
		await pack.getIndex({
			fields: ["system.playbook", "system.isStartingMove", "system.requirement",
				"system.stat", "system.description", "system.repeatMax", "system.resourceMax"],
		});
		const entries = [...pack.index.filter(e => e.system?.playbook === playbookName)];
		_indexCache.set(playbookName, entries);
		return entries;
	}

	async getDocument(id) {
		const pack = game.packs.get("stonetop.playbook-moves");
		if (!pack) return null;
		return pack.getDocument(id);
	}
}
