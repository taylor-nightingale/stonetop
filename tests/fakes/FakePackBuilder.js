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
		return {
			getIndex: vi.fn(async () => {
			}),
			index: this._items,
			getDocument: vi.fn(async (id) => this._items.find(e => e._id === id) ?? null),
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
