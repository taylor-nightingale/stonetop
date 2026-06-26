export const STONETOP_SCOPE = "stonetop";
export const LEGACY_STONETOP_SCOPE = "stonetop";
// Compendium item documents store their custom flags under the original system ID.
// This intentionally differs from STONETOP_SCOPE (actor flags).
export const ITEM_FLAG_SCOPE = "stonetop";
const _scope = STONETOP_SCOPE;

export class StonetopFlags {
	_namespace;


	constructor(actor, namespace) {
		this._actor = actor;
		this._namespace = namespace;
	}

	getFlag(key) {
		return this._actor.getFlag(_scope, this.buildKey(key))
			?? this._actor.flags?.[LEGACY_STONETOP_SCOPE]?.[this.buildKey(key)];
	}

	async setFlag(key, value) {
		await this._actor.setFlag(_scope, this.buildKey(key), value);
	}

	async unsetFlag(key) {
		await this._actor.unsetFlag(_scope, this.buildKey(key));
	}

	// Returns an `actor.update()` fragment that writes this flag, so callers can
	// batch it into a single document update alongside other field changes.
	updateData(key, value) {
		return { [`flags.${_scope}.${this.buildKey(key)}`]: value };
	}

	buildKey(key) {
		return `${this._namespace}.${key}`;
	}
}

export function resolvedFlags(actor) {
	return actor.flags?.[_scope] ?? actor.flags?.[LEGACY_STONETOP_SCOPE] ?? {};
}

export function resolvedFlagProperty(actor, path) {
	const scoped = actor.flags?.[_scope] ?? actor.flags?.[LEGACY_STONETOP_SCOPE];
	return foundry.utils.getProperty(scoped, path) ?? scoped?.[path];
}
