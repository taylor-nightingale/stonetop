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
* add steading move automations for debilities
* dark succor move should be rollable (support jsonpath to another item on the character move.post-death.favor)
* localize steading defaults
* Figure out how to add items from pick rows.
* support editing/displaying and adding compendium items
  * outfitItems
  * playbooks
* Thrall extra rollable stat — move pack data for Thrall's loyalty move should declare extraStats: [{ key: "loyalty",  }]; CharacterRolling.resolveBonus("loyalty") needs a path to the custom stat on the actor system
* moveResults data — many moves don't yet have moveResults populated in pack data
* Add button to create or break a link to an NPC to residents and neighbors.
* Add artifacts on p41 b2
* Ring of daagon's parsing is messed up. The front side of the ring has a follower -- The Ring that isn't parsed correctly. title "The Ring", tags "deep-wise, greedy, patient, knowledgeable, magical" Cost "devouring fallen, named creatures", Instinct "to give nothing (not even secrets or info) away" Moves "Speak mind-to-mind" "reveal a secret, for a price" "know someone's desires" It has no hp, armor, damage or inventory.
Ring of daagon's, rune-laden scale consequences have tabbed in check boxes to show that you need to check the outer one before you can check the inner on. We don't handle this tabbing in on choices right now. Perhaps we just add a flag to the choice to tab it in. We dont need to add automation around the checking.
* Mantel wraiths group has group (3) tag but isn't parsing as a group follower. it should be a group of 3.
* Convert bio and notes section in notes tab to use prosemirror
* Halix and Astor (Mysteries of the Blackwood fetishes) and the Mighty Servant (Mysteries of the Mindgem) don't have their icons parsed.
* Update steading default icon to something nicer
* Update create item/actor names to be capitalized
* Fix parsing of artifacts in Book II (outfit items aren't parsed well)
* Art uploader should grab the maps as well (and give a good way for the GM to set them as a background image in foundry)
* Extend steading improvement parsing to parse the diamonds as well -- golden sapling for example

== Nice to have
* toggle to turn off non-selected character options
* add descriptions to debilities for hover over (p 53)
* add descriptions to stats for hover over (p 53)
* Add hover over tool tip for armor, hp, and damage to show where the calculations came from
* support non-stonetop steading sheets

