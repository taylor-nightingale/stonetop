import {vi} from "vitest";
import {fakeI18n} from "./foundry/FakeI18n.js";

export class FakeGameBuilder {
	_packs = {};
	_worldItems = [];

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
			i18n: fakeI18n(),
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
