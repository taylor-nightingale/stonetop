* Implement special moves
* Support for followers (follower moves)
* support for steading (homefront moves)
* Short for “experience points.” You start
  with no XP. You mark XP…
  ...		 when you roll for a move and get a 6-
  (unless the move says otherwise);
  ...		 as part of the End of Session move
  (page 232); and
  ...		 when another move says so.
  “Mark XP” means that you make a tick
  mark in the XP box on your playbook,
  increasing your total XP by 1.
* Add prosperity to inventory tab
* Update all of our compendium items to include the json structure for adding outfit items
* lore entry and choice should be the same data model.
* other inventory section is missing
* dark succor move should be rollable (support jsonpath to another item on the character move.post-death.favor)
* tethered arcana needs format fixes
* localize steading defaults
* ● Here's the full picture:

  What rollType does today: StonetopItem.roll() reads rollType as a stat key and looks up actor.system.stats[rollType].value. Every non-null rollType in the packs is one of the 6 stats (str, dex, con, int, wis, cha). Dark Succor currently has rollType: null — it renders description-only and never actually rolls.

  ---
  On the name: rollType is confusing — it sounds like the KIND of roll (advantage/disadvantage), not WHAT you add. The DW vocabulary is "roll +STR", so rollWith or rollStat would be more accurate. That said, it's deeply embedded in 20+ files. Worth renaming eventually, but it's a separate pass.

  ---
  On the three roll cases you need:

  ┌────────────────────┬──────────────────────────┬─────────────────────────────────────────────────────────────────────────────┐
  │        Case        │         Example          │                            Where the value lives                            │
  ├────────────────────┼──────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
  │ Stat roll          │ +STR, +CHA               │ actor.system.stats[key].value — already works                               │
  ├────────────────────┼──────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
  │ Steading attribute │ +Prosperity, +Population │ actor.system.attributes[key] — steading actor                               │
  ├────────────────────┼──────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
  │ Resource roll      │ +Favor                   │ Tracked resource on the character, probably a flag or insert-computed value │
  └────────────────────┴──────────────────────────┴─────────────────────────────────────────────────────────────────────────────┘

  The current roll() implementation only handles case 1. Cases 2 and 3 need the lookup to be extended. For case 2, it's straightforward — check actor.system.attributes[key] as a fallback. For case 3 (Favor), it needs its own lookup since Favor isn't a standard field.

  One option that avoids a schema change: make rollType support a namespace prefix — "stat:str", "attr:prosperity", "resource:favor" — and route accordingly in roll(). The existing "str" values would need to either be migrated to "stat:str" or the roll function treats bare values as stats.

  ---
  Does Chunk D break any of this?

  No. Chunk D flattens attributes.level, attributes.armor, normalizes attributes.damage, and removes attributes.maxHp. None of those fields participate in rolling. The roll system reads stats.*, not attributes.*. Chunk D is safe to proceed as planned.

  ---
  My recommendation: Proceed with Chunk D as-is. Design the extended roll system (rollWith rename + multi-source lookup) as a separate piece — it's genuinely its own feature, not a schema migration cleanup.


== Nice to have
* toggle to turn off non-selected character options
* add descriptions to debilities for hover over (p 53)
* add descriptions to stats for hover over (p 53)
* Add a bar between arcana outfit items and the others so they are more clearly visible
