CompendiumCollection
{
"66InktII1QKAPInQ": StonetopItem,
...
}

StonetopItem
{
"flags": {
"stonetop": {
...
}
},
"img": "images/stonetop.png",
"name": "Stonetop",
"sort": 0,
"system": PlaybookData,
"type": "playbook"
}

StonetopActor
{
flags: {},
name: "char name",
system: CharacterData, // https://github.com/asacolips-projects/pbta/blob/b062c0ab870fa89ab7e1cc67355de763478e93ee/src/module/data/actor/character.js#L4

}

https://github.com/asacolips-projects/pbta/blob/b062c0ab870fa89ab7e1cc67355de763478e93ee/src/module/data/item/playbook.js
PlaybookData
{
"actorType":"character",
"attributes":{},
"choiceSets":[],
"description":"Imagine yourself and your kin in a cave lit by a single torch, entranced by shadow puppet stories. Imagine realizing there is a greater truth, and stepping out of the cave into the true Light of day. Would you not bring that Light back into the darkness, to set your people free?",
"slug":"the-lightbearer",
"stats":{},
"statsDetail":""
}

PbtaItemData (name? it is stored in system)
{
actorType: "",
choices: "",
description: "",
moveResults: "",
moveType: "basic",
rollFormula: "",
rollMod: 0,
rollType: "",
uses: 0
}

_onCreateDescendantDocuments
documents = StonetopItem[]
parent = StonetopActor
collection = "items"
data = [StonetopItem (but untyped)]
options = {
keepId: true,
modifiedTime: 1778700701525,
originalUuid: "Compendium.stonetop.playbooks.Item.msKRM8oHy6qghCF9",
parent: StonetopActor,
render: true,
renderSheet: false,
}
userId = "aDYTvg5hu4PMGD5D"

// global
game
{
actors: {key => StonetopActor},
il8n: Localization,
packs: {
"stonetop.playbooks" => CompendiumCollection
},
settings: {
settings: {
"stonetop.debugMode": {
config: true,
default: false,
key: "debugMode",
hint: "hint",
name: "name"
}
}
}
}


getData() => context
{
actor: StonetopActor,
equipment: {special: [], gear: [], PBTA_OTHER: []},
equipmentTypes: {special: 'Special Possessions', gear: 'Gear'},
flags: {pbta: {}},
isCharater: true,
isNPC: false,
items: StonetopItem[] (all basic moves),
moveTypes: {background: "stonetop.character.moveTypes.background",basic: "Basic Moves"},
playbooks: [{name: string, uuid:"compendium key"}],
sheetSettings: {hideRollFormula: true, ...},
statClock: false,
statSettings: {
ask:{label: 'Ask', value: 0},
cha:{label: 'stonetop.character.stats.charisma', value: 0},
con:{label: 'stonetop.character.stats.constitution', value: 0},
dex:{label: 'stonetop.character.stats.dexterity', value: 0},
formula:{label: 'Custom Roll Formula', value: 0},
int:{label: 'stonetop.character.stats.intelligence', value: 0},
prompt:{label: 'Prompt', value: 0},
str:{label: 'stonetop.character.stats.strength', value: 0},
wis:{label: 'stonetop.character.stats.wisdom', value: 0},
},
statToggle: false,
statToken: false,
stonetop: {
appearance: [],
backgrounds: [],
hasPlaybook: false,
instincts: [],
movelist: {playbookMoves:[], basicMoves:[],otherGroups:[]},
origins: [],
savedInstinct: ""
},
system: {
advancements:0,
attrLeft:{hp: {…}, armour: {…}, damage: {…}, load: {…}},
attrTop:{xp: {…}, level: {…}},
attributes:{xp: {…}, level: {…}, debilities: {…}, hp: {…}, armour: {…}, …},
details:{biography: {…}},
playbook:{name: '', slug: '', uuid: ''},
resources:{forward: {…}, ongoing: {…}, hold: {…}, rollFormula: ''},
stats:{str: {…}, dex: {…}, int: {…}, wis: {…}, con: {…}, …}
}
}
