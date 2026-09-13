import { describe, expect, it } from "vitest";
import { CompanionCatalog } from "../../../../src/model/data/character/CompanionCatalog.js";

const BIRD  = { slug: "bird",  name: "Bird",  pickCount: 4, defaults: ["tiny"] };
const BRUTE = { slug: "brute", name: "Brute", pickCount: 3, defaults: ["tough"] };

const catalog = () => new CompanionCatalog([BIRD, BRUTE]);

describe("CompanionCatalog.fromCompanion", () => {
	it("reads the catalog off a companion object", () => {
		expect(CompanionCatalog.fromCompanion({ catalog: [BIRD] }).names).toEqual(["Bird"]);
	});

	it("is empty for a companion with no catalog, a null one, and a malformed one", () => {
		expect(CompanionCatalog.fromCompanion({}).isEmpty).toBe(true);
		expect(CompanionCatalog.fromCompanion(null).isEmpty).toBe(true);
		expect(CompanionCatalog.fromCompanion({ catalog: "nonsense" }).isEmpty).toBe(true);
	});
});

describe("CompanionCatalog.names", () => {
	it("lists the display labels in catalog order", () => {
		expect(catalog().names).toEqual(["Bird", "Brute"]);
	});

	it("is empty for an empty catalog", () => {
		expect(new CompanionCatalog().names).toEqual([]);
	});
});

describe("CompanionCatalog.typeFor", () => {
	it("resolves a slug", () => {
		expect(catalog().typeFor("brute")).toBe(BRUTE);
	});

	// A pick stored before types were slug-keyed holds a name; it has to keep resolving.
	it("resolves a name", () => {
		expect(catalog().typeFor("Bird")).toBe(BIRD);
	});

	it("prefers a slug match over a name match", () => {
		const shadowed = new CompanionCatalog([{ slug: "a", name: "bird" }, BIRD]);
		expect(shadowed.typeFor("bird")).toBe(BIRD);
	});

	it("is null for an unknown value and for nothing at all", () => {
		expect(catalog().typeFor("wyvern")).toBeNull();
		expect(catalog().typeFor("")).toBeNull();
		expect(catalog().typeFor(null)).toBeNull();
		expect(catalog().typeFor(undefined)).toBeNull();
	});
});

describe("CompanionCatalog.slugFor", () => {
	it("maps the label the combobox shows to the slug that gets stored", () => {
		expect(catalog().slugFor("Bird")).toBe("bird");
	});

	it("is idempotent — a slug maps to itself", () => {
		expect(catalog().slugFor("bird")).toBe("bird");
	});

	it("is null for a value naming no type, so a custom entry is never mistaken for one", () => {
		expect(catalog().slugFor("Wyvern")).toBeNull();
	});
});

describe("CompanionCatalog.nameFor", () => {
	it("maps a stored slug to the label to display", () => {
		expect(catalog().nameFor("bird")).toBe("Bird");
	});

	it("passes an unknown value through rather than rendering blank", () => {
		expect(catalog().nameFor("Wyvern")).toBe("Wyvern");
	});

	it("is null for nothing at all", () => {
		expect(catalog().nameFor(null)).toBeNull();
	});
});
