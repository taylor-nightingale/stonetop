// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { blankFieldElement, registerBlankFieldEnricher } from "../../src/journal/blankFieldEnricher.js";

const match = (key = "0") => [`@Blank[${key}]`, key];

describe("blankFieldElement", () => {
	it("builds an empty text input tagged with its stable blank key", () => {
		const el = blankFieldElement(match("2"));
		expect(el.tagName).toBe("INPUT");
		expect(el.type).toBe("text");
		expect(el.classList.contains("stonetop-arcanum-blank")).toBe(true);
		expect(el.dataset.blankKey).toBe("2");
		expect(el.value).toBe(""); // stateless — the sheet fills it from storage
	});

	it("carries a non-numeric key through unchanged", () => {
		expect(blankFieldElement(match("geas-1")).dataset.blankKey).toBe("geas-1");
	});
});

describe("registerBlankFieldEnricher", () => {
	afterEach(() => { delete globalThis.CONFIG; });

	it("registers a @Blank[...] enricher whose pattern captures the key and builds the input", () => {
		globalThis.CONFIG = {};
		registerBlankFieldEnricher();
		const entry = CONFIG.TextEditor.enrichers.find(e => e.id === "stonetop-blank-field");
		expect(entry).toBeTruthy();
		const m = new RegExp(entry.pattern.source).exec("roll a d4, then write @Blank[3] here");
		expect(m[1]).toBe("3");
		expect(entry.enricher(m).dataset.blankKey).toBe("3");
	});
});
