// Where a document dropped on the steading goes, keyed by the item type it carries.
//
// A registry rather than a chain of `if (item.type === …)`: a new droppable type is a registration
// at composition, not another branch inside the steading. `handle` reports whether anything claimed
// the drop — false tells the sheet to fall back to core's default embed.
export class SteadingDropRouter {
	#handlers = new Map();

	register(itemType, handler) {
		this.#handlers.set(itemType, handler);
		return this;
	}

	async handle(item) {
		const handler = this.#handlers.get(item?.type);
		if (!handler) return false;
		await handler(item);
		return true;
	}
}
