import { describe, it, expect } from "vitest";
import { documentLink } from "../../../src/model/snapshot/documentLink.js";
import { RichText } from "../../../src/model/snapshot/RichText.js";

describe("documentLink", () => {
	it("wraps a uuid as an @UUID content-link RichText", () => {
		const link = documentLink("Actor.abc");
		expect(link).toBeInstanceOf(RichText);
		expect(link.raw).toBe("@UUID[Actor.abc]");
	});

	it("works for any document type (journal, item)", () => {
		expect(documentLink("JournalEntry.j1").raw).toBe("@UUID[JournalEntry.j1]");
		expect(documentLink("Item.i1").raw).toBe("@UUID[Item.i1]");
	});

	it("returns null for an empty or missing uuid", () => {
		expect(documentLink("")).toBeNull();
		expect(documentLink(null)).toBeNull();
		expect(documentLink(undefined)).toBeNull();
	});
});
