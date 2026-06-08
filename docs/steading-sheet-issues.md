# Steading Sheet — Open Issues

All issues resolved. See git history for details.

## ✅ Issue 1: Names fields should be read-only

**Where**: Residents tab "Names" panel; Neighbors tab place "Names" field.
**Problem**: Both are editable `<textarea>` elements.
**Fix**:
- Residents: change names panel to a read-only `<p>` (display-only, no textarea).
- Neighbor places: change `<textarea class="stonetop-neighbor-place-names">` to a read-only `<p>`.
- JS: remove the `.stonetop-resident-names-textarea` and `.stonetop-neighbor-place-names` change handlers.
- CSS: style the read-only names text to match the panel font/size.

---

## ✅ Issue 2: Content categories should be free-text textareas

**Where**: Notes tab — Excluded Content, Veiled Content, Special Handling panels.
**Problem**: Currently renders a list-of-items UI (add/remove per row) that maps to `stonetop.content[n].items` arrays.
**Fix**:
- Data model (`SteadingData`): add `excludedText`, `veiledText`, `specialHandlingText` string fields to `content` SchemaField.
- Domain (`SteadingContent`): add `updateText(section, value)` method.
- Snapshot (`ContentSection`): add `text` property; `SteadingContent.buildSnapshot()` populates it.
- Template: replace `stonetop-steading-content-items` add/remove list with a single `<textarea class="stonetop-content-textarea" data-type="{{slug}}">`.
- JS: remove `stonetop-content-add`, `stonetop-content-remove`, `stonetop-content-item` listeners; add single `stonetop-content-textarea` change handler.

---

## ✅ Issue 3: Moves tab should auto-populate from compendium

**Where**: Moves tab.
**Problem**: `SteadingMoves.buildSnapshot()` queries `actor.items` filtered to type `"move"`. Since no move items are embedded on the steading actor by default, the tab always shows "No homefront moves assigned."
**Fix**:
- Create `FoundrySteadingMovesRepository` (parallel to `FoundrySteadingImprovementRepository`) reading from `stonetop.moves` pack, filtered to `system.moveType === "homefront"`.
- Constructor: `new FoundryPackStore("stonetop.moves", [...needed fields])`, sort by name.
- Inject into `SteadingMoves` constructor (constructor-injected, not lazy-built).
- `SteadingMoves.buildSnapshot()` pulls from the repository instead of actor items. Each entry becomes a move snapshot with `selection = {value:1, max:1}`, `isStarting = true`, `selectable = false`.
- Wire repository into `StonetopSteading` constructor, pass to `SteadingMoves`.

---

## ✅ Issue 4: Stats should roll via existing actor rolling logic

**Where**: Steading header stat panels — Fortunes, Surplus, Population, Prosperity, Defenses.
**Problem**: Stat panel `<h2>` buttons use `class="steading-stat-roll"` with a custom listener that calls nothing — the custom roll dialog was removed but the listener was not properly replaced.  The base `StonetopActorSheet.activateListeners` already handles `.rollable[data-roll]` → `actor._onRoll(ev)`.
**Fix**:
- Template: add `class="rollable"` and `data-roll="<stat>"` to Fortunes, Surplus, Population, Prosperity, Defenses `<button>` elements.
- Template: **Size is not rollable** — replace its `<button class="steading-stat-roll">` with a plain `<h2>Size</h2>` (no button).
- JS: remove the now-unused `steading-stat-roll` click listener from `StonetopSteadingSheet`.
- Domain (`StonetopSteading.resolveBonus`): add `if (rollStat === "surplus") return this._actor.system.surplus ?? null;` so surplus rolls correctly.

---

## ✅ Issue 5: Resources and Defenses in Overview tab should use bullet-point entry list

**Where**: Overview tab — Resources panel, Defenses panel.
**Problem**: Currently renders free-text textareas bound to new `system.resources` and `system.defenseNotes` fields added in Phase 4.
**Fix**:
- Template: Resources panel → render `stonetop.attributes.prosperity.items` with the `stonetop-attr-extra` list (PNG icon add/remove buttons, matching old mid-row layout). Defenses panel → render `stonetop.attributes.defenses.items` the same way.
- Data model (`SteadingData`): remove `resources`, `defenseNotes`, `assetsText` fields.
- Domain (`StonetopSteading`): remove `setResources`, `setDefenseNotes`, `setAssetsText` methods.
- Snapshot (`SteadingSnapshot`): remove `resources`, `defenseNotes`, `assetsText` fields.
- JS: remove the three textarea change handlers; the existing `stonetop-attr-extra-*` listeners already handle the list.
- CSS: add bullet list item styles scoped to `.steading-overview-field` (or reuse existing `st-extra-row` equivalents under a new scoped selector).
- Also remove the `assetsText` textarea from the Assets panel; the Assets panel becomes: just assets items list + currency grid (same as old sheet).

---

## ✅ Issue 6: Tab bar should match character sheet formatting

**Where**: All steading sheet tabs.
**Problem**: The steading-specific `.steading .sheet-tabs` CSS overrides the global `.stonetop.sheet .sheet-tabs` rules, so steading tabs render with plain borders instead of the `tab-half-frame.png` background image.
**Fix**:
- CSS: remove the custom steading `sheet-tabs`, `sheet-tabs .item`, `sheet-tabs .item.active` rules from the steading section.
- CSS: remove the custom `sheet-body .tab` / `sheet-body .tab.active` display rules (the global PBTA tab switching already handles this).
- The global `.stonetop.sheet .sheet-tabs` rules (decorative PNG background, tab-half-frame) will then apply to the steading sheet automatically.

---

## ✅ Issue 7: stonetop-item-description should not appear bolder than other text

**Where**: Move descriptions everywhere (character sheet, steading moves tab).
**Problem**: Description HTML often contains `<strong>` and `<em>` move-trigger text. These naturally render bold, but if any ancestor's `font-weight` is elevated (e.g., `bolder`), they compound and appear overly heavy.
**Fix**:
- CSS: explicitly set `font-weight: normal` on `.stonetop-item-description` so it resets any inherited weight. The `<strong>` tags inside will still be correctly bold relative to normal.

---

## ✅ Issue 8: Fonts broken on steading sheet; global button font rule

**Where**: Steading sheet overall; possibly bleeding visually.
**Problem A**: `form.stonetop.sheet.steading { font-family: var(--font-primary); }` has higher specificity (0,4,1) than `.stonetop.sheet button { font-family: StonetopUI; font-weight: bolder; }` (0,2,1). So inside the steading form, ALL buttons use Signika instead of StonetopUI — including stat roll buttons that should look decorative.
**Problem B**: The global `.stonetop.sheet button { font-weight: bolder; }` rule applies to every button (rollable dice links, icon buttons, resource track buttons) giving them the heavy small-caps appearance when they should be plain.
**Fix**:
- CSS: Remove `font-family: var(--font-primary)` from `form.stonetop.sheet.steading` (drop the property; keep the other layout rules on the form).
- CSS: Narrow the global bolder-font list to exclude `button` generically. Instead, explicitly list only the elements that should be StonetopUI/bolder: `h1, h2, h3, h4, .stonetop-stat-roll, .stonetop-move-group-title`, etc. Keep the steading `.steading-stat-roll` scoped rule.
- The result: non-heading buttons (icon buttons, resource track buttons, dialog buttons) revert to the default body font, while headings and named UI elements keep the decorative font.

---

## ✅ Issue 9: Font size inconsistency across character sheet sections

**Where**: Character sheet — choice track rows, instinct, background, moves, and other sections all render at visually different sizes.
**What**: Audit every text-bearing CSS class on the character sheet and establish one consistent scale:
- Section headings: StonetopUI, ~0.85rem, bolder
- Item names / labels: default font, ~0.8rem, normal or semi-bold
- Descriptions / body text: default font, ~0.78rem, normal, secondary colour
- Small annotations (requirements, sources, notes): ~0.7rem, secondary colour
- Track/checkbox labels: ~0.72rem

All choice-row, instinct, background, move, arcanum, and follower sections must use these shared values — no one-off `font-size` or `font-weight` overrides unless there is a specific documented reason.


the remove button for resources, defenses and assets is flex and takes up 90% of the space, pushing the actual content to a small box on the left. the remove button in neighbors wraps to the next line. it should be inline.
