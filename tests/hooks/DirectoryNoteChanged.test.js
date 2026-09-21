import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { onDirectoryNoteItemChanged } from "../../src/hooks/DirectoryNoteChanged.js";

// The Actors tab writes a character's playbook beside their name, and that lives in an EMBEDDED
// item — which a directory's own re-render never sees. Without this the list goes stale the moment
// someone picks a playbook or buys the move that renames it.

let rendered;

const item = (type, parentType = "character") => ({
	type,
	parent: parentType ? { documentName: "Actor", type: parentType } : null,
});

beforeEach(() => {
	rendered = 0;
	// Unbounced: the debounce is Foundry's, and this asserts WHICH events reach the directory.
	vi.stubGlobal("foundry", { utils: {} });
	vi.stubGlobal("ui", { actors: { render: () => { rendered += 1; } } });
});

afterEach(() => vi.unstubAllGlobals());

describe("onDirectoryNoteItemChanged", () => {
	it("redraws the directory for a character's playbook", () => {
		onDirectoryNoteItemChanged(item("playbook"));
		expect(rendered).toBe(1);
	});

	// The rename is a MOVE being taken.
	it("redraws the directory for a character's move", () => {
		onDirectoryNoteItemChanged(item("move"));
		expect(rendered).toBe(1);
	});

	it("ignores item types the note is not built from", () => {
		onDirectoryNoteItemChanged(item("arcanum"));
		onDirectoryNoteItemChanged(item("follower"));
		expect(rendered).toBe(0);
	});

	it("ignores items on other kinds of actor", () => {
		onDirectoryNoteItemChanged(item("move", "npc"));
		onDirectoryNoteItemChanged(item("move", "steading"));
		expect(rendered).toBe(0);
	});

	it("ignores an item in the world's Items directory", () => {
		onDirectoryNoteItemChanged(item("playbook", null));
		expect(rendered).toBe(0);
	});

	it("survives being handed nothing", () => {
		expect(() => onDirectoryNoteItemChanged(undefined)).not.toThrow();
		expect(rendered).toBe(0);
	});
});

describe("onDirectoryNoteItemChanged — with Foundry's debounce", () => {
	// Applying a playbook creates its moves, followers and inserts in one burst; the list only has
	// to be right once they have all landed.
	//
	// A fresh copy of the module: the debounced function is built on first use and kept, so the
	// tests above have already settled the one they imported.
	it("coalesces a burst into one render", async () => {
		const debounce = (fn, ms) => {
			let timer = null;
			return (...args) => {
				clearTimeout(timer);
				timer = setTimeout(() => fn(...args), ms);
			};
		};
		vi.stubGlobal("foundry", { utils: { debounce } });
		vi.resetModules();
		const { onDirectoryNoteItemChanged: debounced } = await import("../../src/hooks/DirectoryNoteChanged.js");

		for (let i = 0; i < 12; i += 1) debounced(item("move"));
		expect(rendered).toBe(0);
		await new Promise(resolve => setTimeout(resolve, 150));
		expect(rendered).toBe(1);
	});
});
