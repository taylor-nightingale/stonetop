import {vi} from "vitest";

export class FakeGameBuilder {
	_packs = {};
	_worldItems = [];
	_worldActors = [];

	build() {
		const worldItems = this._worldItems;
		vi.stubGlobal("game", {
			packs: {
				get: (name) => this._packs[name] ?? null,
			},
			items: {
				contents: worldItems,
				get: (id) => worldItems.find(i => i._id === id) ?? null,
			},
			actors: this._worldActors,
			i18n: { localize: (key) => key },
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

	withWorldActor(actor) {
		this._worldActors.push(actor);
		return this;
	}
}
