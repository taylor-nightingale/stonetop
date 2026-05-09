global.game = {
	i18n: { localize: (key) => key },
};

global.Hooks = {
	once: () => {},
	on: () => {},
};

global.CONFIG = {};

Math.clamped = (value, min, max) => Math.min(Math.max(value, min), max);
