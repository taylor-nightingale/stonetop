import { describe, it, expect } from "vitest";
import {
	classifyBook,
	resolveBooks,
	requireTools,
	DEFAULT_BOOK_II,
	DEFAULT_BOOK_I,
} from "../../../scripts/import/pdf/books.js";

describe("classifyBook", () => {
	it("recognizes the shipped filenames", () => {
		expect(classifyBook("helper/Book_II_-_The_Wider_World_and_Other_Wonders.pdf")).toBe(2);
		expect(classifyBook("helper/Book_I_-_Stonetop.pdf")).toBe(1);
	});
	it("does not let 'Book_II' match the Book I pattern", () => {
		expect(classifyBook("Book_II.pdf")).toBe(2);
		expect(classifyBook("Book_I.pdf")).toBe(1);
	});
	it("handles a separator (not just a dot) after the numeral", () => {
		// `_` is a word char, so a naive \b wouldn't fire between "ii" and "_".
		expect(classifyBook("Book_II_typo.pdf")).toBe(2);
		expect(classifyBook("Book_I_-_Stonetop.pdf")).toBe(1);
		expect(classifyBook("Book_2_extras.pdf")).toBe(2);
	});
	it("accepts arabic numerals and spelled-out numbers", () => {
		expect(classifyBook("stuff/book 2 final.pdf")).toBe(2);
		expect(classifyBook("book-one.pdf")).toBe(1);
	});
	it("falls back to title keywords", () => {
		expect(classifyBook("the-wider-world.pdf")).toBe(2);
		expect(classifyBook("Stonetop.pdf")).toBe(1);
	});
	it("returns null when it can't tell", () => {
		expect(classifyBook("random.pdf")).toBeNull();
		expect(classifyBook("")).toBeNull();
	});
});

describe("resolveBooks", () => {
	const II = "some/Book_II_wonders.pdf";
	const I = "some/Book_I_stonetop.pdf";

	it("works with the documented order", () => {
		expect(resolveBooks([II, I])).toEqual({ bookII: II, bookI: I });
	});
	it("works with the order swapped", () => {
		expect(resolveBooks([I, II])).toEqual({ bookII: II, bookI: I });
	});
	it("accepts Book II alone and defaults Book I", () => {
		expect(resolveBooks([II])).toEqual({ bookII: II, bookI: DEFAULT_BOOK_I });
	});
	it("falls back to defaults with no args", () => {
		expect(resolveBooks([])).toEqual({ bookII: DEFAULT_BOOK_II, bookI: DEFAULT_BOOK_I });
	});
	it("lets a CLI path override the env, and env override the default", () => {
		expect(resolveBooks([II], { BOOK_I_PDF: "env/one.pdf" })).toEqual({
			bookII: II,
			bookI: "env/one.pdf",
		});
		expect(resolveBooks([], { BOOK_PDF: "env/two.pdf" })).toEqual({
			bookII: "env/two.pdf",
			bookI: DEFAULT_BOOK_I,
		});
	});
	it("hard-errors on an unclassifiable path", () => {
		expect(() => resolveBooks(["mystery.pdf"])).toThrow(/which book/i);
	});
	it("hard-errors when two args look like the same book", () => {
		expect(() => resolveBooks([II, "other/book-ii.pdf"])).toThrow(/both look like Book II/i);
	});
});

describe("requireTools", () => {
	it("passes for a tool that is on PATH", () => {
		expect(() => requireTools(["node"])).not.toThrow();
	});
	it("is a no-op for an empty list", () => {
		expect(() => requireTools([])).not.toThrow();
	});
	it("throws with the binary name for a missing tool", () => {
		expect(() => requireTools(["definitely-not-a-real-binary-xyz"])).toThrow(
			/definitely-not-a-real-binary-xyz/,
		);
	});
});
