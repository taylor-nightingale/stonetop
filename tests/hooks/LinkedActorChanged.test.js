import { afterEach, describe, expect, it, vi } from "vitest";
import { onUpdateLinkedActor, onDeleteLinkedActor } from "../../src/hooks/LinkedActorChanged.js";

function steadingSheet(links, render = vi.fn()) {
	return {
		type: "steading",
		sheet: { rendered: true, element: { contains: () => false }, render },
		typedActor: { linksDocument: uuid => links.includes(uuid) },
	};
}

function stubGame(actors) {
	vi.stubGlobal("game", { actors });
	vi.stubGlobal("document", { activeElement: null });
}

afterEach(() => vi.unstubAllGlobals());

describe("onUpdateLinkedActor", () => {
	it("re-renders a steading whose roster links the renamed actor", () => {
		const render = vi.fn();
		stubGame([steadingSheet(["Actor.willa"], render)]);
		onUpdateLinkedActor({ uuid: "Actor.willa" }, { name: "Willa Fletcher" });
		expect(render).toHaveBeenCalledOnce();
	});

	it("leaves steadings that do not link it alone", () => {
		const render = vi.fn();
		stubGame([steadingSheet(["Actor.someone-else"], render)]);
		onUpdateLinkedActor({ uuid: "Actor.willa" }, { name: "Willa Fletcher" });
		expect(render).not.toHaveBeenCalled();
	});

	it("ignores updates that change neither name nor image", () => {
		const render = vi.fn();
		stubGame([steadingSheet(["Actor.willa"], render)]);
		onUpdateLinkedActor({ uuid: "Actor.willa" }, { system: { hp: { value: 3 } } });
		expect(render).not.toHaveBeenCalled();
	});

	it("does not fight a sheet its user is typing into", () => {
		const render = vi.fn();
		const input  = {};
		const sheet  = steadingSheet(["Actor.willa"], render);
		sheet.sheet.element = { contains: node => node === input };
		stubGame([sheet]);
		vi.stubGlobal("document", { activeElement: input });
		onUpdateLinkedActor({ uuid: "Actor.willa" }, { name: "Willa Fletcher" });
		expect(render).not.toHaveBeenCalled();
	});
});

describe("onDeleteLinkedActor", () => {
	it("re-renders so the row shows the link as broken", () => {
		const render = vi.fn();
		stubGame([steadingSheet(["Actor.willa"], render)]);
		onDeleteLinkedActor({ uuid: "Actor.willa" });
		expect(render).toHaveBeenCalledOnce();
	});
});
