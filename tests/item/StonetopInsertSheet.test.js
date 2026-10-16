// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { createStonetopInsertSheetClass } from "../../src/item/StonetopInsertSheet.js";

function makeSheet() {
	const Base = class {
		get item() { return { system: { moves: [], startingMoves: [] } }; }
	};
	return new (createStonetopInsertSheetClass(Base))();
}

function stubMovesPack() {
	const entries = [{ _id: "m1", name: "Invoke", system: { slug: "invoke" } }];
	global.game = {
		i18n:  global.game?.i18n,
		packs: { get: name => name === "stonetop.moves" ? {
			getIndex:     vi.fn(async () => {}),
			index:        entries,
			getDocuments: vi.fn(async () => entries.map(e => ({ ...e, toObject: () => e }))),
			folders:      [],
		} : null },
		items: { contents: [], get: () => null },
	};
}

afterEach(() => { global.game = { i18n: global.game?.i18n }; });

describe("StonetopInsertSheet._pickOrCreateMove — the picker", () => {
	// Opened from a popped-out insert sheet, the picker appears over it rather than back in the main
	// workspace.
	it("asks in the window the sheet is in", async () => {
		stubMovesPack();
		const sheet  = makeSheet();
		sheet.window = { windowId: "stonetop-insert-abc" };
		const saved  = foundry.applications.api;
		const prompt = vi.fn(async () => null);
		foundry.applications.api = { ...saved, DialogV2: { prompt } };
		try {
			await sheet._pickOrCreateMove();
		} finally {
			foundry.applications.api = saved;
		}
		expect(prompt.mock.calls[0][0].renderOptions).toEqual({ window: { windowId: "stonetop-insert-abc" } });
	});
});
