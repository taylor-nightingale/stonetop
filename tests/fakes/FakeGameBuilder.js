import {vi} from "vitest";
import {fakeI18n} from "./foundry/FakeI18n.js";

export class FakeGameBuilder {
	_packs = {};
	_worldItems = [];
	_worldActors = [];
	_translations = {};

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
			// fakeI18n's format/has read the real en.json; localize still honors withTranslation()
			// overrides and falls back to the key like fakeI18n does.
			i18n: { ...fakeI18n(), localize: (key) => this._translations[key] ?? key },
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

	withTranslation(key, value) {
		this._translations[key] = value;
		return this;
	}
}
