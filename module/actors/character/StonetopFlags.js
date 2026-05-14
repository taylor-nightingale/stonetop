const _scope = "stonetop";
export class StonetopFlags {
	_namespace;


	constructor(actor, namespace) {
		this._actor = actor;
		this._namespace = namespace;
	}

	getFlag(key) {
		return this._actor.getFlag(_scope, this.buildKey(key));
	}

	async setFlag(key, value) {
		await this._actor.setFlag(_scope, this.buildKey(key), value);
	}

	buildKey(key) {
		return `${this._namespace}.${key}`;
	}
}
