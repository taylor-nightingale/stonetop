// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { renderPartial } from "../fakes/renderTemplate.js";

/**
 * `data-edit` on the wrong element silently breaks EVERY submit the sheet's own form makes.
 *
 * Foundry's FormDataExtended folds each `[data-edit]` element into the submit payload under the
 * name the attribute holds, reading an IMG's `src` but any other element's innerHTML. With the
 * attribute on the <button> that wraps a portrait, `img` arrived as a chunk of markup, FilePathField
 * rejected it ("does not have a valid file extension"), and DocumentSheetV2#_prepareSubmitData threw
 * before `update` ran — so renaming an actor or item was impossible. These pin the placement.
 */

// The extraction rule from FormDataExtended#processEditableHTML, applied to a rendered element.
function editableFormData(root) {
	const data = {};
	for (const el of root.querySelectorAll("[data-edit]")) {
		data[el.dataset.edit] = el.tagName === "IMG" ? el.getAttribute("src") : el.innerHTML.trim();
	}
	return data;
}

function templateFiles(dir) {
	return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) return templateFiles(full);
		return entry.name.endsWith(".hbs") ? [full] : [];
	});
}

// The tag name of every element carrying data-edit, as written in the template source.
function taggedElements(source) {
	return [...source.matchAll(/<([a-zA-Z][\w-]*)\b[^>]*\bdata-edit=/g)].map(m => m[1].toLowerCase());
}

describe("data-edit sits on the image itself", () => {
	it("is never written onto a wrapper element in any template", () => {
		const offenders = templateFiles(path.resolve(process.cwd(), "templates"))
			.flatMap(file => taggedElements(readFileSync(file, "utf8"))
				.filter(tag => tag !== "img")
				.map(tag => `${path.relative(process.cwd(), file)}: <${tag}>`));

		expect(offenders).toEqual([]);
	});

	it("submits the portrait's path, not the markup around it", () => {
		document.body.innerHTML = renderPartial("stonetop.actor-header", {
			actor: { name: "Blodwen", img: "worlds/stonetop/portraits/blodwen.webp" },
			editable: true,
			stonetop: { playbook: {} },
		});

		expect(editableFormData(document.body)).toEqual({ img: "worlds/stonetop/portraits/blodwen.webp" });
	});

	// The picker persists a pick by assigning the chosen path to the image's src and re-submitting;
	// that only round-trips while `src` is what the form reads back.
	it("carries a newly picked path back out of the form", () => {
		document.body.innerHTML = renderPartial("stonetop.actor-header", {
			actor: { name: "Blodwen", img: "icons/svg/mystery-man.svg" },
			editable: true,
			stonetop: { playbook: {} },
		});
		document.body.querySelector("img[data-edit]").src = "stonetop-art/arcana/azure-hand.png";

		expect(editableFormData(document.body).img).toBe("stonetop-art/arcana/azure-hand.png");
	});

	// A character with a playbook shows the playbook's icon instead, which is not editable.
	it("contributes nothing to the payload when no editable image is rendered", () => {
		document.body.innerHTML = renderPartial("stonetop.actor-header", {
			actor: { name: "Blodwen", img: "icons/svg/mystery-man.svg" },
			editable: true,
			stonetop: { playbook: { name: "The Seeker", img: "systems/stonetop/assets/seeker.webp" } },
		});

		expect(editableFormData(document.body)).toEqual({});
	});
});
