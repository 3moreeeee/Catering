/**
 * Sub-category ids of the previous category tree that products still carry.
 *
 * The tree was replaced by the vinto.tn structure (see categories.data.ts);
 * ids that kept their meaning were reused, these were not. Products
 * holding one are listed in their division only until an administrator files
 * them in the new tree. The integrity specs accept these ids and nothing else,
 * so this list must shrink to empty — remove an id once no product uses it.
 */
export const RETIRED_SUBCATEGORY_IDS: ReadonlySet<string> = new Set([
  'trays-containers',
  'films-papers',
  'condiments',
  'aprons-sleeves',
  'equipment',
]);
