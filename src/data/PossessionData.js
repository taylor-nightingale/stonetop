import { migrateChoicesField } from "../migration/migrateChoices.js";

export class PossessionData extends foundry.abstract.TypeDataModel {
	static migrateData(source) {
		migrateChoicesField(source.choices);
		// `label` was a redundant duplicate of the item name — the item `name` is now the single
		// source of truth, so drop any stored copy.
		delete source.label;
		return super.migrateData(source);
	}

	static defineSchema() {
		const f = foundry.data.fields;
		return {
			slug:         new f.StringField({ nullable: true, initial: null }),
			description:  new f.StringField({ initial: "" }),
			resource:     new f.ObjectField({ nullable: true, initial: null }),
			outfitItems:  new f.ArrayField(new f.ObjectField()),
			choices:      new f.ObjectField({ nullable: true, initial: null }),
			scaling:      new f.ObjectField({ nullable: true, initial: null }),
			sortOrder:    new f.NumberField({ nullable: true, initial: null }),
			selected:     new f.BooleanField({ initial: false }),
			preselected:  new f.BooleanField({ initial: false }),
			uses:         new f.NumberField({ initial: 0, integer: true }),
			pickValues:   new f.ObjectField({ initial: {} }),
			choiceUses:   new f.ObjectField({ initial: {} }),
			playbookSlug: new f.StringField({ nullable: true, initial: null }),
		};
	}
}
