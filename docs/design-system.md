# Stonetop design system

The visual and interaction vocabulary for the Stonetop system — **both sheets**, item sheets,
dialogs and anything added later. Amended, not closed.

Four parts: the principles the codebase already holds, an audit of every device that exists today
and where the same job is done twice, the rules that resolve those collisions, and the character
sheet's layout. A rule's purpose is to make future choices **derivable** rather than re-argued: if
one doesn't settle a case, amend it rather than working around it.

---

## 1 · Principles

Quoted from comments in the code. These are settled practice — read them before proposing anything
that contradicts one.

- **A color is never the only carrier of anything.** Every state that is shown in color is also in
  words, in the DOM, for assistive tech.
- **Activation, not proximity.** From `move-item.hbs`: *"A hover card would be governed by SC 1.4.13
  (dismissible, hoverable, persistent) and would need a second path for touch and a third for the
  keyboard; a disclosure announces itself through `aria-expanded` and behaves identically for all
  three."* What this settles is **what a row's guaranteed path is**: the disclosure, because it is
  the one that behaves the same for pointer, touch and keyboard. It does not rule a hover card out
  as an *additional* path on top of one — the same comment refers to the shifting objection as
  having been *"an objection to HOVER"* in passing, which is not the same as rejecting it. A card
  that is nobody's only route to the text is a separate question — answered on the character sheet:
  its move rows carry a hover card as a second route beside the caret.
- **Nothing re-orders under a tick.** From the improvement board: *"Sorting by progress moved a card
  the moment you ticked a box on it, which is the one time a reader is certain to be looking at
  it."* The board's search filters rows in place on `input` — no re-render, no writes to the actor —
  and its chips are independent toggles, not an exclusive set.
- **The label sits on the border.** `steading-stat-panel.hbs` calls itself *"the same device the
  character sheet gives a stat"*: the name is punched into the top rule and the note into the
  bottom, so neither can be mistaken for the value between them.
- **Lift whole illustrated panels; don't frame cropped art.** The book gives Fortunes and Surplus an
  illustrated arch and the partial takes the *whole* panel, because *"a rectangle can never crop a
  curved shoulder cleanly, so drawing an arch around a cropped interior put two strokes on the
  page."*
- **Guide, don't enforce.** Budgets and limits are stated, never imposed. Nothing gets disabled for
  being over budget.
- **Reuse before building.** Most of the damage in both previous attempts was reinventing something
  that already existed.
- **Fix data, not code.** A gap in pack data gets fixed in the data, not papered over at runtime.

What the sheets are designed against:

- **Screens are wider than they are tall.** Height is the scarce axis; anything that spends height
  to buy width is going the wrong way.
- **Many players are on small laptops.** Budget around 600px of usable window height.
- **The sheet is not the rulebook.** Every move is in the compendium, so a surface carries what is
  needed *now*. That fallback is good enough only for what is rarely needed: what every player uses
  every session deserves a route from the sheet, even if it does not deserve the room.
- **A sheet is dressed for creation and used for play.** Catalogues open in full serve the one
  session a character is made in; every session after it wants the character's own things first.

And how the sheets answer that:

- **A choice rests on what was chosen.** Every choice shows what was chosen and has one door to the
  rest. **While choosing, nothing on offer is hidden**: every option shows its own options and full
  text. Resting may show only what was chosen; choosing may not.
- **Nothing dims that a character owns.** A move out of reach is set back, its reason legible; one
  already held never is, even at its limit, which its own filled boxes say. Finished is not blocked.
- **No mode the sheet is in or out of.** Choices are made during play too (claiming an unnamed mark
  mid-expedition), so no surface may make one impossible because it thinks the session has moved on.
- **A conditional move appears when its condition is met, and not otherwise.** The compendium makes
  that safe: the sheet is not the only copy.

---

## 2 · Vocabulary audit

Every visual device the sheet owns, what job it does, and — at the end — the jobs currently done two
or three different ways. This is the material a style decision has to be made *against*; without it
"make it look like Stonetop" is a matter of taste.

### Enclosures — every element with book art masked onto it

| device | art | job |
|---|---|---|
| `.stonetop-stat::before` | `frame-stat` | a stat tile |
| `.stonetop-resource--wide` / `--small::before` | `frame-wide` / `frame-stat` | a vital tile (HP, Armor, Damage, XP, Level) |
| `.stonetop-section-panel::before` | 9-slice `panel-*` | a panel of fields — **used by no template** |
| `.stonetop-outfit-header` / `.stonetop-prosperity-panel::before` | 9-slice `panel-*` | a framed context panel |
| `.stonetop-follower-card::before` | 9-slice `panel-*` | one follower |
| `.stonetop-roll-pick-content` / `.dialog-button::before` | 9-slice `panel-*` | dialog surfaces |
| `.stonetop-arcanum-card::before` + `.stonetop-arcanum-frame::before/::after` | `arcana-border-*` chain | one arcanum |
| `.stonetop.sheet .sheet-tabs::before` + `.item::before` | `tab-half-frame` | **the tab strip — already art-framed** |
| `.stonetop-panel-divider` | `divider-horizontal` | the rule under a section heading |
| `.stonetop-debility-divider` | `divider-debility` | the bracket spanning a stat pair |
| `.steading-tile--arched` | whole lifted panel | Fortunes / Surplus |

**Unused art:** `attributes-box.png`, `arcana-card-border.png`. (`sheet-bg.png` is live, via
`--st-paper-image` in `tokens.css`.)

### Headings

A panel's ink bar (`bar.hbs`) heads a section in **19 templates** — both sheets' tabs and rails, and
the steadfast sheet — the dominant idiom. `section-heading.hbs` emits `<h3
class="stonetop-move-group-title">` plus a `.stonetop-panel-divider` and is left in three: the band's
Stats, Outfit (D5) and Notes. Alongside them: bare `<h3>`s with their own classes
(`.stonetop-insert-name`), and title *spans* (`.stonetop-prosperity-title`, `.stonetop-levelup-title`,
`.stonetop-outfit-heading`, `.stonetop-introductions-title`). `section-sub-heading.hbs` is the h4.

### Marks

| device | size | shape | means |
|---|---|---|---|
| `.stonetop-item-check` / `-cg-track` / `-move-check` / `-possession-check` | `--control-check` 14px | square, 2px radius, **2px** border | you have taken this |
| `.stonetop-repeat-check` | same | same | one of N takes of a repeatable move |
| `.stonetop-debility-check` | same family | square | this debility is marked |
| resource pips (`-item-resource-check`, `-background-resource-btn`, follower loyalty, arcanum) | `--control-pip` 16px | **circle** | one use, spent or not |
| `.stonetop-inv-diamond` | `--control-marker` 11px | ◇, 1px border | **weight and carried, in one control** |
| `.stonetop-inv-square` | `--control-marker` 11px | □, 1px border, fills when checked | a small item |
| `.stonetop-choice-tick` | 14px | a **✓ glyph** | the same "taken" fact, in the condensed view |
| `.stonetop-rollmode-mark` (stacked) | 0.6rem | circle | which roll mode is live |
| `.stonetop-masthead-debility-circle` | 0.6rem | circle | this debility is marked |

### Rollable

Six class combinations mean "this rolls": `rollable move-rollable`, `stonetop-stat-roll rollable`,
`stonetop-folded-abbr rollable`, `stonetop-resource__label stonetop-damage-roll rollable`,
`steading-stat-roll rollable`, and the turn-roll variant. The shared token is `.rollable[data-roll]`,
which is all the sheet's delegation needs.

### Empty states

Nine hand-rolled classes, no shared component: `choices-empty`, `steading-board-empty`,
`steading-turnover-empty`, `stonetop-arcana-empty`, `stonetop-followers-empty`,
`stonetop-insert-sheet-empty`, `stonetop-moves-empty`, `stonetop-playbook-empty`,
`stonetop-playbook-empty-hint`.

### Rail and tab strip

The character sheet and the steading share one rail and one tab strip. The rail sits on the left on
sunken paper, and a small tab (0.85rem across, pressed across 24px) rides its edge. Put away, the
rail slides out under the column beside it; below 62.5rem of layout (1000px at the default font
size) it is a drawer over the tab. While a column rail slides, the column beside it keeps the
width it has with the rail shut and is pushed, clipped at the sheet's edge, rather than squeezed:
the tab is laid out once per slide, never frame by frame. The column
beside it — the character's band or the steading's ledger line, the tab strip and the tab — has one
1.5rem inset, which is also where the rail's tab sits. A rail can also sit on a layout's END edge, with its tab on its left
edge: the steading's Folk tab keeps its name and trait lists in one, beside the roster. It slides out
to the right, and the column beside it widens with it rather than being held; it never becomes a
drawer — a tab too narrow for it stacks it under the roster instead. Tabs never shrink or overlap: those the strip
has no room for are listed under a "More" menu at its end, and the open tab always stays in the
strip. The rail's move groups are panels headed by an ink bar with a caret.

The two sheets divide into the same three regions, each on its own ground and each the same on both
sheets (the `--region-*` tokens on `.application.stonetop`): the rail on sunken paper, as a column or
a drawer; the top bar over the tabs (`.stonetop-head` — the character's band, the steading's ledger
line) on raised paper, ruled off below; and the tab, strip and body, on the window's textured paper.
A drawer is lifted over the tab by its shadow, not by a lighter ground, which would make it read as
part of the top bar.

The character band's foot — the roll mode and the Stats fold control — always sits beside the stats,
never under them. Short of room the fold control drops its word and keeps its caret; past that
(a language longer than any shipped) the line wraps inside its own column. The rail breakpoint and
the sheet's 47rem floor are set so English and German never need the wrap.

The Ailments panel's wound editor hangs from the panel's bottom edge at the panel's width, over the
tab. The outfit adder follows the same pattern: an editor hangs from what opened it (the "+ add
item" button), at its width, over what is below, headed by a preview drawn with the real row partial.
Nothing is written until its Add. Its way out is a word ("Done"), never a ×: on this sheet × removes something, and removing asks
first (right-click skips the question), as every delete does.

### Toggles

No tab has a lock or a filter any more: each section and each Moves or Possessions panel has its own
door on its bar (D11), and a Moves panel a caret beside it. The one view flag left is the Level Up
checklist's (`levelUpOpen`), a `<button>` with `data-view-flag` and `data-view-state` so it stays
live on a non-editable sheet.

### The same job, done more than one way

1. **"This is checked."** A filled 14px square in the live view, a **✓ glyph** in the condensed view
   (`.stonetop-choice-tick`), so the same choice looks different depending on which tab it is read
   on.
2. **The condition circle and the radio ring are the same rule.** `.steading-circle` and
   `.stonetop-masthead-debility-circle` share one declaration for *a condition you are in*, and
   `.stonetop-rollmode-mark` is byte-identical to it. In practice they never meet: the ring is drawn
   only in the stacked dialog variant, which carries no conditions, and the inline variant used on
   both sheets sets `display: none` on the mark entirely.
3. **Circles at two sizes.** A resource pip is `--control-pip` (16px); a condition is 0.6rem. Size is
   doing semantic work that nothing declares.
4. **"One of these is selected" is drawn four ways.**
   - *background, origin* — a real `<input type="radio">` wearing `.stonetop-item-check`, the
     acquisition square (`tab-playbook.hbs:45`, `:100`)
   - *roll mode, inline* — both sheet headers: **no mark at all**; the live word takes the accent
     color and an accent underline
   - *roll mode, stacked* — the stat-pick dialog: a dot-in-ring circle, because there the choice
     *is* the box
   - *outfit load* — a radio that is a **readout**: `pointer-events: none`, reporting the level read
     off the marked ◇ rather than setting it
5. **Group headings, four idioms** — the ink bar (19 uses), the `section-heading` partial (3), bare
   `<h3>`s, and title spans. The bar is the dominant one; the others predate or bypass it.
6. **Nine empty states, no component.** Every one is a one-off `<p>`.
7. **Tile enclosure, three treatments** — `frame-stat` on a character stat, `frame-wide`/`frame-stat`
   on a vital, a whole lifted illustrated panel on a steading rating. Defensible, since the book
   distinguishes them, but undeclared.
8. **`.stonetop-move-group-title` is the generic section heading**, not a moves-only class. The name
   misleads — it is correctly used for non-move sections such as the band's "Stats" heading.
9. **`.stonetop-section-panel` exists, is complete, and no template uses it** — the one device
   explicitly built for "a panel of fields". It is also **broken at small heights**: its edges are
   declared `repeat-x` / `repeat-y`, but `mask-size: calc(100% - 32px) 8px` stretches the whole
   256×8 tile across the run instead of repeating it, so the top and bottom rules smear the wider
   the panel gets. The 8×32 side edges compress and look right, which is why it reads as damaged on
   one axis only.
10. **The folded density shows something the open one does not.** `actor-header.hbs` renders the
    three debilities — and the active one's `{{summary}}`, the sentence a player acts on — only
    under `.top-collapsed`. Open, the brackets name the conditions but the summary is nowhere, so
    the only way to read what *dazed* does is to fold the band. Against the density rule in §3.

---

## 3 · The rules, as the system already follows them

**Descriptive, not aspirational.** This section records the rules the shipped code actually obeys,
so it can be used as the baseline. Anything anyone wants to *change* is a proposal until it is
decided; once decided it is folded in here.

A rule's purpose is to make a choice **derivable** rather than re-argued. Where the code contradicts
itself, that is recorded in §2 as a collision rather than settled here by assertion.

### Enclosure — by what a thing *is*

| level | used for |
|---|---|
| **Book art frame** | a single **object** you read or act on whole: a stat tile, a vital, a follower card, an arcanum card, the tab strip, the outfit and prosperity panels |
| **Sunken ground and a thin rule** | an **object inside an object** — a follower printed on the arcanum that grants it. Set apart as its own thing, never given a second art frame inside the first |
| **Nothing** | lists, and anything else inside another enclosure — a row, a pick, a choice line |

Art is expensive attention: an object earns it, a sequence doesn't. Six art frames stacked down a
page is the failure the steading's own comment warns about — *"a rectangle can never crop a curved
shoulder cleanly… two strokes on the page."*

`.stonetop-section-panel` is a complete 9-slice art panel with no template using it.

### Marks — shape carries the meaning

| shape | means | examples |
|---|---|---|
| **□ square** | *taken.* Acquisition, and it persists until untaken | move check, repeat check, possession check — and, inconsistently, the background and origin radios (§2, collision 4) |
| **○ circle** | *a state* — either a condition you are in, or one unit of a resource | debilities and steading conditions (0.6rem); resource pips, follower loyalty, arcanum tracks (`--control-pip`) |
| **◇ diamond** | *weight* — and, in the inventory, simultaneously *carried* | outfit items |
| **◉ dot-in-ring** | *one of these is selected* | the stat-pick dialog's roll mode — **the stacked variant only** |
| **no mark at all** | *one of these is selected*, on a line of words | roll mode on both sheet headers: the live option takes the accent color **and an accent underline** |

**The split is "chose" versus "is".** A square is something you *decided*; a circle is a state you
are *in* or *spend*. That is why debilities are circles and not checkboxes, even though they are
toggled with one — and it is a deliberate exception to "□ = acquisition", shared with the steading's
conditions by one rule.

Within circles, context separates the two meanings: a **condition** circle stands alone beside a
name, a **resource** circle sits in a track of identical marks.

**Selection has no single mark.** A one-of-N choice is drawn four different ways depending on the
surface — see §2, collision 4. On a line of words the mark is dropped entirely and the accent color
plus an underline carries it; in a dialog, where the choice *is* the box, the ring is drawn.

**Also unresolved:** a debility is drawn differently in the two densities — the band's tick *is* the
input, framed in the bracket art; the masthead's is a painted span beside a hidden input. Same fact,
two marks.

**Three sizes, by role:** `--control-check` (14px), `--control-pip` (16px), `--control-marker`
(11px). The 0.6rem condition circle sits outside that scale.

### Headings

A section on a tab is a panel headed by its ink bar (`bar.hbs`), on both sheets and the steadfast
sheet. Its body takes the section inset; its controls — a door, a caret, the advice `?` — hang from the
bar's far end as `.stonetop-bar-action`s. A list panel sizes to its rows; only a writing area (the
steading's notes) takes a column's leftover height. Two columns of panels sit a panel's gap apart, with
no rule between them.

- **A rating heads the list that justifies it by being its bar** — Prosperity over Resources, Defenses
  over Fortifications on the steading's Play tab. The bar's title is the rating's name and rolls it, its
  note is the rating's note, and its value sits at the far end, centred on the bar's line rather than
  hanging below it. One line for the rating, no frame between it and its evidence; the list's own name
  lives on in its add control. The print sheet's rating-beside-list box is a pencil technique and is
  not copied: it spends a column on three short lines.
- **Lists that belong together are one panel.** The Folk tab's name pools and NPC traits are one
  collapsible panel; each list inside it is a sub-heading with its own fold, in the voice a move
  panel gives a part of the journey. Shut, the panel is its bar and the roster takes its width.
- **A bar under a tab names what the tab holds, not the tab again.** The Season tab's head is a
  section whose bar says which season and year it is ("Spring, year 1"), never "Season".
- **The season's move keeps its glyph heading, not a bar.** The Seasons Change box is done once a
  season, so it is quieter than a section: its own frame, the season's glyph and the move's name in
  the season's tint. An ink bar made it the loudest thing on the tab — the fault the box was rebuilt
  to fix (it used to be a shut disclosure headed "Turn to <next>").

`section-heading.hbs` (an h3 plus a `.stonetop-panel-divider`) survives in three templates (§2).
`section-sub-heading.hbs` is the h4. Bare `<h3>`s and title spans also exist (§2).
`.stonetop-move-group-title` is the generic section-title class despite its name.

A panel's ink bar (`bar.hbs`) names its section at `--fs-title`, on both sheets. The bar's own text
is `--fs-note`, which is where its instruction stays; the small-caps face stands its lowercase at about
two-thirds of its size, so a name set there read near 10px, and at `--fs-heading` near 12px.

### Type — three faces, by role, one scale

Both sheets set the same faces for the same jobs, on the one `--fs-*` scale in `:root`:

| face | role | examples |
|---|---|---|
| **Signika** (`--font-primary`) | what you read and type, and every number | list rows, move text, fields, stat and rating values, the treasury, a note that is a number ("→ −1 lacking") |
| **StonetopUI** small caps | names | bar titles, move names, stat and rating names |
| **IM Fell English** italic | the book's own voice | conditions and their effects, a rating's tier gloss, the playbook title, ailment names |

The Fell is named by its stack, never reached through `--font-serif`: Foundry's font setting
redeclares that token on `body` (Amiri in the dev world). Its figures are old-style, which is why a note
that is a number takes Signika. Core sets every textarea in its monospace face; one rule hands every
Stonetop sheet's textareas back to the sheet's.

### Rollable — one contract, one active state

`.rollable[data-roll]` is the whole contract the delegation needs. A roll control may *look* like a
name, an abbreviation or a die depending on what it labels. What is shared is the **active** state —
accent under a pointer or focus — so two dice on one sheet mean one thing.

**The rest state is not shared: a roll control rests at the ink of whatever it labels.** A bare die
has no words to carry, so it rests faint (`--st-ink-faint`). A control that *is* words rests as those
words: the stat label `STR` and the `Damage` label both rest at `--st-ink`, measured on the rendered
sheet. The exception is the folded band's abbreviations, which rest at `--st-ink-muted` — the same
stat, one ink open and another folded.

This sentence used to say "faint at rest… one rule everywhere", which was never true of the shipped
code and had a cost: the redesign merged the die and a move's name into one roll control, read that
line, and faded every move name on the sheet to match the die — including names that roll nothing.

### Density — two, both always present

Full and folded. Both densities stay in the markup so switching **reveals** rather than moves — the
band already works this way, and the steading rail carries a `data-density` attribute for the same
idea. Never a third.

**The collapsed density shows LESS than the expanded one. Never more.**

This is what makes a fold a fold. A reader collapses a region to buy height, having decided they can
do without what is in it — so anything that appears *only* when it is shut is information they have
to give something up to read, and the control that was supposed to save them room is now also the
control that hides half the answer. It also makes the two states impossible to reason about: if each
carries something the other does not, neither is the whole thing and a reader has to visit both.

Less means less of the same, not different: the collapsed line carries fewer facts about the same
subjects, at line height, with the expanded view a superset. A fact that only fits at one density
belongs at the expanded one.

**The masthead's debility strip currently breaks this** — `actor-header.hbs` renders the three
conditions, and the active one's `{{summary}}`, **only when the band is folded**, so shutting the
band is how a player reads what their condition does. Recorded in §2 as a collision rather than
fixed here.

### State — never color alone, always on the thing itself

Existing principle, restated because it is the one most easily lost: every state shown in color is
also in words in the DOM. And state belongs on the element it describes, not on a sibling — which is
why a hindered stat is marked on the tile, not only under it.

---

## 4 · The character sheet's layout

Numbered, because the code cites them.

- **D1 · Play comes first.** The first tab is what a character has; with no playbook chosen it is the
  playbook picker. The steading's first tab is Play too.
- **D2 · Playbook moves open in full while picking; the reader decides in play.** Each move shuts on
  its own and the sheet remembers it, since how much of a move a reader needs is not in the data.
- **D3 · Nothing dims that a character owns** (§1).
- **D4 · No mode the sheet is in or out of** (§1).
- **D5 · Outfitting is left alone.** It already shows a character's own things first.
- **D6 · Debilities are brackets** spanning the pair of stats each one hinders.
- **D7 · The rail carries identity and state; the band carries the stats.** The rail: the portrait
  with the level on it, armor and damage, hit points and experience as tracks, all still editable.
  The six stats never join the rail, since rolling needs the stat and the move at once. Instinct and
  appearance are one-line readouts by the name, cut to "…", edited where they are chosen. Ailments
  show three rows, the rest a count on the bar.
- **D8 · Reference moves are placed by what they are about.** The basic moves in the rail, open; the
  expedition moves a second rail group, shut, split by phase; follower moves once, at the top of
  Followers, while there are followers.
- **D9 · The special moves land where they apply.** Advantage/Disadvantage is a `?` after the roll
  mode; Death's Door a row under hit points only while dying (an insert's own zero-HP move in its
  place); End of Session a route beside experience; Level Up, then Burn Brightly, at the threshold.
- **D10 · A player can write an item onto their own list**, in place, as a full item. See
  `docs/features/outfitting.md`.
- **D11 · Sections rest on what was chosen** (§1), each with one door on its bar: Change or Choose,
  Done while open. Opening everything is an event (choosing a playbook, gaining an insert), not a
  standing state. The Playbook tab's sections sit in two fixed columns, so nothing jumps columns under
  the pointer. The steading's season head is a section too, its bar naming the season and year (§3):
  at rest the wheel, and a door for the GM alone that opens the same pill as radios, with the year
  beside it.
- **D12 · An insert is a tab, with the whole insert on it**, straight after Playbook: its moves, its
  instinct and its sections. One gained by dying arrives open and the sheet goes to its tab.
- **D13 · The arcana a character holds are listed beside the one card being read.** Majors first, as
  the book orders them, each group under its ink bar. A line names the arcanum, what lies face up (the
  mystery once flipped, else its ◇ item or disguise tags), and its track, live. Every card is drawn and
  only the chosen one shown, so choosing draws nothing; the choice is the reader's, per sheet. A lone
  arcanum is its card alone. Cards keep the book's chain frame and its art — trimmed of the canvas the
  books embed it on, to the right of the title band once the card is wide enough; the card stops at a
  reading measure and never splits its text into columns, since a requirement list broken across two
  would read as two lists. A follower the card grants is printed whole and read-only on sunken ground
  (§3), saying where it goes once marked; it is edited on the Followers tab.
