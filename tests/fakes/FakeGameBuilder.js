import {vi} from "vitest";

export class FakeGameBuilder {
	_packs = {};
	_worldItems = [];

	build() {
		const worldItems = this._worldItems;
		vi.stubGlobal("game", {
			packs: {
				get: (name) => {
					return this._packs[name] ?? null;
					if (name === "stonetop.playbook-moves") return playbookPack;
					if (name === "stonetop.basic-moves") return basicPack;
					if (name === "stonetop.post-death-moves") return postDeathPack;
					return null;
				},
			},
			items: {
				contents: worldItems,
				get: (id) => worldItems.find(i => i._id === id) ?? null,
			},
		});
	}

	withPack(playbookPackBuilder) {
		this._packs["stonetop." + playbookPackBuilder.name] = (playbookPackBuilder.build());
		return this;
	}

	withWorldItem(item) {
		this._worldItems.push(item);
		return this;
	}
}
