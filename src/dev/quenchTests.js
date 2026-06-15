// Integration tests that run INSIDE Foundry (via the Quench module), against real Actor/Item
// documents and the real NpcItemData data model — so they exercise Foundry's actual update +
// re-prepare cycle, which the node fakes can't replicate. Install the "Quench" module, open a
// world using this system, reload, then run: quench.runBatches("stonetop.group-followers")
//
// Regression guard for the follower tag-wipe class of bug: Foundry re-runs `migrateData` on the
// partial {changed-keys} diff of every update, so a migration that default-injects an absent
// field clobbers the stored value on every edit. These tests assert a follower keeps its global
// `tagList` across armor edits and member add/remove. See migrate-data-runs-on-update-diff.md.

import { CharacterFollowers } from "../actors/character/CharacterFollowers.js";

globalThis.Hooks?.on?.("quenchReady", (quench) => {
	quench.registerBatch(
		"stonetop.group-followers",
		(context) => {
			const { describe, it, assert, afterEach } = context;

			describe("Group follower — what wipes the follower's tagList?", function () {
				let actor;
				afterEach(async () => { await actor?.delete(); actor = null; });

				async function makeFollower() {
					actor = await Actor.create({ name: "QTest", type: "character" });
					const [item] = await actor.createEmbeddedDocuments("Item", [{
						name: "Crew", type: "npc",
						system: {
							slug: "crew",
							tagList: { selected: ["group"], options: ["group", "brave"], multi: true, allowCustom: true },
							hp: { value: 6, max: 6 },
							armor: "2",
							members: [{ name: "Aedith", hp: { value: 6, max: 6 } }],
						},
					}]);
					return item;
				}

				async function applyUpdate(item, sys) {
					await actor.updateEmbeddedDocuments("Item", [{ _id: item.id, system: sys }]);
					return actor.items.get(item.id).system.tagList?.selected;
				}

				it("baseline — tagList present right after create", async () => {
					const item = await makeFollower();
					assert.deepEqual(item.system.tagList.selected, ["group"]);
				});

				it("A) updating ARMOR only keeps tagList", async () => {
					const item = await makeFollower();
					assert.deepEqual(await applyUpdate(item, { armor: "5" }), ["group"]);
				});

				it("B) updating MEMBERS with plain {name,hp} keeps tagList", async () => {
					const item = await makeFollower();
					const members = [{ name: "Aedith", hp: { value: 6, max: 6 } }, { name: "", hp: { value: 6, max: 6 } }];
					assert.deepEqual(await applyUpdate(item, { members }), ["group"]);
				});

				it("C) updating MEMBERS that carry a `tags` key keeps tagList", async () => {
					const item = await makeFollower();
					const members = [
						{ name: "Aedith", hp: { value: 6, max: 6 }, tags: { selected: [], options: [], multi: true, allowCustom: true } },
						{ name: "", hp: { value: 6, max: 6 }, tags: { selected: [], options: [], multi: true, allowCustom: true } },
					];
					assert.deepEqual(await applyUpdate(item, { members }), ["group"]);
				});

				it("D) CharacterFollowers.addMember keeps tagList (real controller path)", async () => {
					const item = await makeFollower();
					await new CharacterFollowers(actor, null, null, null).addMember("crew");
					assert.deepEqual(actor.items.get(item.id).system.tagList.selected, ["group"]);
				});

				it("E) CharacterFollowers.setMemberHp keeps tagList", async () => {
					const item = await makeFollower();
					await new CharacterFollowers(actor, null, null, null).setMemberHp("crew", 0, 3);
					assert.deepEqual(actor.items.get(item.id).system.tagList.selected, ["group"]);
				});

				// THE REAL FLOW: a real character, add the Crew through our controller + the live
				// follower repository (compendium), then update it through our controller — exactly
				// what the sheet does. This exercises addFollower → _followerToSystemFields → embed,
				// then setFollowerArmor / addFollowerMember.
				it("REAL FLOW — add Crew via our code, then update via our code, group tag survives", async () => {
					actor = await Actor.create({ name: "Real Marshal", type: "character" });
					const tc = actor.typedActor; // StonetopCharacter with the real FoundryFollowerRepository
					await tc._followers.addFollower("crew");
					const findCrew = () => actor.items.find(i => i.type === "npc" && i.system?.slug === "crew");

					assert.ok(findCrew(), "crew embedded");
					assert.deepEqual(findCrew().system.tagList.selected, ["group"], "crew has the group tag right after add");

					await tc.setFollowerArmor("crew", "5");
					assert.deepEqual(findCrew().system.tagList.selected, ["group"], "group tag survives setFollowerArmor");

					await tc.addFollowerMember("crew");
					assert.deepEqual(findCrew().system.tagList.selected, ["group"], "group tag survives addFollowerMember");
				});

			});
		},
		{ displayName: "Stonetop: Group Followers" },
	);
});
