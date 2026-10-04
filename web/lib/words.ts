/*
  Row nouns, derived rather than written twice.

  A ranked list says "View all 7 <plural>" on its disclosure and heads the
  table's first column with the singular; a map says "hover <article singular>
  for its value". Spelling each out at the call site is how "View all 7 places"
  ended up over a list of political parties, and how a map caption stated the
  same count twice under two different nouns.
*/

/** "Party" -> "parties", "Province" -> "provinces". */
export function pluralLower(singular: string): string {
  const s = singular.toLowerCase();
  if (/[^aeiou]y$/.test(s)) return `${s.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/.test(s)) return `${s}es`;
  return `${s}s`;
}

/** "areas" -> "an area", "districts" -> "a district". */
export function oneOf(plural: string): string {
  const s = plural.toLowerCase();
  const singular = /ies$/.test(s)
    ? `${s.slice(0, -3)}y`
    : /(ses|xes|zes|ches|shes)$/.test(s)
      ? s.slice(0, -2)
      : s.replace(/s$/, "");
  return `${/^[aeiou]/.test(singular) ? "an" : "a"} ${singular}`;
}
