// Shared schema-field factories for the system DataModels. Several models store
// the same shapes (a single integer `value`, a `{value, max}` resource, a
// debility toggle), so the factory lives here once instead of being re-declared
// per model.
const fields = foundry.data.fields;

// A `{ value: <integer> }` sub-object (stats, armor, level, population, …).
export const valueField = (initial = 0) => new fields.SchemaField({
	value: new fields.NumberField({ required: true, integer: true, initial }),
});

// A `{ value, max }` integer resource pair (hp, xp).
export const valueMaxField = (value = 0, max = 0) => new fields.SchemaField({
	value: new fields.NumberField({ required: true, integer: true, initial: value }),
	max:   new fields.NumberField({ required: true, integer: true, initial: max }),
});

// A debility toggle. Characters also tag each debility with the stats it covers;
// pass `stat` (an array of stat keys) to include that field, omit it otherwise.
export const debility = (label, stat) => {
	const schema = {
		label: new fields.StringField({ required: true, initial: label }),
		value: new fields.BooleanField({ required: true, initial: false }),
	};
	if (stat !== undefined) {
		schema.stat = new fields.ArrayField(new fields.StringField(), { initial: stat });
	}
	return new fields.SchemaField(schema);
};

// An irregularly-shaped sub-object preserved verbatim, defaulting to null (falsy)
// rather than {} so truthiness checks (e.g. `system.resource`) behave correctly.
export const looseObject = () => new fields.ObjectField({ required: false, nullable: true, initial: null });

// Schema for the two minimal move subtypes (npcMove / monsterMove): just a
// rich-text description and an optional roll formula.
export const simpleMoveSchema = () => ({
	description: new fields.HTMLField({ required: true, blank: true }),
	rollFormula: new fields.StringField({ required: true, blank: true }),
});
