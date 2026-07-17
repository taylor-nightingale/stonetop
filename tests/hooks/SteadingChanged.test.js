import { describe, it, expect, vi, afterEach } from "vitest";
import { onUpdateActor, onSteadingCreatedOrDeleted } from "../../src/hooks/SteadingChanged.js";
import { FakeGameBuilder } from "../fakes/FakeGameBuilder.js";

afterEach(() => vi.unstubAllGlobals());

function makeCharacter({ rendered = true } = {}) {
	return { type: "character", sheet: { rendered, render: vi.fn() } };
}

function setup() {
	const character = makeCharacter();
	new FakeGameBuilder().withWorldActor(character).build();
	return character;
}

describe("SteadingChanged.onUpdateActor", () => {
	it("re-renders open character sheets when a steading's prosperity changes", () => {
		const character = setup();
		onUpdateActor({ type: "steading" }, { system: { attributes: { prosperity: 2 } } });
		expect(character.sheet.render).toHaveBeenCalled();
	});

	it("re-renders when prosperity changes to 0 (a real rating)", () => {
		const character = setup();
		onUpdateActor({ type: "steading" }, { system: { attributes: { prosperity: 0 } } });
		expect(character.sheet.render).toHaveBeenCalled();
	});

	it("re-renders when a steading debility changes", () => {
		const character = setup();
		onUpdateActor({ type: "steading" }, { system: { debilities: { lacking: true } } });
		expect(character.sheet.render).toHaveBeenCalled();
	});

	it("re-renders when the steading is renamed (the display shows the name)", () => {
		const character = setup();
		onUpdateActor({ type: "steading" }, { name: "Stonetop" });
		expect(character.sheet.render).toHaveBeenCalled();
	});

	it("ignores steading changes that the character sheet does not display", () => {
		const character = setup();
		onUpdateActor({ type: "steading" }, { system: { notes: "harvest festival soon" } });
		expect(character.sheet.render).not.toHaveBeenCalled();
	});

	it("ignores updates to non-steading actors", () => {
		const character = setup();
		onUpdateActor({ type: "character" }, { system: { attributes: { prosperity: 2 } } });
		expect(character.sheet.render).not.toHaveBeenCalled();
	});

	it("leaves closed character sheets alone", () => {
		const character = makeCharacter({ rendered: false });
		new FakeGameBuilder().withWorldActor(character).build();
		onUpdateActor({ type: "steading" }, { system: { debilities: { lacking: true } } });
		expect(character.sheet.render).not.toHaveBeenCalled();
	});

	it("leaves a sheet alone while its player is editing it (focus inside the sheet)", () => {
		const focused = {};
		const editing = makeCharacter();
		editing.sheet.element = { contains: (n) => n === focused };
		const idle = makeCharacter();
		idle.sheet.element = { contains: () => false };
		new FakeGameBuilder().withWorldActor(editing).withWorldActor(idle).build();
		vi.stubGlobal("document", { activeElement: focused });
		onUpdateActor({ type: "steading" }, { system: { attributes: { prosperity: 2 } } });
		expect(editing.sheet.render).not.toHaveBeenCalled();
		expect(idle.sheet.render).toHaveBeenCalled();
	});

	it("unwraps a jQuery-style element when checking focus", () => {
		const focused = {};
		const editing = makeCharacter();
		editing.sheet.element = { 0: { contains: (n) => n === focused }, length: 1 };
		new FakeGameBuilder().withWorldActor(editing).build();
		vi.stubGlobal("document", { activeElement: focused });
		onUpdateActor({ type: "steading" }, { system: { attributes: { prosperity: 2 } } });
		expect(editing.sheet.render).not.toHaveBeenCalled();
	});
});

describe("SteadingChanged.onSteadingCreatedOrDeleted", () => {
	it("re-renders open character sheets when a steading appears or disappears", () => {
		const character = setup();
		onSteadingCreatedOrDeleted({ type: "steading" });
		expect(character.sheet.render).toHaveBeenCalled();
	});

	it("ignores other actor types", () => {
		const character = setup();
		onSteadingCreatedOrDeleted({ type: "npc" });
		expect(character.sheet.render).not.toHaveBeenCalled();
	});
});
