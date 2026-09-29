import { describe, expect, it } from "vitest";
import { StyleEntry } from "../../../scripts/release/StyleEntry.js";

describe("the two shapes a manifest styles entry comes in", () => {
	it("reads a bare path", () => {
		const entry = StyleEntry.from("styles/stonetop.css");

		expect(entry.src).toBe("styles/stonetop.css");
		expect(entry.layer).toBeUndefined();
	});

	it("reads the object form Foundry's schema declares", () => {
		const entry = StyleEntry.from({ src: "styles/stonetop.css", layer: "system" });

		expect(entry.src).toBe("styles/stonetop.css");
		expect(entry.layer).toBe("system");
	});

	// A bare path that came back as an object would be a diff on every line of `styles` for nothing.
	it("goes back out in the shape it came in as", () => {
		expect(StyleEntry.from("styles/stonetop.css").toJSON()).toBe("styles/stonetop.css");
		expect(StyleEntry.from({ src: "a.css", layer: "system" }).toJSON())
			.toEqual({ src: "a.css", layer: "system" });
	});
});

describe("stamping the version onto a stylesheet's URL", () => {
	it("names the version in the query", () => {
		expect(StyleEntry.from("styles/stonetop.css").withVersion("1.7.0").src)
			.toBe("styles/stonetop.css?v=1.7.0");
	});

	it("keeps the layer the entry was declared with", () => {
		const stamped = StyleEntry.from({ src: "a.css", layer: "system" }).withVersion("1.7.0");

		expect(stamped.toJSON()).toEqual({ src: "a.css?v=1.7.0", layer: "system" });
	});

	// The workflow patches whatever the working tree holds, and a tree that already carries a stamp
	// is the normal case for a re-run. Two `v` parameters answer the question twice.
	it("re-stamps rather than appending a second version", () => {
		const once = StyleEntry.from("styles/stonetop.css").withVersion("1.6.0");

		expect(once.withVersion("1.7.0").src).toBe("styles/stonetop.css?v=1.7.0");
		expect(once.withVersion("1.6.0").src).toBe(once.src);
	});

	it("leaves any other query parameter alone", () => {
		expect(StyleEntry.from("a.css?theme=dark").withVersion("1.7.0").src)
			.toBe("a.css?theme=dark&v=1.7.0");
	});

	// A sheet served from somewhere else is not this package's to version, and a `?v=` on it would
	// at best miss the cache for nothing and at worst not be a URL that host answers.
	it("leaves a stylesheet this package does not serve unstamped", () => {
		for (const src of ["https://fonts.example/x.css", "//cdn.example/x.css"]) {
			expect(StyleEntry.from(src).withVersion("1.7.0").src).toBe(src);
		}
	});

	it("stamps a path however deeply nested", () => {
		expect(StyleEntry.from("styles/themes/parchment-dark.css").withVersion("1.7.0").src)
			.toBe("styles/themes/parchment-dark.css?v=1.7.0");
	});
});
