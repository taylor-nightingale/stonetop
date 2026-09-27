# Redesign working notes

The deck is the design: what it draws is what we are building. **Decisions**, below, is why, plus
what the deck does not draw. Keep it in step with the deck, and keep each decision's number, since
the code cites them. Everything after it is scratch: measurements, gap analysis, raw notes.

Where things belong once processed:

| | |
|---|---|
| what a thing *is* | `docs/features/<feature>.md` |
| what things look like and how they behave | `docs/design-system.md` |
| what we are building and why | the deck, and **Decisions** below |
| measurements, gap analysis, raw notes | here |

---

## Decisions

### What we are designing against

- **Screens are wider than they are tall.** Height is the scarce axis. Anything that spends height
  to buy width is going the wrong way.
- **Many players are on small laptops.** Budget around 600px of usable window height.
- **The sheet is not the rulebook.** Every move is in the compendium, so a surface carries what is
  needed *now*. Reference that is not needed now can be absent without being lost. That fallback is
  only good enough for what is **rarely** needed: something every player uses every session deserves
  a route from the sheet, even if it does not deserve the room.
- **The sheet is dressed for creation and used for play.** Every catalogue is open by default, so a
  character reads twenty-five moves to find their nine.

### Not drawn in the deck

**D1 · A Play surface comes first.** A tab holding what a character has, ahead of the playbook. With
no playbook chosen it is the playbook picker, and choosing one fills it. Play is what the sheet is
opened for every session, and the current first tab is the one needed once. The steading sheet
already works this way: its first tab is Play, and it is the default.

**D2 · Playbook moves open by default when picking; the reader decides in play.** Choosing is done on
the text, so the catalogue shows moves in full (drawn). In play each move can be shut individually,
and what the reader changed is remembered (not drawn). How much of a move needs showing grows with
the reader's familiarity with it, which nothing in the data can tell, so it cannot be inferred or
fixed for everyone. Answers the familiarity invariant in `docs/features/playbook-moves.md`.

**D3 · Nothing dims that a character owns.** While picking, a move out of reach is set back and the
reason stays legible. A move already held is never dimmed, even when it cannot be taken again:
requirements point at held moves, so owned moves are how the unavailable ones are read. A move taken
to its limit says so through its own filled boxes. "Finished" is a different fact from "blocked".

**D4 · No mode the sheet is in or out of.** Whatever shows a character their own things first is not
a door that closes. Picking happens during play (claiming an unnamed mark mid-expedition), so no
surface may make a choice impossible because it thinks the session has moved on.

**D5 · Outfitting is left alone.** It already does what the rest are being asked to do. The only
change under consideration is a load a character can choose rather than only land in.

**D6 · Debilities render as they do today:** brackets spanning the pair of stats each one hinders.
Closed; see `docs/design-system.md`.

**D10 · A player can write an item onto their own list.** The printed list has blanks, and filling
one is ordinary play, most often mid-expedition with something just acquired (`outfitting.md`). A
character must be able to author an item and place it: a name, a weight or none, uses that can be
spent, tags, a note.
- **Writing it down is inert.** It adds the item to what this character has. It does not mark it,
  change the load, or spend an unnamed mark. Carrying it is a separate act, and keeping the two apart
  is what makes authoring safe mid-expedition.
- **It revises the standing approach** (author custom items in the Items directory and drop them on).
  That was already not uniform, since a follower's gear can be added in place, and it is the wrong
  fit for a moment at the table with something in hand.
- **Persistence, not scope.** Whether an item outlasts a season, or another character can have one,
  is the table's call. The rule is that **nothing removes a written-in item except the player
  removing it.** Setting a new load clears marks, not the list.

### Drawn in the deck

The deck shows each of these, and its comments carry the detail. What is here is the part the deck
cannot show.

**D7 · The rail carries identity and state** (`rail.js`, `band.js`). Portrait with the level on it,
armor and damage, hit points and experience as tracks. All of it stays editable: the first mock
replaced every stepper with a readout without noticing. The two paired numbers differ: current hit
points change constantly, while the maximum is granted by the playbook and does not climb with
level; experience's threshold is derived from level, never set. The half a reader touches gets the
direct control. **The six stats never join the rail**: rolling needs the stat and the move, so one
scrolling column would make them mutually exclusive.

Instinct and appearance are identity, not vitals, so they are readouts by the name in the masthead,
edited where they are chosen (the playbook, or the insert that carries the instinct). There is
always exactly one instinct label: an insert's replaces the playbook's, and a written-in one
replaces a picked one. Instinct is reviewed at every level-up, so the readout routes to its editor.
Each is **one line, cut to "…"** on a narrow sheet with the whole line in its tooltip, because a
wrapped line grew the band.

The band's ailments show **three rows, always**, and the rest as a count on the bar that opens the
editor.

**D8 · Reference moves are placed by what they are about** (`rail.js`, the Followers tab). The ten
basic moves stay in view, a group that starts open; the reader can shut it, the sheet never does.
The ten expedition moves are a second group, shut by default and split by phase (setting out, on the
road, getting home), because on the road they fire as often as the basic ones and three roll. The
phases need a field in the pack data. Special moves go to the thing they attach to (D9). Follower
moves go at the top of the Followers tab, **once, not once per follower**, and only while there are
followers.

**D9 · Where the four special moves land** (`rail.js`, `band.js`). They are not a group, so they do
not land together.
- **Advantage/Disadvantage:** a `?` after the roll-mode options. Same look as the advice `?`,
  different action.
- **Death's Door:** a row that rolls, under hit points, only while dying. It is the move made at zero
  hit points, so an insert gained by dying shows its own instead (Tethered, Undying, Dark Succor).
  Which move a move replaces is data: a `replaces` field.
- **End of Session:** a route beside experience, not a row. Every player does its six things every
  session.
- **Level Up, then Burn Brightly, at the threshold.** They share a threshold and nothing else, and
  side by side they read as one decision. Level Up comes first and opens with **"Only at home, in a
  quiet stretch of time"**, with the book's trigger under it. It is a reminder, not a lock, and it is
  gone once the level is taken and a move is owed. Burn Brightly follows on a neutral edge under
  **"Or spend it now"**, open, since its trigger alone (*have enough XP to Level Up*) says the
  opposite of what it is.
- The sheet is where a player learns they **could** burn. The moment they would is after a roll, in
  chat, which is a larger piece of work.

The rule underneath: **a conditional move appears when its condition is met, and not otherwise.**
The compendium makes that safe, since the sheet is not the only copy. The shipped level-up strip is
the precedent.

**D11 · A choice rests on what was chosen** (`main.js`, `parts.js` `sectionPanel`). Every choice shows
what was chosen and has one door, on its bar, to the rest: Change (or Choose), and Done while open.
Opening everything is an event (choosing a playbook, gaining an insert), not a standing state. No
counts: the book's instruction is on the bar while open. Two **fixed** columns on the Playbook tab, so
nothing jumps columns under the pointer. Introductions is opened, not chosen. **While choosing,
nothing on offer is hidden**: every option shows its own options and full text. Resting may show only
what was chosen; choosing may not. Both states are the shipped markup; the change is when each shows.

**D12 · An insert is a tab, with the whole insert on it** (`main.js`). Straight after Playbook, with
its moves on it rather than on the Moves tab: the book prints an insert as one card, and consequences
are spent from inside its moves. An insert gained by dying arrives open and the sheet goes to its tab.
A Terrible Purpose rests open in full, because it is now how an Unliving character heals. An insert's
instinct sets the playbook's aside rather than clearing it.

### Pending: changes to the design system

Not decided. Each folds into `docs/design-system.md` once agreed.

- **P1 · Lists get an enclosure.** Book art frames objects and lists get nothing, which reads as flat.
- **P2 · The condition circle joins the control scale.**
- **P3 · A tick glyph only where something is genuinely read-only.**
- **P4 · Headings converge on the shared one.**
- **P5 · One empty-state component** in place of nine one-off lines.
- **P6 · Selection gets one mark.** A one-of-N choice is currently drawn four ways.
- **P7 · A debility is drawn differently in the two densities.**
- **P8 · The tab strip's padding narrows below 900px** (see the tab-strip measurement below).
- **P9 · Opening and shutting slide**, 0.4s ease with both ends in pixels (`motion.js`), and not at
  all under reduced motion.

### Open

- If Play carries a character's own moves, does the moves catalogue keep a reading view at all, or
  become purely the catalogue?
- How heavy the book's chrome should go on surfaces that do not have it today.
- What separates one entry from the next (today, a gap and nothing else). Settle it with P1.
- Burning XP from chat, after the roll, where the decision is actually made (D9).

---

## Measured, on the shipped sheet

Shipped sheet, Maelen, at its remembered 1280×1017 (declared default 1160×900,
`StonetopCharacterSheet.js:47`):

- **273px pinned chrome** — band 229 + tab strip 44. Folded: 146px.
- **Moves tab: 1,379px** of content. **Rail: 1,385px** in a 244px column.
- At a laptop-shaped 1342×600 viewport: ~**27%** of the Moves tab visible, ~5 rows of 25.
- Of Maelen's 25 playbook moves: **4 roll (16%)**, **3 carry a resource (12%)** — 84% have neither.
- **3 of 25** are repeatable.

---


Playbook moves tab, Maelen at 1280x1000:

- all 25 moves: **1,379px**; pressing the lock leaves 9 at **657px**
- 4 of 25 roll, 2 carry uses, 3 show repeat boxes
- 9 of 25 carry a requirement, **7 of those unmet**
- marking a move reflows the rows after it while the filter is on

Band, after the rebuild in this deck: **186px** against 229px shipped. Moving the vitals to the rail
is all that is available; the stat frames and brackets set the rest.

---

## The rail, rebuilt in this deck

Checked against §3's Rail and Move row tables, so that nothing below is a silent drop.

**Carried over unchanged:** the toggle and its collapse behaviour, XP and Level as steppers with the
derived max beside XP, the ready note, the level-up strip's *renders nothing unless it has something
to say*, disclosure rows without a tick, and Defend's resource track.

**Added:** the portrait with the level on it; instinct as a readout with a route to its editor;
appearance as the subtext under it; and three conditional rows that did not exist at all — Death's
Door, Burn Brightly, and a route to End of Session.

**Removed by decision (D8):** the special and follower groups — six of the twenty-six rows.
Follower goes with the followers, **once** rather than once per follower, at the top of the
Followers tab while there are any; the four special ones each go to the thing they attach to (D9).

**Removed, and put back:** the expedition group. D8 first sent it "with the expedition", a surface
that does not exist, and nothing was built to receive it — which left the rail with basic moves only.
On the road they fire as often as the basic ones and three roll, so they are a second group in the
rail now: shut by default, split into setting out / on the road / getting home. Measured at
1180×720: shut, the group adds **42px** to the rail (1,006 against 964); open, **600px** more
(1,606). Requisition's `+FORTUNES` label broke "Requisition" mid-word in the rail's roll column, so
steading ratings take the shipped sheet's short form (`stonetop.steading.attrShort`): `+FORT`.

**Dropped by this deck before today, and put back:** the toggle, which deck 2 also lost — and
Defend's track, hidden by `.rd-rail .rd-cell--uses { display: none }`. That was a width decision
that quietly took a resource with it, which is the same class of mistake as the two the ✗ flags
record.

### The move row, settled

One row, not three options. Measured against dnd5e rather than argued: that sheet has **no die
button anywhere** — 96 rollable elements on one character and essentially all of them are names.
Three things teach a player that a name rolls there: a column headed ROLL with the modifier under
it, a card on hover, and the fact that *every* name on the sheet does it.

Stonetop cannot use the third. Nine of ten basic moves roll and roughly one playbook move in six, so
"names roll" is not a rule anyone can learn — which is why the die stays. What changed is that it is
no longer a 16px target: **the die and the name are one button.** The die says what pressing it
does; the name is the part you hit. A move that does not roll has neither, and nothing else about it
differs — same face, same weight, same ink, and its dash sits on the same right edge as the stats.

- **Hover the name** → the card. **Press the caret** → the text in place. Two paths, no competition.
- The caret sits in the right cluster, where dnd5e keeps `toggleExpand`: rolling is constant,
  reading is occasional, so the wide target at the front belongs to the roll.
- **No chat bubble in the rail.** It cost 20px of the only column with anything long in it and
  wrapped three of ten names. The roll already posts its result and the Moves tab still has the
  bubble. Revisit if posting a move's text from the rail turns out to matter.
- **No ROLL heading.** The die in front says what the heading was there to say.

### The move row, and the three requirements it answers

1. **A move that rolls says so, and rolls from the row.** The control is the die, never the name —
   one vocabulary, because the name is the disclosure on every row whether it rolls or not. The
   reserved-column row got this wrong: it made the name the roll control on moves that roll and the
   disclosure on moves that don't.
2. **A resource is on the row, inline with the controls, carrying its title.** Not a second line and
   not behind the disclosure. `move-item.hbs` already puts `.stonetop-item-resources` in the controls
   group and `resource-track.hbs` already renders `resource.title` ahead of the pips.
3. **The trigger is a reminder, not a repetition.** `MoveGloss` lifts the gloss *verbatim* from the
   description's first emphasised run, so an open row prints the same clause twice — once as the
   gloss and again in the body's opening sentence. **Shipped rows do this today.** The fix is that
   the gloss retires while the row is open: a class, not a re-render, and nothing is lost.

Measured in a 240px rail, ten basic moves:

| | closed row | rail height |
|---|---|---|
| reserved-column row (before) | 71px | 1,435px |
| **A** · `move-item.hbs` disclosure | 49px, all ten | **957px** |
| **B** · A, stat in place of the die | 49px × 7, 66px × 3 | 1,010px |
| **C** · A, plus hover preview | 49px | 957px |

B's cost is the three rows whose names wrap — both Persuades and Defend. C contradicts §1 of the
design system, which records hover as considered and rejected as a density device.

### Layout traps this cost time

- **The header is a grid, and it does not wrap.** At 240px the controls simply crush the name:
  Defend's label measured 45px of the 48 it needs, and with a die-plus-stat control it measured
  **two**. Fixed with `minmax(0, 1fr) auto` and letting the NAME wrap instead.
- **`flex-wrap` is the wrong tool here.** Tried first: a name with `flex-grow` takes the whole line
  and pushes the controls onto one of their own, where they read as an orphan rather than as
  controls belonging to the name above them.
- **`margin-left: auto` on the controls absorbs all the free space**, so the name never grows past
  its own `flex-basis` — it wrapped three lines deep in a row that had room for one.
- **`@property` with a `rem` initial value is silently dropped.** `<length>` requires a
  computationally independent initial value, so `initial-value: 15rem` makes Chrome reject the whole
  rule — and an unregistered custom property is a token stream that cannot be transitioned. The
  collapse still worked; it just snapped, with nothing logged anywhere.
- **The deck's reload has to rewrite the WHOLE module graph.** Busting `main.js` alone leaves the
  real `rail.js` loading the cached `parts.js`, which renders a stale row that looks plausible. Every
  module needs to become a blob with its specifiers rewritten, in dependency order.

### Measured on the dnd5e sheet, not remembered

Zanna, a 1st-level gnome wizard, dnd5e 5.3.3 under Foundry 14. The two shapes the rail borrows:

**The cluster.** The portrait, with **AC in a shield straddling its bottom edge** and the three
death-save circles either side of it on the same line. Below that a second trio — Initiative and
Proficiency as raised diamonds with Speed lower and smaller between them. The centre badge is the
big one and the flankers sit *lower*, which is the arrangement the rail uses for Armor · Level ·
Damage.

The shield is **opaque**. That is not decoration: the first attempt drew the tiles with the book's
frame art, which is a mask with nothing behind it, and the level's "5" landed invisibly on the black
of the playbook crest.

**The bar.** `<div class="meter-group">` — a small uppercase label on its own line ABOVE, then the
bar, with the value *inside* it and `--bar-percentage` driving the fill. Two lines, not three, and
the number sits on the thing that qualifies it. `role="meter"` with `aria-valuemin/now/max` carries
the numbers for assistive tech.

One deliberate departure: dnd5e renders the value as text with the real `<input>` `hidden` beside
it, swapped in on click — which leaves the field keyboard-unreachable until someone clicks it. The
rail keeps real inputs, chrome stripped, sitting on the bar.

### Two things drawn here that were open, now decided in D9

- **Death's Door hangs off hit points, as a row that rolls.** It was a link, and rolling it is the
  one thing a dying character does.
- **Burn Brightly sits under experience, in its own box, open.** It was inside the Level Up box,
  where it read as part of levelling. The Level Up offer now carries the move's own trigger, which
  is what says levelling happens *at home*.
- **Revised: Level Up first, Burn Brightly labelled as the other choice.** Moved out of the Level Up
  box, Burn Brightly still sat straight under "ready to level" on the same accent edge, above Level
  Up, and its text opens "When you *have enough XP to Level Up*", so it was still taken for the
  level-up. Now:
  - Level Up comes first.
  - Burn Brightly follows on a neutral edge (`rd-conditional--spend`) under an **"Or spend it
    now"** label.
  - The trigger's "at home" was the last thing in a faint line and went unread, so Level Up now
    opens with **"Only at home, in a quiet stretch of time"** (house icon, accent, reading size).
    The book's trigger stays under it as fine print.
  - It's a reminder, not a lock (guide, don't enforce). It is gone once the level is taken and a
    move is owed, since that is the rest of a level-up that already happened.
  - Tests: `tests/development/railAdvancement.test.js`.
- **Not wired:** the Level Up button has a caret and `aria-expanded` and does nothing. The shipped
  `level-up-strip.hbs` opens its checklist (the Advance step among them) from the same button.

### Two pack typos the rail shows

- `packs/src/moves/special/deaths-door.json` is named **"Deaths Door"** — the book's is Death's Door.
- Strengthen Your Bond's trigger reads **"pay your followers cost"** — the book's is *follower's*.

Both are data. Check first whether they came out of the PDF extraction, in which case the fix is
the parser and a regeneration rather than an edit to the JSON.

### Two findings that are not this deck's to fix

- **The rail's shipped label is now wrong.** `languages/en.json` calls it *the moves rail*, and under
  D7 it carries the portrait, the vitals and advancement as well. Renaming the string is an i18n edit
  with a handoff cost, not a code change.
- **The deck's hover preview contradicts the design system.** §1 records that hover was considered
  and rejected as a density device, and that the disclosure is the answer the system reached. The
  rail turns the preview off; the moves tab still argues for it in a frame of its own. That argument
  has to be won against §1 or the frame has to go.

### The band's foot overran the conditions, and not only when narrow

Open, the roll-mode line sits beside the stats in the column it shares with the ailments. Spelled out
it needed **336px**, and it ran left over "miserable" whenever it had less: 258px at a 760px sheet
(rail shut), but also 258 at **1000px with the rail open** and 178 at 920. Anything under about
1080px with the rail open overlapped.

Fixed in two parts, measured in the deck:

- **"Adv · Normal · Disadv"**, with the line's gap and the options' gap both half a rem. The line is
  **239px** now and fits at 760 (rail shut) and at 1000 (rail open). The full words are still what a
  screen reader hears and what hovering shows. On the real sheet this is two new short strings,
  used only by the inline variant: the stat-pick dialog stacks its options and keeps the full words.
- **Where even that does not fit, the line goes under the whole band.** Measured (`fitBandFoot`)
  rather than a breakpoint, because the line's width is its translated words and its room depends on
  the rail. Full width because that is where the folded line sits: the band keeps one template in
  both states and the Stats toggle does not move sideways when folding. Costs **33px** of band at
  those widths; the ailments get the stats' whole height beside them, so none were clipped.

Tried and rejected: letting the line **wrap in place**. The second line came out of the ailments'
budget and the panel collapsed to "… 3 more".

### Ailments: always three rows, the rest counted on the bar

The region used to fit its rows to a measured budget, which was the stats column's height less the
foot's. The "… N more" line was a row inside that budget, so each ailment past the third pushed
another one out, and five ailments showed **one**. The bar's count stayed at the number it was
rendered with.

Now the first three always show, and the rest are **"+N more"**, a hanging tab on the bar beside the
`+`. Both open the editor. The bar has no count of its own. With three rows or more, the region is
96px with the count or without it, and the band stays at 190. Both the `+` and the count moved from
an absolutely placed button into the bar's action slot, so they hang like every other bar control.

### Instinct and appearance: one line each, cut to "…"

On a narrow sheet both lines wrapped, and the masthead grew taller with every wrapped line, taking the
band with it. Now each holds one line and ends in "…", and its tooltip carries the whole line: the
instinct's is "<instinct> — change it on <source>", and the appearance's is its words without markup
(`appearanceText`). The instinct's words are inside its button, which lays out as one box. So the cut
is on the button as a block, since an ellipsis on the line would have swapped the whole button for
"…". At the 760px preset both are cut, and the masthead is 45px and the band 190px, the same as wide.

### The rail and the tab body keep their scrollbar's track

Closing Basic and Expedition Moves ended the rail's overflow, and the rail's contents widened by the
11px the scrollbar had taken. Both `.rd-rail` and `.rd-tab-body` now carry `scrollbar-gutter:
stable`, the rule the shipped `.sheet-body` already has (`stonetop.css`). Measured with both groups
open (1604px of content in 718) and both closed (718 in 718): the rail's content is 229px wide and its
first row sits at the same x in both, in the wide window and in the 760px drawer.

### Opening and shutting slide, the way the band folds

A section's Change/Done, the Moves and Possessions lists' Change, and a rail group's caret used to
snap. They now slide over 0.4s ease, the fold's and the rail's duration, through `motion.js`'s
`slideHeight`: both ends in pixels, the start laid out before the end is set, the inline styles
cleared after. That is the fold's method, and for the fold's reason (easing to `auto` stuttered).

- A door redraws the sheet, so its panel's height is read before the redraw and the new panel,
  found again by its door, slides from there. The list's scroll is put back after the panel is
  pinned; restored before, it was clamped to the shorter page and the list jumped.
- A rail group, and a move row's text (rail and Moves tab), go through `slideOpen`: the body stays
  on the page while it shuts and takes `hidden` at the end, unless it was opened again meanwhile.
  A second press mid-way reverses from wherever the body has got to. Both carets turn over the same
  0.4s. The move caret's is a **departure** from the shipped 0.12s (`stonetop.css`), made because a
  caret that finished long before its text arrived read as two events.
- A box sliding to or from zero loses or gains its padding on the same curve. A move's text sits
  in 10px of padding, and without this it stopped there and snapped shut.
- Reduced motion: no slide. The shipped `!important` reduced-motion rule still wins over the caret.
- The gloss retires as the text arrives, by `hidden` and the same `slideOpen` in the other direction.
  It used to go on the first frame (`display: none` from a class), and the header dropped from 43px
  to 29px while the text was still sliding in. Sampled: 43→29px and back, never more than 1.3px a
  frame.

Sampled every frame in Chrome: Background opens 255→876px and back, Moves' Change 518→2558px and
back (closing from a scroll of 900 holds it until the page runs out), Basic Moves 507→0 then hidden,
and 0→512 again; Clash's text in the rail 0→332px and back, a Moves-tab row 0→51px and back. No
jump bigger than a frame's share anywhere, and no inline style left after.

## The Playbook tab and the inserts, rebuilt in this deck

D11 and D12. Checked against what `tab-playbook.hbs` and `tab-insert.hbs` render, so nothing below is
a silent drop.

**Carried over:** the playbook's blurb; background options with their own picks and **their track**
(the Destined's omens); the instinct's options and **the write-in box**; appearance as its pick-one
lines; origin as regions with **their names as buttons that name the character**; the lore groups;
the introductions, with only the answers once they are done; an insert's icon, description,
**Remove**, instinct and choices.

**Removed by decision (D11):** the Playbook tab's lock and each insert's. Every section has its own
door instead, and a route to a section opens it — the masthead's instinct lands on the instinct, and
the playbook's route opens appearance as well, since the level-up review asks about both.

**Moved by decision (D12):** an insert's moves, off the Moves tab and onto the insert's tab. Its tab
goes straight after Playbook, not after Notes.

**Not drawn:** the no-playbook state, which is the picker. Maelen always has a playbook, and D1 says
that state belongs to the Play surface. The shipped picker is a `<select>` of names, which hides what
each playbook is until one is chosen — the failure below, on the real sheet.

### Drawn in the shipped markup, after a first pass that was not

The first pass drew its own chrome and it was not a proposal, only a failure to check the partials:
bordered chips around bare radios for appearance and instinct, a framed 9-slice box round the
playbook's blurb and the insert's head, a list with a stray `li::before` mark per origin, and name
buttons that core's `button { display: flex }` stacked one per line — Stonetop's alone was 256px. It
also showed a background's own picks only for the background already chosen.

Now everything inside a section is the shipped markup: `choice-row.hbs` while choosing,
`choice-group-condensed.hbs` at rest — drawn from `condenseChoiceGroup` itself, imported rather than
copied — and `tab-playbook.hbs`, `instinct-section.hbs`, `introductions-section.hbs` and
`tab-insert.hbs` for their parts. What the deck still adds, each a proposal:

- **Each section as a panel with an ink bar** (pending P1), rather than the shipped heading and divider.
- **Each section's own door on its bar — Change, Choose, Done** (D11), rather than the tab's lock.
- **Group titles inside a section at the body's size**, not the shipped 18px (see D11).
- **An insert's moves on its tab** (D12), and **the insert's zero-hit-point move in the rail** (D9).
- **"Set aside while the Thrall's is in force"** under a superseded instinct, and **"No names of its
  own — borrow one from another list"** under Gordin's Delve.

Two things it took to reuse the shipped condenser: the loader now points `../` imports at the real
files, since a blob module can resolve neither a relative path nor a bare `/systems/…` one; and the
capture's rich text is rehydrated first (`text.js`), because JSON drops the RichText class and
`rich()` turns a plain `{ raw, html }` into the string "[object Object]".

### Two captures made for this

A Lightbearer made in the dev world, **"Lightbearer (deck sample)"** (`xzBIx7XVLjVMRT7N`). Choosing
the playbook granted Invocations; two were ticked on its tab. Then the Thrall was dropped on it through
the sheet's own `_onDropItem`. Captured as `lightbearer-arrived.json` at that moment, then its choices
were made through the sheet's controls and it was captured again as `lightbearer.json`: Fascination;
*The Mother of Worms, She Who Waits Under the Hill*; hide/bury; Duty; Carrion Stench; Death Mask; one
Favor. The deck borrows only the inserts, the way it borrows the Heavy's possessions.

### Measured

**Against the shipped locked screen, which should have been looked at first.** Maelen's real
Playbook tab at an 867px tab: **281px locked** — the whole tab on one screen, in two columns, with
unanswered sections hidden — and **2,490px unlocked**. This deck's first two passes were 857px and
1,770px at rest, and the cost was not where it looked:

- the button row under each section cost about 40px of a section's 100;
- the **single column** cost the rest: at the deck's 468px view it showed the background and the
  instinct, and nothing else;
- sections with nothing chosen stood open, and "1 of 6" read as five picks owed on a pick-one list.

Now, with the locked screen's two columns, the door on each bar and no counts: **the whole tab fits
the 468px view** at 1180, and at 760 it is 535px in two 350px columns — Collection and Introductions,
one bar each, just under the fold.

- **The Thrall's tab, settled: 1,196px** — the moves, then its sections in two columns in the pack's
  order. One column was 1,318.
- **The Thrall's tab on arrival: 4,471px**, everything open, and here the split by count costs: the
  three long ledgers — purpose, consequences, marks — all land in the right column. One column was
  4,012; alternating the columns measured 3,947 but reads the book's sections in a zigzag. Kept in the
  pack's order, since arrival is read once and the settled tab every session.
- **Choosing moves: 2,596px**, all 25 rows open, against 1,379 for the shipped tab's full list.
- **The tab strip holds one insert at 760px, not two.** The tabs shrink rather than overflow. With one
  insert every label stays inside its frame; with Invocations and a Thrall, "Invocations" is 93px of
  text in a 91px tab and "Possessions" and "Followers" touch their edges. At 1180 all nine fit. The
  strip's own fix, not this one's — a translation reaches the same point. **Proposed:** below 900px
  the tabs' padding goes from 18px a side to 0.6rem. All nine then fit at their natural widths (676px
  of tabs in a 758px strip), no label overflows, and 1180 is unchanged. 0.6rem is about the most
  that fits: at 0.75rem the nine need 767px and shrink into their labels again, and a longer
  translation will too.
- **A long instinct grows the band.** The Thrall's *Fascination — To explore your powers, your master,
  your new existence.* wraps the masthead to two lines at 1180 and three at 760: the band goes from 190
  to **207px**. This is the instinct-truncation item already in `TODO.md`, and an insert's instinct is
  its worst case.

### The bars wear into stone

Every ink bar — the sections', the rail's groups, the Moves list's, the Ailments — is solid under its
title and wears into a stone texture towards its right end: solid to 25% of the width, easing to 45%
ink by 70%. Two textures, both drawn for this (`assets/ui/decor/rock-texture-long.png`, heavier, and
`rock-texture-long-subtle.png`): 4096×64, black on transparent like the rest of the decor art, so the
ink follows the theme.

- **Never tiled.** The strips are made for one row; stacked, their flecks line up into columns, and
  repeated sideways a bar shows the same patch twice. Each bar shows one stretch, placed as a
  percentage along the image so its window can never run off the end — the texture at a bar's height
  is about 2,000px, and the widest bar is 904.
- **Alternated in drawing order**, so neighbours differ. Chosen from the title instead, four plain
  bars came out in a row on the Playbook tab. Each surface — the rail, the band, the tab — numbers its
  own bars: numbered across the whole sheet, switching tabs shifted the rail's by however many the tab
  had drawn, and its textures changed under the reader. The real sheet does the same, in the template,
  from where a section sits on its own surface.
- **Stamped, not framed.** The bar sits out over the panel's top and side rule by the rule's width,
  on the sheet's tan paper (`--st-paper`), so its worn end shows that paper through and no line runs
  round it — a rule round the wear made it read as a frame's rather than as an incomplete stamp.
- **Each bar's stretch and flips come from its title** (`BarGrain`), so a bar keeps its look across a
  redraw, and two bars on one texture show different patches turned different ways.
- The ink is a layer behind the words; a mask on the bar itself would clip them. A button on the worn
  end keeps solid ink behind it.

Both textures were exported black on opaque white and were converted here to black on transparent;
the originals were copied to the session's scratchpad only.

### The controls on a bar hang like cloth

With the stone behind them, the bar's buttons were hard to find — the Ailments + most of all, a
bare glyph in the display face, where it came out as an ornate squiggle. Every control on a bar (its
door or Done, a rail group's caret, the Ailments +) is now a tab hanging from the bar's top edge and
past its bottom: rounded below, a soft shadow, words centred, in a leather brown mixed from the
accent and the ink. The shape breaks the bar's outline, so no texture hides it, and the colour is
neither the ink nor the accent, which the design system keeps for the active state. The + is an
icon now. Titles and icons on the bar carry a halo of its ink, so they stay legible where the stone
reaches them.

### What the insert packs cannot say yet

- **Which moves are made instead of Death's Door.** Tethered, Undying and Dark Succor each answer zero
  hit points, and nothing marks them. Stand-in: `MOVE_REPLACES`. The fix is a `replaces` field on the
  three pack files.
- **Who a Terrible Purpose is about.** Each opens *Name the person or persons…* and has a box but no
  blank. Stand-in: `TERRIBLE_PURPOSE_INPUTS`. The fix is an inline input on the three entries in each of
  `ghost.json`, `revenant.json` and `thrall.json` — the Thrall's master already has that shape.
- **What a Ghost is tethered to.** *Choose something to which you are bound* is prose on the move, with
  nowhere to record the answer. No stand-in: no capture holds a Ghost.
- **Which consequence needs which.** *Unstable (Requires Breakdown)* and *Insatiable (Requires Strange
  Appetites)* say so only in their text; the track's `requires` is null. The words are on screen, so
  nothing is lost, but nothing can mark it either.

### The shipped blank was two lines tall, not one — fixed

`choice-row.hbs` says its inline blank is *single-line to start, but grows downward as the answer
wraps*, and gives it `rows="1"` and `.stonetop-grow-field`. Measured on Maelen's real sheet it was
**60px**: core's `textarea { min-height: 60px }` (`foundry2.css`, layer `elements.forms`), which
`field-sizing` can only grow from. Fixed in `styles/stonetop.css` the way the steading's fields and
`.stonetop-editable__edit` already were — `.stonetop-choice-input--inline { min-height: 0 }` — with a
render test (`tests/styles/choice-blank-render.test.js`). A blank is **28px** now and grows with its
answer; the Seeker's Collection, open, went from 981px to **709**. The deck loads the system's
stylesheet, so it has the fix without a copy of its own.

### Urges and Dark Succor are glossed "on a 7–9"

Two bugs, one symptom, and neither is this deck's to fix:

- **The packs don't emphasise these triggers.** *When the GM compels you to act on your impulse* and
  *when you are dying or killed outright* are plain text, where the book prints them bold italic, so
  `MoveGloss` has no trigger to lift.
- **`MoveGloss` misses a tier written with an en dash.** Its guard is `/^on a \d+\s*[-+]/`, which
  catches *on a 7-9* and *on a 10+* but not *on a 7–9*. The post-death moves use the en dash, so the
  first emphasised run it accepts is a result tier — exactly what the guard is there to stop.
  **Fixed** in `MoveGloss.js` (the en dash is in the guard), with a test. The packs now emphasise
  both triggers as well. The deck's captures still carry "on a 7–9" as their gloss, since a capture
  records the gloss it was made with, so the deck shows the fix only after a fresh capture.

---

## For the creation feature doc, when it is written

**An origin region may offer no names of its own, and that is correct.** Gordin's Delve is listed by
seven of the nine playbooks and carries no names in any of them, where every other region carries
eight to ten. That is the rules, not a gap — a character picks a region and then a name to match,
borrowing from another list or inventing one. So an empty name list is a normal state and must not
be presented as an error or a failure to load.

---

## For the creation and inserts feature docs, when they are written

**Instinct is one value, always.** Within a group, a picked option and a written-in instinct are
mutually exclusive — choosing one clears the other. Across the sheet, an insert's instinct replaces
the playbook's, and three of the four inserts carry one (Ghost, Revenant, Thrall; Invocations does
not). What is displayed is a computed label: an option's name together with its description, or the
text that was written in.

**Levelling ends by revisiting instinct and appearance.** Neither is set once. The prompt for it is
part of the level-up procedure and is deliberately not tickable, because a review that changed
nothing is still a review done.

---

## Mock issues, not real bugs

- **The starting-stat chips have no data behind them.** This mock parses digits out of `statsNote` to
  show which of the offered scores are still unassigned. `statsNote` is a translated `StringField`
  (`PlaybookData.js:20`) — a sentence for a person, rendered as the note beside the stats heading
  (`character.hbs:87`) — and nothing in the system parses it, correctly. The parse here breaks the
  moment the sentence is translated, and it exists only to feed an affordance this mock invented.

  Not a defect in the system. If that affordance is ever wanted, the fix is a structured
  `startingStats` array added *alongside* the prose — schema, packs, snapshot, migration — never a
  parse. But it is worth asking whether it should exist at all: tracking which scores are still
  unplaced implies the array is binding, and it is not. The table can approve alternatives to any
  creation choice, and the Would-Be Hero deliberately starts with a worse array
  (`+1, +0, +0, +0, +0, -1`) offset by a move. A helper that polices the numbers enforces where the
  rules guide.

- **Well Versed's topics are a stand-in (`standIns.js`).** The seven topics are only bullets in the
  move's description, so nothing records which a Seeker has marked. The deck draws them from a choice
  group in the shape `buildChoiceGroup` produces — the book's words, moved out of the description
  into `choices`, one one-box entry per topic, the way Potential for Greatness already carries its
  list. Maelen's only mark is the one her Antiquarian background names; her second is hers to choose
  and the capture does not say, so it is left blank.

  The real fix is data: `packs/src/moves/playbook/the-seeker/well-versed.json` gains that `choices`
  group and loses the bullets, then a fresh capture — and this file goes. Veteran Crew, Heroes to the
  Last and Beast of Legend ("each time you take this move, pick 1") are the same shape. Work With
  What You've Got's "pick 2" is not: it is chosen per roll and stored nowhere, so it stays prose.

- **The expedition phases are a stand-in (`standIns.js`, `EXPEDITION_PHASES`).** Nothing in
  `packs/src/moves/expedition/` says which part of the journey a move is for, so the deck maps the
  ten slugs itself and stamps the phase onto each move in the capture. The real fix is a `phase`
  field on those ten pack files and on the move model; `MoveView#phase` already reads it from there,
  so a fresh capture retires the map. A move with no phase still renders, after the three phases and
  under no heading.

---

- **The two insert stand-ins (`MOVE_REPLACES`, `TERRIBLE_PURPOSE_INPUTS`)** are stamped onto the
  Lightbearer captures as they load; see above. A fresh capture after the pack fixes retires both.

- **The capture drops any object it has already written.** The replacer's `WeakSet` is there to stop
  cycles, but it also skips a second reference to the same object — so every choice group's
  `condensed` lines lost their text, which is the same RichText as the row's. The deck reads the rows
  instead and does not need `condensed`. A capture that guards only its ancestors would keep both.

- **The instinct label is mirrored, not called.** Picking an instinct in the deck has to move the
  masthead, and the label comes from `InstinctController.computeSelected`, which the deck cannot run.
  `instinctLabelOf` in `sections.js` produces the same string, and says so.

## How to work on this

Both previous decks hand-drew regions that already existed and silently dropped what was in them.
The ✗ flags in §3 are the record. The cause was the same both times: **designing against the data
model instead of against the shipped sheet** — the pack JSON got read closely and
`templates/actor/partials/` barely got opened.

1. **Don't hand-draw what exists.** `scripts/development/render-surface.mjs` renders the real
   partials under the real stylesheets. Unchanged regions get rendered, not redrawn.
2. **Check §3 before and after.** If a feature isn't in the new version, that must be a decision,
   not an accident.
3. **Read the comments.** This codebase documents its decisions next to the code, and most of the
   mistakes so far were reversing a decision whose reasoning was on the same screen.
4. **The root class list is load-bearing.** 78 rule blocks are scoped `.stonetop.sheet.character`;
   a mockup root missing `sheet character` inherits almost none of the stylesheet.
5. **Cache-bust the deck's own CSS and JS** when reloading, or edits silently never load.


---

## Raw material — the shipped sheet, feature by feature

**To be consumed.** Two of these have become feature docs (outfitting, playbook moves). The rest are
raw notes for writing the remaining nine. Delete each section as it is written up properly.

Everything the character sheet does today, by region. The devices these are drawn with are
audited in `docs/design-system.md` §2. **Lost before** flags a feature one of the two previous
decks silently dropped — empirically, these are what goes missing.

### Band — `actor-header.hbs`, `actor-stats.hbs`, `debility-bands.hbs`, `actor-attributes.hbs`, `folded-ledger.hbs`

| feature | detail | lost before |
|---|---|---|
| Playbook crest | capped to the name's line box so the image doesn't set the band's height | ✗ deck 2 |
| Character name | editable | |
| Stat tile × 6 | abbreviation **is** the roll button and must BE a `<button>` — core binds only `click`, so a `<span>` is keyboard-dead | |
| Stat value | editable `number`, min −3 max 3, `name="system.stats.<key>.value"` | ✗ deck 2 |
| `statsNote` | per-playbook, hangs off the Stats heading — deleting the heading deletes the sentence | ✗ deck 2 |
| Debility × 3 | bracket spanning the stat pair it hinders, tick in the gap, name below | ✗ deck 2 |
| Debility effect | shown **once**, on the active one, in the folded masthead; the other two deliberately show name only | |
| HP | current + max steppers, provenance as a visually-hidden sentence via `aria-describedby` | ✗ deck 2 |
| Armor | stepper, same provenance pattern | ✗ deck 2 |
| Damage | **the label is the roll control**; the value is text, not a number — a damage die is "d6" | ✗ deck 2 |
| Roll mode | rendered once for the whole sheet; lives in the band's foot so it never moves between densities | |
| Fold toggle | band ⇄ one ledger line; both always in the markup, so folding reveals rather than moves | ✗ deck 2 |
| Folded ledger | same numbers at one density; a hindered stat goes `--st-danger` **and** names the debility in the DOM | |

### Rail — `character.hbs`, `advancement.hbs`, `level-up-strip.hbs`, `move-group.hbs`

| feature | detail | lost before |
|---|---|---|
| Rail toggle | `data-action="toggleRail"`, `aria-controls`, show/hide labels | ✗ deck 2 |
| Collapse behaviour | inline it is `display: none`; below 900px it is a drawer that already slides | |
| XP | stepper, `is-full` at the threshold, "ready to level" note; max derives from level | |
| Level | stepper | |
| Level Up strip | renders **nothing** unless triggered or owing; collapsed by default; open state is a sheet view flag, not actor data; ready badge vs owed count; the move's own trigger as a gloss | ✗ deck 2 |
| Four move groups | basic, expedition, special, follower — every `renderStyle: "side-bar"` category | |
| Rail rows | `disclosure=true` + `unacquirable=true` — no tick, because a character *has* the basic moves | |

### Move row — `move-item.hbs` (shared by the moves tab, arcana cards and the steading rail)

| feature | detail | lost before |
|---|---|---|
| Acquisition check | single checkbox | |
| **Repeat checks** | `selection.max > 1` renders N boxes with per-pip aria — **already built**, via `repeatChecks` | |
| Disclosure variant | name becomes a button opening the text in flow; while shut the row shows the gloss. *"Six moves printed in full is 1400px of a column; six rows is a list you can read."* | |
| Name as button | opens the move's own item sheet (plain) or toggles the body (disclosure). The button is the **name alone** so its accessible name stays "Bolster", not the whole trigger | |
| Nameless moves | a move the book prints unnamed draws no name; the controls float onto the move's own first line rather than standing on an empty label line | |
| Roll die | any move that rolls shows its die whether ticked or not; styled as the steading's rating die so both dice mean one thing; carries `data-move-slug` so an unowned move still rolls | ✗ deck 2 (became a table column) |
| Chat button | `moveToChat` | |
| Resource track | pips + optional `resource-input` | ✗ deck 2 (became `0/2`) |
| Source label | e.g. an arcanum move's "Requires: Battery"; never on a disclosure row | |
| Requirement line | with met / not-met state | |
| Roll notes | third line, always present, saying what **can** be applied and naming the source. Never collapsed: naming the source is only possible one at a time | ✗ both |
| Delete | on `allowAdditional` categories only | |
| Choice rows | a move can carry a choice group | |

### Moves tab — `tab-moves.hbs`

Lock toggle (`hideUnselectedMoves`) which hides unselected rows **via a CSS class, with no
re-render** · one `move-group` per `renderStyle: "standard"` category · `allowAdditional` for GM
grants.

### Possessions — `tab-possessions.hbs`

Pick-count note · checkbox per item (`disabled` when the playbook grants it) · `preselectedSource`
caption · **resource pips** via `resource-track` · delete on `removable` · description · nested
choice rows. Renders nothing at all when there are no possessions.

### Outfit — `tab-equipment.hbs`

The richest tab, and the one deck 1 flattened worst. The book's figure art from the gitignored store
(silently absent if not installed, via `HideBrokenImages.js`) · a **reset** button · three load
radios each with an inline marked count and an **over-capacity warning** · the steading's
**Prosperity panel** with its `lacking` state · two **undefined-supply pools** (regular ◇ / small ▢,
grouped by `poolGroups`) separate from the itemised list · **two semantic columns** driven by
`inventoryColumn`, not flowed · the ◇ that is simultaneously the weight and the checkbox · per-column
add button · an **Other items** textarea.

### Arcana — `tab-arcana.hbs`

Two advice buttons · empty message · minor grid always · major grid only `{{#if major.hasOwned}}` ·
per-card unlock tracks drawn by the same `choice-row` the playbook uses.

### Followers — `tab-followers.hbs`, `follower-card.hbs`

Advice button · empty message · **Add follower** button · cards branching four ways —
companion / group / object / person. Companion gets a type combobox, option chips and a "pick N
more" counter; group gets a members list with per-member HP and **no card-level HP**; object gets
instinct only. Plus tags, armor, damage, special quality, instinct, cost, moves, loyalty pips,
choices and gear. **Deck 1 drew none of the branches.**

### Notes — `tab-notes.hbs`

Two `<prose-mirror>` editors with `.stonetop-grow-editor`, saved through the ChangeActionRouter
rather than the form-submit path.

### Shared engines — the four partials everything else is made of

**`choice-row.hbs`** (172 lines) draws a playbook's picks, an arcanum's unlock track, a background's
options, a possession's nested choices, a move's choices and an insert's sections. Branches on
`type` (`entry` / pick), and within `entry` on whether there is a `track`, a `subtitle`, a `title`,
an `input`, an inline `followers` or `moves` grant, and `indent`. Inputs come in `rich` and plain.
Radios scope by `namePrefix`-`rowKey`; picks carry `siblingSlugsCsv`. **Twelve distinct row shapes
across 291 rows in the packs** — the first study enumerated them and found only three drawn.

**`resource-track.hbs`** — a row of pip buttons with per-pip `aria-pressed` and
`aria-label` naming position and total. Used by moves, possessions, backgrounds, arcana, followers
and the steading. Optional `resource-input` beside it.

**`outfit-items.hbs`** — one inventory column. A section knows the prose printed under it; a **run**
knows whether it is set two-across (`isGrid`), because the printed inventory page says both —
nothing re-derives either from the rows. Dividers between sections. Optional add button per column.
Item checkboxes carry `data-slug`; the follower path is distinguished only by the enclosing
`.stonetop-follower-inventory[data-slug]` wrapper, so handlers branch without per-element attributes.

**`roll-mode-picker.hbs`** — one control, three surfaces (character masthead, steading ledger,
stat-pick dialog). `variant` picks arrangement only — `inline` or `stacked` — because the difference
was a layout one and is answered with a class rather than a second template. A `<fieldset>` with a
legend, clipped but never removed on the inline variant.

### Folded ledger — `folded-ledger.hbs`

The band's collapsed density, always in the markup so folding **reveals** rather than moves. Plain
readouts, not tiles — *"at line height there is no size at which the woodcut frame is a frame rather
than a smudge"*. Two deliberate exceptions, both argued from what the fold is for: **every stat and
the damage die roll from here**, and **HP can be stepped here** — *"folding to get at your moves and
then unfolding to spend a hit point is the fold costing you the thing it was for."* Provenance rides
along clipped. A hindered stat is `--st-danger` **and** names its debility in a screen-reader span.
XP and Level are deliberately **not** here — they live in the rail, so putting the rail away puts
them away.

> Worth noting on chrome height: the folded line already carries everything **play** needs — six rollable
> stats, steppable HP, armor, damage. That is an argument for folded being the default, not for
> inventing a new compact band.

### Masthead — `actor-header.hbs`

Playbook crest or actor image fallback · editable name · playbook title · **the three debilities
repeated here** as circles with names, revealed when the band is folded; the active one shows
`{{summary}}` — the first sentence only, *"what the debility is, not which rolls it hinders"*.

### Arcana card — `arcanum-cards.hbs`

Decorative chain frame (three boxes so the repeating runs stop at corners) · optional image ·
**front / back are separate `ArcanumSideSnapshot`s rendered by one inline partial**, picked by
`flipped` · header carries title, an optional embedded `outfit-item-row`, tags, and a resource track
· body is entirely choice groups drawn by `choice-row` · flip control.

### Follower inventory — `follower-inventory.hbs`

Parity with the character's Outfit via the same `outfit-items` partial · a **load band** (light /
normal / heavy) with the carried ◇ count and an over-capacity flag — *"computed + highlighted but
never a cap; a follower past the ◇ Outfit allows is flagged, not stopped"* · compact view shows what
they have, the full catalogue with "+ add" only when expanded.

### Data-model note

`stonetop.statPairs` already groups the six stats into their three debility pairs, with the debility
attached — the folded ledger reads `../debility.active` and `../debility.name` straight off it. The
stat↔debility relationship is in the snapshot, not only in the layout.

### Cross-cutting

Narrow (<900px) the rail becomes a sliding drawer — **verified working** · dark theme has a full
token set in `parchment-dark.css` including `--st-paper-blend: multiply`, but is **unverified in a
real session** (setting `colorScheme.applications = "dark"` and re-rendering left the sheet on
`theme-light`; `stonetop.css:319` says the bases no longer pin it) · the steading (`steading.hbs`) shares
`.stonetop-rail-layout` (side-agnostic via `data-side`), `.stonetop-rail-toggle`, `move-group`,
`roll-mode-picker`, `advice-button`, `resource-track`, `choice-row` and the panel art, and its rail
carries `data-density="full"` — a density axis the character rail doesn't use. **Anything changed in
those changes both sheets.**

---


---

## Superseded

The workflow traces and the R1-R21 requirement list from the old brief have been dropped: the
invariants they were reaching for now live in the feature docs, and the rest were proposals rather
than requirements.
