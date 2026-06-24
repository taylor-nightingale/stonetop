// Font role helpers, shared by extraction (layout.js) and rendering (render-html.js).
// mutool strips the subset prefix, so names are e.g. "Avara-Bold".
export const isAvara    = (f) => /Avara/i.test(f);
export const isItalic   = (f) => /Italic/i.test(f);
export const isBoldBody = (f) => /Bold/i.test(f) && !isAvara(f);
export const isDingbat  = (f) => /Dingbat/i.test(f);
export const isFell     = (f) => /Fell/i.test(f);
