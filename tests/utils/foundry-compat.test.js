import { describe, it, expect, vi, afterEach } from "vitest";
import { deletionEntry, getDragEventData } from "../../module/utils/foundry-compat.js";

describe("deletionEntry", () => {
	afterEach(() => {
		// Restore the v13 sentinel that tests/setup.js installs.
		globalThis.foundry = { ...(globalThis.foundry ?? {}), data: { operators: { ForcedDeletion: Symbol.for("ForcedDeletion") } } };
	});

	it("uses the ForcedDeletion sentinel on v13+ (key path unchanged)", () => {
		const sentinel = foundry.data.operators.ForcedDeletion;
		expect(deletionEntry("flags.stonetop.checks.c1")).toEqual(["flags.stonetop.checks.c1", sentinel]);
		// A nested key path is left intact for the sentinel form.
		expect(deletionEntry("flags.stonetop.arcana.minorDraw")).toEqual(["flags.stonetop.arcana.minorDraw", sentinel]);
	});

	it("falls back to the legacy `-=leaf`/null form on v12 (no sentinel)", () => {
		foundry.data.operators = undefined;
		expect(deletionEntry("flags.stonetop.checks.c1")).toEqual(["flags.stonetop.checks.-=c1", null]);
		expect(deletionEntry("flags.stonetop.arcana.minorDraw")).toEqual(["flags.stonetop.arcana.-=minorDraw", null]);
	});
});

describe("getDragEventData", () => {
	afterEach(() => {
		delete globalThis.TextEditor;
		globalThis.foundry = { ...(globalThis.foundry ?? {}), data: { operators: { ForcedDeletion: Symbol.for("ForcedDeletion") } } };
	});

	it("prefers the V13 namespaced TextEditor implementation", () => {
		const ev = {};
		const ns = vi.fn(() => ({ type: "Actor", uuid: "x" }));
		globalThis.foundry = { ...(globalThis.foundry ?? {}), applications: { ux: { TextEditor: { implementation: { getDragEventData: ns } } } } };
		globalThis.TextEditor = { getDragEventData: vi.fn(() => ({ type: "global" })) };

		expect(getDragEventData(ev)).toEqual({ type: "Actor", uuid: "x" });
		expect(ns).toHaveBeenCalledWith(ev);
		expect(globalThis.TextEditor.getDragEventData).not.toHaveBeenCalled();
	});

	it("falls back to the bare global when the namespaced impl is absent (v12)", () => {
		globalThis.foundry = { ...(globalThis.foundry ?? {}), applications: undefined };
		globalThis.TextEditor = { getDragEventData: vi.fn(() => ({ type: "global" })) };

		expect(getDragEventData({})).toEqual({ type: "global" });
	});
});
