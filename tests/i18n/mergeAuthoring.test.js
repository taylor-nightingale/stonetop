import { describe, expect, it } from "vitest";
import { AuthoredEntry, AuthoringFile } from "../../scripts/i18n/mergeAuthoring.js";

const entry = (source, text, flags) => ({ source, text, ...flags });
const file  = json => AuthoringFile.fromJson(json);

describe("AuthoredEntry", () => {
	it("reads source, text and review markers from an authoring entry", () => {
		const read = AuthoredEntry.fromJson(entry("Look at us.", "Sieh uns an.", { needsReview: true }));
		expect(read.source).toBe("Look at us.");
		expect(read.text).toBe("Sieh uns an.");
		expect(read.needsReview).toBe(true);
		expect(read.orphaned).toBe(false);
	});

	it("treats a missing or non-string field as absent rather than throwing", () => {
		const read = AuthoredEntry.fromJson({ source: null, text: 42 });
		expect(read.source).toBe("");
		expect(read.text).toBe("");
		expect(read.hasText).toBe(false);
	});

	it("does not count whitespace as a translation", () => {
		expect(AuthoredEntry.fromJson(entry("x", "   \n ")).hasText).toBe(false);
		expect(AuthoredEntry.fromJson(entry("x", "Ja")).hasText).toBe(true);
	});

	it("prefers the other entry when it carries German", () => {
		const mine  = AuthoredEntry.fromJson(entry("x", "alt"));
		const other = AuthoredEntry.fromJson(entry("x", "neu"));
		expect(mine.preferring(other).text).toBe("neu");
	});

	it("keeps its own German when the other entry is blank or absent", () => {
		const mine = AuthoredEntry.fromJson(entry("x", "meins"));
		expect(mine.preferring(AuthoredEntry.fromJson(entry("x", ""))).text).toBe("meins");
		expect(mine.preferring(null).text).toBe("meins");
	});

	it("writes review markers back only when set", () => {
		expect(AuthoredEntry.fromJson(entry("x", "y")).toJson()).toEqual({ source: "x", text: "y" });
		expect(AuthoredEntry.fromJson(entry("x", "y", { orphaned: true })).toJson())
			.toEqual({ source: "x", text: "y", orphaned: true });
	});
});

describe("AuthoringFile.mergedWith", () => {
	it("takes the incoming translation wherever it carries German", () => {
		const merged = file({ seeker: { name: entry("The Seeker", "") } })
			.mergedWith(file({ seeker: { name: entry("The Seeker", "Der Sucher") } }));
		expect(merged.entryAt("seeker", "name").text).toBe("Der Sucher");
	});

	it("keeps our German where the incoming file is blank", () => {
		const merged = file({ seeker: { name: entry("The Seeker", "Der Sucher") } })
			.mergedWith(file({ seeker: { name: entry("The Seeker", "") } }));
		expect(merged.entryAt("seeker", "name").text).toBe("Der Sucher");
	});

	// The reason this merge is not a `git checkout --theirs`: a key we rehomed by hand since the
	// translator last pulled is absent from their file entirely, and taking theirs drops it.
	it("keeps a key the incoming file has never seen", () => {
		const merged = file({ seeker: { rehomed: entry("Moved here", "Hierher verschoben") } })
			.mergedWith(file({ seeker: { name: entry("The Seeker", "Der Sucher") } }));
		expect(merged.entryAt("seeker", "rehomed").text).toBe("Hierher verschoben");
		expect(merged.entryAt("seeker", "name").text).toBe("Der Sucher");
	});

	it("adds documents and keys that only the incoming file has", () => {
		const merged = file({}).mergedWith(file({ judge: { name: entry("The Judge", "Der Richter") } }));
		expect(merged.entryAt("judge", "name").text).toBe("Der Richter");
	});

	it("carries the winning side's source, never pairing one side's text with the other's source", () => {
		const merged = file({ seeker: { name: entry("Old English", "alt") } })
			.mergedWith(file({ seeker: { name: entry("New English", "neu") } }));
		const won = merged.entryAt("seeker", "name");
		expect(won.text).toBe("neu");
		expect(won.source).toBe("New English");
	});

	it("keeps a review marker on the entry that wins", () => {
		const merged = file({ seeker: { name: entry("x", "meins", { needsReview: true }) } })
			.mergedWith(file({ seeker: { name: entry("x", "") } }));
		expect(merged.entryAt("seeker", "name").needsReview).toBe(true);
	});

	it("counts only entries that carry German", () => {
		const merged = file({ seeker: { a: entry("a", "A"), b: entry("b", "") } })
			.mergedWith(file({ seeker: { b: entry("b", "B"), c: entry("c", "") } }));
		expect(merged.translatedCount).toBe(2);
	});

	it("round-trips through JSON", () => {
		const json = { seeker: { name: { source: "The Seeker", text: "Der Sucher" } } };
		expect(file(json).mergedWith(file({})).toJson()).toEqual(json);
	});
});
