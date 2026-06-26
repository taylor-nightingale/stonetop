// Support for the ported "Classic" sheet (Taylor Nightingale's actual sheet, vendored under
// templates/classic/). Registers his Handlebars helpers + markdown pipeline + partials, kept
// ISOLATED from the Minimal sheet:
//   - md / gt / not / outfitSegments are classic-only (the Minimal sheet doesn't define them) → global.
//   - poolGroups / repeatChecks DIVERGE from the Minimal sheet's same-named helpers, so his versions
//     are registered as classicPoolGroups / classicRepeatChecks (the vendored templates were rewritten
//     to call those). resourceChecks / times / eq / and / or are identical enough to reuse the fork's.
//   - His partials load under a "classic.*" namespace (the vendored templates were rewritten to match)
//     so they never collide with the Minimal sheet's "stonetop.*" partials.
import snarkdown from "../lib/snarkdown.es.js";

// ── Markdown pipeline (ported from his src/utils/enrichGameText.js) ─────────────
const TOKEN    = "\\[\\[[^\\]]*\\]\\]|@\\w+\\[[^\\]]*\\](?:\\{[^}]*\\})?";
const TOKEN_RE = new RegExp(TOKEN, "g");
// Sentinel wrapping a token index: alphanumerics survive the markdown pass and can't occur in prose.
const SENTINEL = /STKN(\d+)NKTS/g;

/** Prose markdown -> HTML (no auto-roll). Explicit [[ ]] rolls / @UUID links are shielded from the
 *  markdown pass and restored after, then made clickable post-render by enrichRichTokens(). */
export function renderMarkdown(raw) {
	if (!raw) return "";
	const tokens = [];
	const shielded = String(raw).replace(TOKEN_RE, m => `STKN${tokens.push(m) - 1}NKTS`);
	return snarkdown(shielded).replace(SENTINEL, (_, i) => tokens[Number(i)]);
}

/** Post-render: upgrade [[ ]] rolls / @UUID links inside already-rendered .stonetop-rich elements. */
export async function enrichRichTokens(root, { rollData = {} } = {}) {
	if (!root) return;
	const els = root.querySelectorAll(".stonetop-rich");
	await Promise.all([...els].map(async el => {
		if (el.dataset.tokensEnriched || !/\[\[|@\w+\[/.test(el.innerHTML)) return;
		el.innerHTML = await foundry.applications.ux.TextEditor.implementation
			.enrichHTML(el.innerHTML, { async: true, rollData });
		el.dataset.tokensEnriched = "1";
	}));
}

const CLASSIC_TPL = "systems/stonetop/templates/classic";

let _registered = false;

/** Register the Classic sheet's helpers + partials. Idempotent; call once at init. */
export function registerClassicSheetSupport() {
	if (_registered) return;
	_registered = true;

	// Classic-only helpers (no Minimal-sheet collision).
	Handlebars.registerHelper("md", text => new Handlebars.SafeString(renderMarkdown(text ?? "")));
	Handlebars.registerHelper("gt", (a, b) => a > b);
	Handlebars.registerHelper("not", a => !a);
	Handlebars.registerHelper("outfitSegments", items => {
		const segments = [];
		let current = null;
		for (const item of (items ?? [])) {
			if (!current || current.isGrid !== item.twoCol) {
				current = { isGrid: item.twoCol, items: [] };
				segments.push(current);
			}
			current.items.push(item);
		}
		return segments;
	});

	// His diverging helpers, renamed so they don't clobber the Minimal sheet's versions.
	Handlebars.registerHelper("classicPoolGroups", pool => {
		const current = pool?.current ?? 0;
		return [
			Array.from({ length: 3 }, (_, i) => ({ checked: i < current,       index: i })),
			Array.from({ length: 3 }, (_, i) => ({ checked: (i + 3) < current, index: i + 3 })),
			Array.from({ length: 3 }, (_, i) => ({ checked: (i + 6) < current, index: i + 6 })),
		];
	});
	Handlebars.registerHelper("classicRepeatChecks", move => {
		const sel = move?.selection;
		if (!sel || sel.max <= 1) return [];
		return Array.from({ length: sel.max }, (_, i) => ({
			checked:  i < sel.value,
			disabled: i < sel.value ? move.isStarting : (!move.selectable || i !== sel.value),
		}));
	});

	// His partials, under the "classic.*" namespace, pointing at the vendored copies.
	foundry.applications.handlebars.loadTemplates({
		"classic.actor-header":         `${CLASSIC_TPL}/actor/partials/actor-header.hbs`,
		"classic.actor-stats":          `${CLASSIC_TPL}/actor/partials/actor-stats.hbs`,
		"classic.actor-attributes":     `${CLASSIC_TPL}/actor/partials/actor-attributes.hbs`,
		"classic.tab-playbook":         `${CLASSIC_TPL}/actor/partials/tab-playbook.hbs`,
		"classic.introductions-section":`${CLASSIC_TPL}/actor/partials/introductions-section.hbs`,
		"classic.tab-moves":            `${CLASSIC_TPL}/actor/partials/tab-moves.hbs`,
		"classic.tab-equipment":        `${CLASSIC_TPL}/actor/partials/tab-equipment.hbs`,
		"classic.tab-arcana":           `${CLASSIC_TPL}/actor/partials/tab-arcana.hbs`,
		"classic.arcanum-cards":        `${CLASSIC_TPL}/actor/partials/arcanum-cards.hbs`,
		"classic.tab-followers":        `${CLASSIC_TPL}/actor/partials/tab-followers.hbs`,
		"classic.follower-card":        `${CLASSIC_TPL}/actor/partials/follower-card.hbs`,
		"classic.follower-inventory":   `${CLASSIC_TPL}/actor/partials/follower-inventory.hbs`,
		"classic.outfit-items":         `${CLASSIC_TPL}/actor/partials/outfit-items.hbs`,
		"classic.outfit-item-row":      `${CLASSIC_TPL}/actor/partials/outfit-item-row.hbs`,
		"classic.editable-field":       `${CLASSIC_TPL}/actor/partials/editable-field.hbs`,
		"classic.tab-insert":           `${CLASSIC_TPL}/actor/partials/tab-insert.hbs`,
		"classic.tab-notes":            `${CLASSIC_TPL}/actor/partials/tab-notes.hbs`,
		"classic.selection-chips":      `${CLASSIC_TPL}/actor/partials/selection-chips.hbs`,
		"classic.selection-input":      `${CLASSIC_TPL}/actor/partials/selection-input.hbs`,
		"classic.instinct-section":     `${CLASSIC_TPL}/actor/partials/instinct-section.hbs`,
		"classic.move-group":           `${CLASSIC_TPL}/actor/partials/move-group.hbs`,
		"classic.choice-group":         `${CLASSIC_TPL}/actor/partials/choice-group.hbs`,
		"classic.choice-row":           `${CLASSIC_TPL}/actor/partials/choice-row.hbs`,
		"classic.choice-section":       `${CLASSIC_TPL}/actor/partials/lore-section.hbs`,
		"classic.section-heading":      `${CLASSIC_TPL}/actor/partials/section-heading.hbs`,
		"classic.section-sub-heading":  `${CLASSIC_TPL}/actor/partials/section-sub-heading.hbs`,
		"classic.resource-track":       `${CLASSIC_TPL}/actor/partials/resource-track.hbs`,
		"classic.steading":             `${CLASSIC_TPL}/actor/steading.hbs`,
		"classic.choices-entry-fields": `${CLASSIC_TPL}/item/partials/choices-entry-fields.hbs`,
		"classic.choice-group-editor":  `${CLASSIC_TPL}/item/partials/choice-group-editor.hbs`,
	});
}
