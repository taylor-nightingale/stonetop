import { describe, expect, it } from "vitest";
import {
	normalizeLog,
	currentExpedition,
	ensureCurrent,
	addExpedition,
	selectExpedition,
	deleteExpedition,
} from "../../module/utils/expedition-log-core.js";

// Pure list ops for the growing expedition log. The dialog supplies randomID/Date.now
// and persists the result; these assert the structure (normalization, selection,
// add/delete) and that each op leaves its input untouched.

const trip = (id, title = "") => ({ id, title, createdAt: 0 });

describe("normalizeLog", () => {
	it("treats a missing/empty blob as an empty log", () => {
		expect(normalizeLog(undefined)).toEqual({ currentId: null, list: [] });
		expect(normalizeLog({})).toEqual({ currentId: null, list: [] });
		expect(normalizeLog({ list: "nope" })).toEqual({ currentId: null, list: [] });
	});

	it("keeps a valid currentId", () => {
		const log = normalizeLog({ currentId: "a", list: [trip("a"), trip("b")] });
		expect(log.currentId).toBe("a");
	});

	it("falls back to the most recent trip when currentId is missing or stale", () => {
		expect(normalizeLog({ list: [trip("a"), trip("b")] }).currentId).toBe("b");
		expect(normalizeLog({ currentId: "gone", list: [trip("a"), trip("b")] }).currentId).toBe("b");
	});
});

describe("currentExpedition", () => {
	it("returns the selected trip, or null when empty", () => {
		expect(currentExpedition({ currentId: "a", list: [trip("a")] })).toEqual(trip("a"));
		expect(currentExpedition({ currentId: null, list: [] })).toBeNull();
	});
});

describe("ensureCurrent", () => {
	it("returns the existing current trip without touching the input", () => {
		const log = { currentId: "a", list: [trip("a", "X")] };
		const { log: out, entry } = ensureCurrent(log, () => trip("z"));
		entry.title = "Y";
		expect(entry.id).toBe("a");
		expect(out.list[0].title).toBe("Y"); // mutation lands on the copy
		expect(log.list[0].title).toBe("X"); // input is untouched
	});

	it("creates and selects a trip when the log is empty", () => {
		const { log, entry } = ensureCurrent({ currentId: null, list: [] }, () => trip("new"));
		expect(entry.id).toBe("new");
		expect(log.currentId).toBe("new");
		expect(log.list).toHaveLength(1);
	});
});

describe("addExpedition", () => {
	it("appends the new trip and selects it, leaving the input list intact", () => {
		const log = { currentId: "a", list: [trip("a")] };
		const out = addExpedition(log, trip("b"));
		expect(out.currentId).toBe("b");
		expect(out.list.map(e => e.id)).toEqual(["a", "b"]);
		expect(log.list).toHaveLength(1);
	});
});

describe("selectExpedition", () => {
	it("switches the current trip", () => {
		const log = { currentId: "a", list: [trip("a"), trip("b")] };
		expect(selectExpedition(log, "b").currentId).toBe("b");
	});

	it("is a no-op for an unknown id", () => {
		const log = { currentId: "a", list: [trip("a")] };
		expect(selectExpedition(log, "ghost")).toBe(log);
	});
});

describe("deleteExpedition", () => {
	it("removes a trip and re-selects the most recent when the current one goes", () => {
		const log = { currentId: "b", list: [trip("a"), trip("b"), trip("c")] };
		const out = deleteExpedition(log, "b");
		expect(out.list.map(e => e.id)).toEqual(["a", "c"]);
		expect(out.currentId).toBe("c");
	});

	it("keeps the current selection when deleting a different trip", () => {
		const log = { currentId: "a", list: [trip("a"), trip("b")] };
		expect(deleteExpedition(log, "b").currentId).toBe("a");
	});

	it("empties the log cleanly when the last trip is removed", () => {
		const log = { currentId: "a", list: [trip("a")] };
		expect(deleteExpedition(log, "a")).toEqual({ currentId: null, list: [] });
	});
});
