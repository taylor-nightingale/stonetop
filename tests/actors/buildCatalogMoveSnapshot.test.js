import { describe, it, expect } from "vitest";
import { buildCatalogMoveSnapshot, buildMoveSnapshot } from "../../src/actors/embeddedMoves.js";

// A move nobody owns, resolved out of the catalog by slug: the row an untaken background draws, and
// the rows an item sheet previews. It is the same row as an owned move's — what it must NOT do is
// claim an owned id.
//
// `ownedId` is published as the row's `data-item-id`, and the roll handler resolves that against the
// ACTOR's items. A catalog entry's `_id` is a compendium id, so handing it over aims the roll at an
// item the actor does not have — and, worse, at whatever owned item happens to share that id.

const entry = {
	_id: "cmp-destined", name: "Destined", type: "move",
	system: {
		slug: "destined", rollStat: "omens", description: "At the **_start of a session_**, roll +Omens.",
		repeatMax: 1, moveResults: { success: { label: "10+", value: "a vision" } },
	},
};

describe("buildCatalogMoveSnapshot", () => {
	it("claims no owned id", () => {
		expect(buildCatalogMoveSnapshot(entry).ownedId).toBeNull();
	});

	// The id is not thrown away, it is filed where it belongs: `id` is the compendium document id.
	it("keeps the entry's id as the compendium id", () => {
		expect(buildCatalogMoveSnapshot(entry).id).toBe("cmp-destined");
	});

	// Everything a reader needs off the row comes through unchanged — this is the move, not a stub of
	// one. The point of drawing it at all is that it can be read.
	it("carries the move's own name, trigger and roll", () => {
		const snap = buildCatalogMoveSnapshot(entry);
		expect(snap.slug).toBe("destined");
		expect(snap.name).toBe("Destined");
		expect(snap.rollStat).toBe("omens");
		expect(snap.description.raw).toContain("start of a session");
		expect(snap.moveResults.success.value).toBe("a vision");
		expect(snap.gloss).toBe("start of a session");
	});

	// Nobody owns it, so nobody has taken it: an unticked row, and not one the sheet offers to tick.
	it("reads as untaken and unselectable", () => {
		const snap = buildCatalogMoveSnapshot(entry);
		expect(snap.selection.value).toBe(0);
		expect(snap.selectable).toBe(false);
	});

	it("files the move under a category the caller names", () => {
		expect(buildCatalogMoveSnapshot(entry, "background-destined").source.type).toBe("background-destined");
		expect(buildCatalogMoveSnapshot(entry).source.type).toBe("reference");
	});

	// The distinction this function exists to draw — the same entry read as an embedded item does
	// claim the id, which is right there and wrong here.
	it("differs from an embedded item's snapshot in exactly that", () => {
		expect(buildMoveSnapshot(entry, "reference", false, null).ownedId).toBe("cmp-destined");
	});

	it("survives an entry with no system data", () => {
		expect(() => buildCatalogMoveSnapshot({ _id: "x", name: "Bare" })).not.toThrow();
		expect(buildCatalogMoveSnapshot({ _id: "x", name: "Bare" }).slug).toBe("bare");
	});
});
