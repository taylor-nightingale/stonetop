import { describe, it, expect, afterEach, vi } from "vitest";
import { HostWindow } from "../../src/utils/HostWindow.js";

/** A stand-in for v14's DetachedWindowManager: the popped-out windows, by id. */
const manager = (...detached) => ({ windows: new Map(detached.map(win => [win.id, { window: win }])) });
const lastUsed = win => ({ last: win });

const popped = { id: "stonetop-character-abc" };
const main   = {};

describe("HostWindow", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("opens in the popped-out window the player last used", () => {
		expect(new HostWindow({ detached: manager(popped), interactions: lastUsed(popped) }).renderOptions())
			.toEqual({ window: { windowId: "stonetop-character-abc" } });
	});

	it("leaves the main workspace to Foundry's default", () => {
		expect(new HostWindow({ detached: manager(popped), interactions: lastUsed(main) }).renderOptions()).toEqual({});
	});

	it("leaves it to Foundry's default before the player has done anything", () => {
		expect(new HostWindow({ detached: manager(popped), interactions: lastUsed(null) }).renderOptions()).toEqual({});
	});

	// The player's last click was in a sheet they have since put back or closed.
	it("leaves it to Foundry's default once that window has closed", () => {
		expect(new HostWindow({ detached: manager(), interactions: lastUsed(popped) }).renderOptions()).toEqual({});
	});

	it("leaves it to Foundry's default on v13, which has no detached windows", () => {
		expect(new HostWindow({ detached: undefined, interactions: lastUsed(popped) }).renderOptions()).toEqual({});
	});

	it("reads Foundry's manager by default", () => {
		vi.stubGlobal("foundry", { applications: { detached: manager(popped) } });
		expect(new HostWindow({ interactions: lastUsed(popped) }).renderOptions())
			.toEqual({ window: { windowId: "stonetop-character-abc" } });
	});

	it("needs no foundry global to construct", () => {
		vi.stubGlobal("foundry", undefined);
		expect(new HostWindow().renderOptions()).toEqual({});
	});
});
