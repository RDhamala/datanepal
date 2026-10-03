const DEVANAGARI = /[ऀ-ॿ]/;

/**
 * `lang` for a string whose script is a property of the data, not the layout.
 *
 * Site chrome knows what script it is in and writes `lang="ne"` literally. Data
 * does not: a party's `name` is Devanagari when the party registered no roman
 * form, and roman when it did, in the same column of the same table. Deciding
 * from the characters is the only rule that stays true as the data changes.
 *
 * Returns undefined for Latin text so it inherits the document's `lang="en"`.
 */
export function langOf(text: unknown): "ne" | undefined {
  return typeof text === "string" && DEVANAGARI.test(text) ? "ne" : undefined;
}

/**
 * `lang` and the `.ne` font class for a data string, decided once.
 *
 * They are two halves of the same fact and were written separately for a year,
 * which is how a dozen call sites ended up with one and not the other. Spread
 * the result onto the element instead of writing either by hand.
 */
export function scriptAttrs(text: unknown, className = "") {
  const lang = langOf(text);
  return { lang, className: lang ? `ne ${className}`.trim() : className };
}
