import { describe, it, expect } from "vitest";
import { applyDocumentUpdate, applyDotPath, mergeValue } from "./applyDocumentUpdate.js";

/**
 * The fake's fidelity to Document#update is load-bearing, so it is tested like production code.
 *
 * A fake that is wrong in the LENIENT direction is the dangerous kind: the test passes, the feature
 * ships, and the game does something else. Both rules below have that shape — an update that merges
 * where the fake replaced would silently keep a stale key, and a deletion the fake did not perform
 * would look like it worked.
 */
describe("what Document#update does to stored data", () => {
	describe("merging", () => {
		it("deep-merges plain objects rather than replacing them", () => {
			expect(mergeValue({ a: 1, b: { c: 2, d: 3 } }, { b: { c: 9 } }))
				.toEqual({ a: 1, b: { c: 9, d: 3 } });
		});

		it("replaces arrays and scalars wholesale", () => {
			expect(mergeValue([1, 2, 3], [9])).toEqual([9]);
			expect(mergeValue(4, 5)).toBe(5);
			expect(mergeValue({ a: 1 }, null)).toBeNull();
		});

		it("cannot drop a key by leaving it out", () => {
			expect(mergeValue({ a: 1, b: 2 }, { a: 9 })).toEqual({ a: 9, b: 2 });
		});
	});

	/**
	 * `-=key` is the only way an update removes something. The steading relies on it to clear one
	 * applied result without clearing the rest, so a fake that ignored it would let "Revert" test
	 * green while leaving the record in place in the game.
	 */
	describe("deleting", () => {
		it("drops a key named with -= inside a merged object", () => {
			expect(mergeValue({ a: 1, b: 2 }, { "-=a": null })).toEqual({ b: 2 });
		});

		it("drops a key named with -= at the end of a dot path", () => {
			const target = { system: { applied: { "mill:0": { change: {} }, "mill:1": {} } } };
			applyDotPath(target, "system.applied.-=mill:0", null);
			expect(target.system.applied).toEqual({ "mill:1": {} });
		});

		it("stores no literal -= key", () => {
			const target = { system: { applied: {} } };
			applyDotPath(target, "system.applied.-=gone", null);
			expect(Object.keys(target.system.applied)).toEqual([]);
		});

		it("is content deleting something that is not there", () => {
			const target = { system: { applied: { keep: 1 } } };
			applyDotPath(target, "system.applied.-=absent", null);
			expect(target.system.applied).toEqual({ keep: 1 });
		});
	});

	describe("whole payloads", () => {
		it("creates the intermediate objects a path walks through", () => {
			const target = {};
			applyDotPath(target, "system.deep.nested.value", 7);
			expect(target).toEqual({ system: { deep: { nested: { value: 7 } } } });
		});

		it("applies a write and a deletion in one payload", () => {
			const target = { system: { applied: { "mill:0": 1 }, attributes: { fortunes: 5 } } };
			applyDocumentUpdate(target, {
				"system.attributes.fortunes": 4,
				"system.applied.-=mill:0":    null,
			});
			expect(target.system).toEqual({ applied: {}, attributes: { fortunes: 4 } });
		});
	});
});
