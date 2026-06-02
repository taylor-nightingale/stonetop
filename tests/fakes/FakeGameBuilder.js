import {vi} from "vitest";

export class FakeGameBuilder {
	_packs = {};

	build() {
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
		});
	}

	withPack(playbookPackBuilder) {
		this._packs["stonetop." + playbookPackBuilder.name] = (playbookPackBuilder.build());
		return this;
	}
}
