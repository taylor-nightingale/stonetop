* add steading move automations for debilities
* localize steading defaults
* Update steading default icon to something nicer
* Fix parsing of artifacts in Book II (outfit items aren't parsed well)
* Art uploader should grab the maps as well (and give a good way for the GM to set them as a background image in foundry)
* support carolingian ui module (inventory/move checkboxes dissapear)
* let the GM define what the basic moves list entails, perhaps _all_ default move lists (playbook, special, steading, etc.)


* level up move
* compendium folders have styling (light mode) of light text on light background
* add a stonetop image to the game system in foundry like the delta green one has
* After updating a system, foundry won't force reload the page even after shutting down the server and restarting. The character sheets will not open because a partial couldn't be found. How can i fix this?

* lore section on playbook has questions split from their input boxes on certain screen widths
* feature: the would be hero's "a shield bearing ___'s crest" should allow you to input text in ___
* feature: ranger special possession Hounds should add a group follower (3), also for would be hero
* feature: the move that modifies shield carrying capacity doesn't do anything for the heavy
* bug: the bio/notes sections have the save button, etc but the bar is not tall enough to accommodate them and they're hard to click
* bug: see img_2 the check boxes get split sometimes
* allow copy paste of names and text for names/neighbors
* bug: remove generic on hover change text to the exact color of the background. damage has it too. All of our on hover clickables should be the same formatting
* bug: migration for existing character backgrounds did not apply the destined background for would be hero had a now fixed bug where selecting protect also selected restore
* bug: sheet editing moves doesn't allow you to resize the prosmirror box and it slightly cuts off the bottom row
* 124 wrap-hyphens in wider-world-npcs (w/advan- tage, attach- ment, funda- mental). fixing the corpus resolves most of the ambiguous compounds.
* bug: stonetop moves are still matched by name. This won't work for translations. They must be matched by slug or id.


== 1
the open move/send to chat buttons are a new pattern. previously we had the little chat bubble do that. Why not do that here too?
hovering over the fortunes icon/surplus icon makes an orange outline. remove that
Clicking on a homefont move puts the text centered. Just keep the name where it was
Level up is not a homefront move.
overall the formatting of the entire thing is all over the place. font sizes vary wildly. They aren't big enough to read in many places. The titles are smaller than whats below it. The hard ink splotched bars are jaring when there are other small thin bars. The weight of the page is a bit off in play more stuff to the right. The stonetop name should be bigger. The icons in the left corner dominate the view and make everything else feel tiny

== 2
the roll icon on a move has no indication its clickable (unlike dice icon on prosperity which looks nice)
debilities rearrange themselves when selected. its jarring.
in the mockup the move names had the rollable dice next to them and then had the description text in a different color. The mockup used different colored text in many places to indicate what we should focus on. We're missing that completely in our current sheet. I really like how it changed the color of the bold/italic parts of a move that indicate what you have to do "prepare for what's coming or seek the favor of the gods" for example.
the -> +1 lacking/legendary should be inline not on the next line.
the drop down when selecting city is white background on light text in dark mode, it should have same formatting as name selection drop down
updating the sheet closes your move when you were reading it. I don't want opening a move to apply to other sheets looking at it, but their updates shouldn't blow away my state.
perhaps it would be nice to show the text for the moves as one line below each name to give more space for the roll/chat buttons and resource?
Bolster doesn't have its nice formatting anymore with newlines and bullet points
up/down arros arent aligned properly on pop, prosperity, defense, etc. the one on the left side is farther out

== 3
surplus number is higher than fortunes. They aren't aligned
resources aren't aligned with the name of the move when collapsed.
remove the - in front of the text for the move in collapsed form
move bubbles and dice buttons should be centered on the text, not aligned with the bottom. same for rollable attributes. the top attributes should also have a dice to indicate they're rollable
hovering over a number on the top rail pushes the sheet down a bit. The appearance of the arrows shouldn't push the sheet down
The debilities should still say what they do when checked.
selecting and changing village, selects the fortunes entry box
assets, fortifications, resources should wrap lines when text is too long


== 4
don't make the debility explaination text red
increase fortunes/surplus to fit the space better.
Put image 35054ea8d15b39521589bc2cab68c9f309301fe645948ac9fd0ed37d920da6c7.png underneath resources
remove the spacing for the invisible arrows next to attribute numbers on the rail. Only display them on hover. Note that I don't want them pushing the whole sheet down, jittering it like it did before.
https://claude.ai/code/artifact/5fc618a6-48a9-499f-bc15-898bb2d7de31?org=858ceef1-6adb-4895-96a2-f91e805989b5
https://claude.ai/code/artifact/20d7ad9d-1c01-453e-83c9-3090b5e1d56f?org=858ceef1-6adb-4895-96a2-f91e805989b5
