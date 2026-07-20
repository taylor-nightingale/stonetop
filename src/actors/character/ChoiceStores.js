/**
 * Where a choice write goes, keyed by the context its row was rendered in.
 *
 * Every choice row stamps `data-cg-context`, and each host registers how rows in its context resolve
 * to a `ChoiceGroupController`. Only the host knows how to find its document — an arcanum by slug, an
 * insert by item id, the playbook by being the only one — so that knowledge stays with the host, and
 * the routing here has no idea what any of those types are.
 *
 * The namespace is not part of registration: a group's slug IS the namespace its values live under,
 * and it is what the template stamped as `data-cg-group`, so `target.group` always names the store.
 */
export class ChoiceStores {
	constructor() {
		this._resolvers = new Map();   // context → (target) => ChoiceGroupController | null
	}

	/** Teach it how one or more contexts resolve. Returns this, so registration can chain. */
	register(contexts, resolver) {
		for (const context of [].concat(contexts)) this._resolvers.set(context, resolver);
		return this;
	}

	get contexts() { return [...this._resolvers.keys()]; }

	/** The controller to write through, or null when the context is unregistered or the document is
	 *  gone. Null means "nothing to write" — never an error, since this runs from a change handler. */
	resolve(target) {
		const resolver = this._resolvers.get(target?.context);
		return resolver ? resolver(target) ?? null : null;
	}
}
