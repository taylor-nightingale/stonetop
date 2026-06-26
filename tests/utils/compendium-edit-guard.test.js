import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { isInCompendium, warnCompendiumImmutable, blockCompendiumEdit } from "../../module/utils/compendium-edit-guard.js";

// The module shows its guidance via `new Dialog(data).render(true)` and keeps a private
// `_dialogOpen` flag that the dialog's own `close` callback resets. Capture the dialogs
// and, after each test, fire their close callbacks so the flag never leaks across tests.
let dialogs;
class FakeDialog {
	constructor(data) { this.data = data; dialogs.push(this); }
	render() { return this; }
}

beforeEach(() => {
	dialogs = [];
	global.Dialog = FakeDialog;
});
afterEach(() => { dialogs.forEach((d) => d.data.close?.()); });

const lastContent = () => dialogs.at(-1)?.data.content ?? "";

function fakeEvent(matches) {
	return {
		target: { closest: () => (matches ? {} : null) },
		preventDefault: vi.fn(),
		stopPropagation: vi.fn(),
	};
}

describe("isInCompendium", () => {
	it("is true for a document with its own pack", () => {
		expect(isInCompendium({ pack: "stonetop.stonetop-bestiary" })).toBe(true);
	});
	it("is true for an embedded document whose parent has a pack (a page)", () => {
		expect(isInCompendium({ parent: { pack: "stonetop.stonetop-journal" } })).toBe(true);
	});
	it("is true via a compendium collection reference", () => {
		expect(isInCompendium({ compendium: {} })).toBe(true);
		expect(isInCompendium({ parent: { compendium: {} } })).toBe(true);
	});
	it("is false for a world document and for nullish input", () => {
		expect(isInCompendium({ name: "World Actor" })).toBe(false);
		expect(isInCompendium(null)).toBe(false);
		expect(isInCompendium(undefined)).toBe(false);
	});
});

describe("warnCompendiumImmutable", () => {
	it("points an Actor at the Actors tab and names it a stat block", () => {
		warnCompendiumImmutable({ documentName: "Actor", name: "Hagr" });
		const { title, content } = dialogs.at(-1).data;
		expect(title).toBe("Compendium content can't be edited");
		expect(content).toContain("Hagr");
		expect(content).toContain("<strong>Actors</strong>");
		expect(content).toContain('class="fas fa-download"'); // the Import-button icon
	});

	it("maps a JournalEntryPage to the Journal tab", () => {
		warnCompendiumImmutable({ documentName: "JournalEntryPage", name: "The Maw" });
		expect(lastContent()).toContain("<strong>Journal</strong>");
	});

	it("maps an Item to the Items tab", () => {
		warnCompendiumImmutable({ documentName: "Item", name: "Red Scepter" });
		expect(lastContent()).toContain("<strong>Items</strong>");
	});

	it("escapes the document name", () => {
		warnCompendiumImmutable({ documentName: "Item", name: "<b>x</b>" });
		expect(lastContent()).toContain("&lt;b&gt;x&lt;/b&gt;");
		expect(lastContent()).not.toContain("<b>x</b>");
	});

	it("does not stack a second dialog while one is already open", () => {
		warnCompendiumImmutable({ documentName: "Actor", name: "Hagr" });
		warnCompendiumImmutable({ documentName: "Actor", name: "Hagr" });
		expect(dialogs.length).toBe(1);
	});
});

describe("blockCompendiumEdit", () => {
	it("does nothing for a world document", () => {
		const ev = fakeEvent(true);
		expect(blockCompendiumEdit({ name: "World Actor" }, ev, ".edit")).toBe(false);
		expect(ev.preventDefault).not.toHaveBeenCalled();
		expect(dialogs.length).toBe(0);
	});

	it("does nothing when the event misses the edit selector", () => {
		const ev = fakeEvent(false);
		expect(blockCompendiumEdit({ pack: "p" }, ev, ".edit")).toBe(false);
		expect(dialogs.length).toBe(0);
	});

	it("blocks the event and warns for a compendium document", () => {
		const ev = fakeEvent(true);
		expect(blockCompendiumEdit({ documentName: "Actor", pack: "p", name: "Hagr" }, ev, ".edit")).toBe(true);
		expect(ev.preventDefault).toHaveBeenCalled();
		expect(ev.stopPropagation).toHaveBeenCalled();
		expect(dialogs.length).toBe(1);
	});
});
