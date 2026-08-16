import { GrantStamp } from "../model/data/ItemGrant.js";

/**
 * Deletes the extra copies a source ended up granting more than once.
 *
 * Until the acting-client guard landed, every connected client ran the grant logic, so a playbook
 * dropped with a GM and a player online created its moves (and followers, inserts, possessions) once
 * per client. Nothing creates duplicates now — grants are diffed against a stamp — so this runs once,
 * at migration, to clean up the worlds that already have them.
 *
 * The copy with the most of the player's work in it wins: the acquired move, the follower whose
 * loyalty was marked, the possession that was used. Ties keep the earliest, which is the copy every
 * find-by-slug on the sheet already resolves to.
 */
export class DuplicateGrantPruner {
	constructor(actor) {
		this._actor = actor;
	}

	async prune() {
		const ids = this._duplicates().map(item => item._id);
		// stonetopMigration: these deletes must not re-enter the grant router — revoking the source of a
		// pruned duplicate would take the copy being kept with it.
		if (ids.length) await this._actor.deleteEmbeddedDocuments("Item", ids, { stonetopMigration: true });
		return ids;
	}

	_duplicates() {
		const byStamp = new Map();
		for (const item of this._actor.items ?? []) {
			const stamp = GrantStamp.of(item);
			if (!stamp) continue;   // authored items are nobody's grant, and two of them are two things
			const id = `${stamp.source}|${stamp.key}`;
			if (!byStamp.has(id)) byStamp.set(id, []);
			byStamp.get(id).push(item);
		}
		return [...byStamp.values()]
			.filter(items => items.length > 1)
			.flatMap(items => this._losers(items));
	}

	_losers(items) {
		const best = items.reduce((a, b) => (_playerState(b) > _playerState(a) ? b : a));
		return items.filter(item => item !== best);
	}
}

// How much of the player's work an item is carrying. Only ever compared between copies of the SAME
// grant, so the scales don't have to mean anything across types.
function _playerState(item) {
	const system = item.system ?? {};
	switch (item.type) {
		case "move":       return system.instanceCount ?? (system.acquired ? 1 : 0);
		case "follower":   return _count(system.loyalty?.value)
			+ (system.members ?? []).reduce((n, m) => n + _count(m?.hp?.value), 0)
			+ _filled(system.choiceValues);
		case "possession": return (system.selected ? 1 : 0) + _count(system.uses)
			+ _filled(system.pickValues) + _filled(system.choiceUses);
		case "insert":     return _filled(system.choiceValues);
		default:           return 0;
	}
}

function _count(value)  { return typeof value === "number" ? Math.abs(value) : 0; }
function _filled(bag)   { return Object.keys(bag ?? {}).length ? 1 : 0; }
