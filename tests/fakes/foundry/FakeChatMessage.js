export class FakeChatMessage {
	static _created = [];

	static async create(data) {
		FakeChatMessage._created.push(data);
		return data;
	}

	static getSpeaker() {
		return {};
	}

	static reset() {
		FakeChatMessage._created = [];
	}

	static get lastCreated() {
		return FakeChatMessage._created.at(-1) ?? null;
	}
}
