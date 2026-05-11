import {
	openBackgroundDialog,
	openInstinctDialog,
	openAppearanceDialog,
	openOriginDialog,
} from "./character-dialogs.js";

export function renderSelectionRow(actor, html, flags) {
	const backgrounds = flags?.backgrounds ?? [];
	const instincts   = flags?.instincts   ?? [];
	const appearance  = flags?.appearance  ?? [];
	const origins     = flags?.origin      ?? [];

	const fields = [];

	if (backgrounds.length) {
		const savedSlug = actor.getFlag("stonetop", "background") ?? "";
		const selected  = backgrounds.find(b => b.slug === savedSlug);
		fields.push(selectionField("background", game.i18n.localize("stonetop.character.selection.background.label"), selected?.label));
	}

	// Instinct shown whenever a playbook is assigned
	if (flags) {
		const val     = actor.getFlag("stonetop", "instinct") ?? "";
		const display = val.includes(" — ") ? val.split(" — ")[0] : val;
		fields.push(selectionField("instinct", game.i18n.localize("stonetop.character.selection.instinct.label"), display || null));
	}

	if (appearance.length) {
		const saved  = actor.getFlag("stonetop", "appearance") ?? {};
		const parts  = appearance.map((_, i) => saved[i]).filter(Boolean);
		fields.push(selectionField("appearance", game.i18n.localize("stonetop.character.selection.appearance.label"), parts.length ? parts.join(", ") : null));
	}

	if (origins.length) {
		const savedRegion = actor.getFlag("stonetop", "origin") ?? "";
		fields.push(selectionField("origin", game.i18n.localize("stonetop.character.selection.origin.label"), savedRegion || null));
	}

	if (!fields.length) return;

	html.find("header.sheet-header").after(
		`<div class="stonetop-selections">${fields.join("")}</div>`
	);

	if (backgrounds.length)
		html.find(".stonetop-selection[data-field=background]").on("click", () =>
			openBackgroundDialog(actor, backgrounds));

	if (instincts.length)
		html.find(".stonetop-selection[data-field=instinct]").on("click", () =>
			openInstinctDialog(actor, instincts));

	if (appearance.length)
		html.find(".stonetop-selection[data-field=appearance]").on("click", () =>
			openAppearanceDialog(actor, appearance));

	if (origins.length)
		html.find(".stonetop-selection[data-field=origin]").on("click", () =>
			openOriginDialog(actor, origins));
}

export function stripStatPlusSigns(html) {
	html.find(".cell--stats .stat-value").each((_, el) => {
		el.value = el.value.replace(/^\+/, "");
	});
}

function selectionField(field, label, value) {
	const placeholder = game.i18n.format("stonetop.character.selection.choosePlaceholder", { label: label.toLowerCase() });
	return `<div class="stonetop-selection" data-field="${field}">
		<span class="stonetop-selection-label">${label}</span>
		<button type="button" class="stonetop-selection-value${value ? "" : " stonetop-selection-empty"}">
			${value ?? placeholder}
		</button>
	</div>`;
}
