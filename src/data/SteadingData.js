import {
	PROSPERITY_ITEMS,
	DEFENSES_ITEMS,
	DEFAULT_ASSETS_ITEMS,
	DEFAULT_COINAGE,
	DEFAULT_PLACES_OF_INTEREST,
	DEFAULT_NEIGHBOR_PLACES,
	DEFAULT_RESIDENT_NAMES,
	DEFAULT_RESIDENT_TRAITS,
} from "./SteadingDefaultData.js";

export class SteadingData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		const f = foundry.data.fields;

		const attrField = (defaultItems = []) => new f.SchemaField({
			current: new f.NumberField({ initial: 1, integer: true }),
			items:   new f.ArrayField(new f.StringField(), { initial: () => [...defaultItems] }),
		});

		return {
			description: new f.StringField({ initial: "" }),
			notes:       new f.StringField({ initial: "" }),
			fortunes:    new f.NumberField({ initial: 2, integer: true }),
			surplus:     new f.NumberField({ initial: 1, integer: true }),
			debilities: new f.SchemaField({
				diminished:  new f.BooleanField({ initial: false }),
				lacking:     new f.BooleanField({ initial: false }),
				malcontent:  new f.BooleanField({ initial: false }),
			}),
			attributes: new f.SchemaField({
				size:       attrField(),
				population: attrField(),
				prosperity: attrField(PROSPERITY_ITEMS),
				defenses:   attrField(DEFENSES_ITEMS),
			}),
			assets: new f.SchemaField({
				items:   new f.ArrayField(new f.StringField(), { initial: () => [...DEFAULT_ASSETS_ITEMS] }),
				coinage: new f.ArrayField(new f.ObjectField(), { initial: () => DEFAULT_COINAGE.map(c => ({ ...c })) }),
			}),
			content: new f.SchemaField({
				excluded:            new f.ArrayField(new f.StringField()),
				veiled:              new f.ArrayField(new f.StringField()),
				specialHandling:     new f.ArrayField(new f.StringField()),
				excludedText:        new f.StringField({ initial: "" }),
				veiledText:          new f.StringField({ initial: "" }),
				specialHandlingText: new f.StringField({ initial: "" }),
			}),
			placesOfInterest: new f.ArrayField(new f.StringField(), { initial: () => [...DEFAULT_PLACES_OF_INTEREST] }),
			neighborPlaces:   new f.ArrayField(new f.ObjectField(), { initial: () => DEFAULT_NEIGHBOR_PLACES.map(p => ({ ...p })) }),
			residentNames:    new f.StringField({ initial: DEFAULT_RESIDENT_NAMES }),
			residentTraits:   new f.ArrayField(new f.StringField(), { initial: () => [...DEFAULT_RESIDENT_TRAITS] }),
			residents:        new f.ArrayField(new f.ObjectField()),
			neighborPeople:   new f.ArrayField(new f.ObjectField()),
			improvements:     new f.SchemaField({ pickValues: new f.ObjectField() }),
		};
	}
}
