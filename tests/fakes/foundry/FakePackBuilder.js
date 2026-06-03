export class FakePackBuilder {
	_items = [];
	name;

	constructor(name) {
		this.name = name;
	}

	withItem(item) {
		this._items.push(item);
		return this;
	}

	build() {
		const items = this._items;
		return {
			async getIndex() {},
			index: items,
			async getDocument(id) { return items.find(e => e._id === id) ?? null; },
		};
	}

	static playbookMovesPack() {
		return new FakePackBuilder("playbook-moves");
	}

	static basicMovesPack() {
		return new FakePackBuilder("basic-moves");
	}

	static postDeathMovesPack() {
		return new FakePackBuilder("post-death-moves");
	}
}
