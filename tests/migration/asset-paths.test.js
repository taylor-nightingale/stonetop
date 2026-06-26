import { describe, it, expect } from "vitest";
import { remapAssetStrings, buildOwnFieldRemap } from "../../module/migration/asset-paths.js";

const FROM = "stonetop_pwd";
const TO = "stonetop";
const needle = `systems/${FROM}/`;
const repl = `systems/${TO}/`;

describe("remapAssetStrings", () => {
	it("rewrites a matching string and reports changed", () => {
		const r = remapAssetStrings("systems/stonetop_pwd/assets/x.webp", needle, repl);
		expect(r).toEqual({ value: "systems/stonetop/assets/x.webp", changed: true });
	});

	it("leaves a non-matching string untouched (same reference, changed:false)", () => {
		const s = "icons/svg/mystery-man.svg";
		const r = remapAssetStrings(s, needle, repl);
		expect(r.changed).toBe(false);
		expect(r.value).toBe(s);
	});

	it("preserves a leading slash", () => {
		expect(remapAssetStrings("/systems/stonetop_pwd/a.svg", needle, repl).value)
			.toBe("/systems/stonetop/a.svg");
	});

	it("rewrites every occurrence in one string", () => {
		const html = `<img src="systems/stonetop_pwd/a.svg"><img src="systems/stonetop_pwd/b.svg">`;
		expect(remapAssetStrings(html, needle, repl).value)
			.toBe(`<img src="systems/stonetop/a.svg"><img src="systems/stonetop/b.svg">`);
	});

	it("recurses through objects and arrays", () => {
		const v = {
			img: "systems/stonetop_pwd/p.webp",
			nested: { texture: { src: "systems/stonetop_pwd/t.webp" }, n: 3 },
			list: ["keep", "systems/stonetop_pwd/c.svg"],
			untouched: "core/x.png",
		};
		const r = remapAssetStrings(v, needle, repl);
		expect(r.changed).toBe(true);
		expect(r.value).toEqual({
			img: "systems/stonetop/p.webp",
			nested: { texture: { src: "systems/stonetop/t.webp" }, n: 3 },
			list: ["keep", "systems/stonetop/c.svg"],
			untouched: "core/x.png",
		});
	});

	it("returns the same reference when nothing changed (no needless clone)", () => {
		const v = { a: { b: "core/x.png" }, list: [1, 2] };
		const r = remapAssetStrings(v, needle, repl);
		expect(r.changed).toBe(false);
		expect(r.value).toBe(v);
	});

	it("does not mutate the input", () => {
		const v = { img: "systems/stonetop_pwd/p.webp" };
		const snap = JSON.stringify(v);
		remapAssetStrings(v, needle, repl);
		expect(JSON.stringify(v)).toBe(snap);
	});
});

describe("buildOwnFieldRemap", () => {
	it("returns {} when from and to are the same", () => {
		expect(buildOwnFieldRemap({ img: "systems/stonetop/x.webp" }, TO, TO)).toEqual({});
	});

	it("returns {} when no field references the old id", () => {
		expect(buildOwnFieldRemap({ name: "Wren", img: "icons/svg/x.svg" }, FROM, TO)).toEqual({});
	});

	it("emits only changed top-level keys, each whole", () => {
		const source = {
			name: "Old Bartholomew",
			img: "systems/stonetop_pwd/assets/icons/playbooks/the_judge_icon.webp",
			prototypeToken: { name: "Bart", texture: { src: "systems/stonetop_pwd/assets/icons/playbooks/the_judge_icon.webp", scaleX: 1 } },
			system: { level: 3 },
		};
		expect(buildOwnFieldRemap(source, FROM, TO)).toEqual({
			img: "systems/stonetop/assets/icons/playbooks/the_judge_icon.webp",
			prototypeToken: { name: "Bart", texture: { src: "systems/stonetop/assets/icons/playbooks/the_judge_icon.webp", scaleX: 1 } },
		});
	});

	it("skips embedded-collection fields (handled by the caller's recursion)", () => {
		const source = {
			img: "systems/stonetop_pwd/a.webp",
			items: [{ _id: "x", img: "systems/stonetop_pwd/item.webp" }],
			effects: [{ _id: "e", icon: "systems/stonetop_pwd/eff.webp" }],
		};
		const update = buildOwnFieldRemap(source, FROM, TO, ["items", "effects"]);
		expect(update).toEqual({ img: "systems/stonetop/a.webp" });
		expect(update.items).toBeUndefined();
		expect(update.effects).toBeUndefined();
	});

	it("replaces an array field atomically when one element changed", () => {
		const source = { sounds: [{ path: "keep/a.ogg" }, { path: "systems/stonetop_pwd/b.ogg" }] };
		expect(buildOwnFieldRemap(source, FROM, TO)).toEqual({
			sounds: [{ path: "keep/a.ogg" }, { path: "systems/stonetop/b.ogg" }],
		});
	});

	it("does not mutate the input source", () => {
		const source = { img: "systems/stonetop_pwd/p.webp", items: [{ img: "systems/stonetop_pwd/i.webp" }] };
		const snap = JSON.stringify(source);
		buildOwnFieldRemap(source, FROM, TO, ["items"]);
		expect(JSON.stringify(source)).toBe(snap);
	});
});
