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
* Figure out how to add items from pick rows.
* getting the rules text and roll results showing in the roll chat.
* displaying info in the compendium
* support editing and adding compendium items
* bullet points everywhere should use our icon just like in the steading sheet.
* add playbook dropdown
* selecting moves flickers the check box before selecting
* steading sheet UI — steading sheet needs roll trigger elements wired to _onRoll; the infrastructure exists after this plan but the sheet has no buttons yet
* Thrall extra rollable stat — move pack data for Thrall's loyalty move should declare extraStats: [{ key: "loyalty", name: "Loyalty to the Eldritch God" }]; CharacterRolling.resolveBonus("loyalty") needs a path to the custom stat on the actor system
* moveResults data — many moves don't yet have moveResults populated in pack data
* modal popup for rolling needs better formatting and a button for adv/dis/normal

== Nice to have
* toggle to turn off non-selected character options
* add descriptions to debilities for hover over (p 53)
* add descriptions to stats for hover over (p 53)
* Add hover over tool tip for armor, hp, and damage to show where the calculations came from

=== Bugs
* Debility checks in the character sheet have a bug.
  * unchecking a debility stat unchecks all debilities
  checking a debility for the first time flickers it, checking it for the second time actually selects it.




