// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import Handlebars from "handlebars";
import { readFileSync } from "fs";
import path from "path";
import { createStonetopActorDirectoryClass } from "../../src/actors/StonetopActorDirectory.js";

// The sidebar row, rendered from the file the directory actually points at — read through
// `_entryPartial` rather than hard-coded here, so renaming the template breaks this test instead of
// the sidebar.
const ENTRY_PARTIAL = createStonetopActorDirectoryClass(class {})._entryPartial;
const template = Handlebars.compile(
	readFileSync(path.resolve(ENTRY_PARTIAL.replace("systems/stonetop/", "")), "utf8"));

// Core renders this partial with the ACTOR DOCUMENT as its context, and reads getters off it
// (`thumbnail` is one of core's own). `allowProtoPropertiesByDefault` is how Foundry renders, so the
// fixture is a class instance rather than a plain object.
class FakeActorDocument {
	constructor(id, name, directoryNote) {
		this.id = id;
		this.name = name;
		this._note = directoryNote;
	}
	get thumbnail() { return "icons/svg/mystery-man.svg"; }
	get directoryNote() { return this._note; }
}

function render(actor) {
	const root = document.createElement("div");
	root.innerHTML = template(actor, {
		allowProtoPropertiesByDefault: true, allowProtoMethodsByDefault: true,
		data: { root: { documentCls: "actor" } },
	});
	return root.firstElementChild;
}

describe("the Actors sidebar row", () => {
	it("writes the playbook beside a character's name", () => {
		const li = render(new FakeActorDocument("a1", "Anwen", "The Would-Be Hero"));
		expect(li.querySelector(".entry-name").textContent.trim()).toBe("Anwen");
		expect(li.querySelector(".stonetop-directory-note").textContent.trim()).toBe("The Would-Be Hero");
	});

	it("writes nothing extra for an actor with no note", () => {
		const li = render(new FakeActorDocument("a2", "Bandit", null));
		expect(li.querySelector(".stonetop-directory-note")).toBeNull();
	});

	// Everything the directory finds the row BY. Core's click routing, drag handles, search filter
	// and context menu all read these, so our copy of its row has to keep every one.
	it("keeps the hooks core's directory drives the row with", () => {
		const li = render(new FakeActorDocument("a1", "Anwen", "The Would-Be Hero"));
		expect(li.matches("li.directory-item.entry.document.actor.flexrow")).toBe(true);
		expect(li.dataset.entryId).toBe("a1");
		expect(li.querySelector("a.entry-name.ellipsis[data-action='activateEntry']")).not.toBeNull();
		expect(li.querySelector("img.thumbnail").getAttribute("src")).toBe("icons/svg/mystery-man.svg");
	});
});

describe("the Actors directory", () => {
	it("renders its rows from our template", () => {
		expect(createStonetopActorDirectoryClass(class {})._entryPartial)
			.toBe("systems/stonetop/templates/sidebar/actor-entry.hbs");
	});

	// Built on whatever is registered, so a module that subclassed the directory first keeps its own
	// behaviour instead of being replaced.
	it("extends the class it was given", () => {
		class ModuleDirectory { static tabName = "actors"; }
		const Directory = createStonetopActorDirectoryClass(ModuleDirectory);
		expect(Object.getPrototypeOf(Directory)).toBe(ModuleDirectory);
		expect(Directory.tabName).toBe("actors");
	});
});
