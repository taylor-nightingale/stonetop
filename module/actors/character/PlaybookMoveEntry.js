export class PlaybookMoveEntry {
	constructor(entry, ownedInstances, bgMoveNames, ownedAllByName, actorLevel, actorPlaybook) {
		const isFromPlaybook   = entry.isStarting;
		const isFromBackground = bgMoveNames.has(entry.name);
		const req              = entry.requirement;
		const requiresMoves    = req?.moves ?? [];
		const repeatMax        = entry.repeatMax ?? 1;
		const lastOwnedId      = ownedInstances[ownedInstances.length - 1]?._id ?? null;

		this.name = entry.name;
		this.description = entry.description ?? "";
		this.compendiumId = entry.id;
		this.owned = ownedInstances.length > 0;
		this.ownedId = lastOwnedId;
		this.ownedIds = ownedInstances.map(i => i._id);
		this.rollType = entry.rollType;
		this.isStarting = isFromPlaybook || isFromBackground;
		this.source = isFromPlaybook ? "Starting" : isFromBackground ? "Background" : null;
		this.requiresPlaybook = req?.playbook ?? null;
		this.minLevel = req?.level ?? null;
		this.requires = requiresMoves[0] ?? null;
		this.requiresLabel = requiresMoves.length > 0 ? requiresMoves.join(", ") : null;
		this.repeatable = repeatMax > 1;
		this.locked = !this.isStarting && !!(
			requiresMoves.some(m => !ownedAllByName.has(m)) ||
			(this.requiresPlaybook && this.requiresPlaybook !== actorPlaybook) ||
			(this.minLevel && actorLevel < this.minLevel)
		);
		this.repeatChecks = this.repeatable
			? Array.from({ length: repeatMax }, (_, i) => ({
				checked: i < ownedInstances.length,
				ownedId: i < ownedInstances.length ? lastOwnedId : null,
				disabled: this.isStarting || this.locked || (!(i < ownedInstances.length) && i !== ownedInstances.length),
			}))
			: null;
		this.resource = entry.resource;
		this.resourceChecks = null;
	}
}
