import { describe, it, expect } from "vitest";
import { buildPageMap, linkPageRefs } from "../../../scripts/import/pdf/crossref.js";
import { journalUuid } from "../../../scripts/import/pdf/creatures.js";

const articles = [
	{ slug: "aratis-the-lawkeeper", pageNumbers: [22, 23, 24] },
	{ slug: "the-great-wood", pageNumbers: [210, 211, 214] },
	{ slug: "marshedge", pageNumbers: [24, 25] }, // 24 shared at a boundary
];
const map = buildPageMap(articles);

describe("buildPageMap", () => {
	it("maps each printed page to its article; first (book-order) writer wins a shared page", () => {
		expect(map.get(23)).toBe("aratis-the-lawkeeper");
		expect(map.get(214)).toBe("the-great-wood");
		expect(map.get(24)).toBe("aratis-the-lawkeeper"); // not marshedge
		expect(map.get(999)).toBeUndefined();
	});
});

describe("linkPageRefs", () => {
	it("links a '(page N)' citation to the target journal entry", () => {
		const { html, linked } = linkPageRefs("A ruin (page 214) lies north.", map, { selfSlug: "x" });
		expect(linked).toBe(1);
		expect(html).toBe(`A ruin (page @UUID[${journalUuid("the-great-wood")}]{214}) lies north.`);
	});

	it("links each number in a range or list, leaving separators intact", () => {
		const { html } = linkPageRefs("see pages 23, 214", map, { selfSlug: "x" });
		expect(html).toBe(`see pages @UUID[${journalUuid("aratis-the-lawkeeper")}]{23}, @UUID[${journalUuid("the-great-wood")}]{214}`);
	});

	it("does not link a 'step N' that follows a page citation", () => {
		const { html, linked } = linkPageRefs("(page 214, step 2)", map, { selfSlug: "x" });
		expect(linked).toBe(1);
		expect(html).toBe(`(page @UUID[${journalUuid("the-great-wood")}]{214}, step 2)`);
	});

	it("leaves unknown pages and self-references as plain text", () => {
		const unknown = linkPageRefs("(page 999)", map, { selfSlug: "x" });
		expect(unknown.html).toBe("(page 999)");
		expect(unknown.linked).toBe(0);

		const self = linkPageRefs("(page 23)", map, { selfSlug: "aratis-the-lawkeeper" });
		expect(self.html).toBe("(page 23)");
		expect(self.linked).toBe(0);
	});
});
