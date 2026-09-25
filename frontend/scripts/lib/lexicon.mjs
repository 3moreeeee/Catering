// =============================================================================
// FR → EN CATALOGUE LEXICON
//
// The source's product names are French trade names. Leaving them in the
// English locale would make /en a French catalogue with English chrome; running
// them through a general translator would invent terminology for articles whose
// exact trade name matters to a buyer. So this is a closed, hand-checked
// vocabulary of the words that actually occur in this catalogue, plus the two
// French noun-phrase shapes that account for nearly all of the names:
//
//   "{noun} en {material}"   Fourchette en bois        → Wooden fork
//   "{noun} {adjective}"     Paille noire             → Black straw
//
// Anything the lexicon cannot fully translate is left in French and the record
// is flagged `needsVerification`, so a human finishes it rather than the
// machine guessing. The count of such records is reported by the import.
//
// Terms are listed alphabetically within their group so the table can be read
// and argued with.
// =============================================================================

/** Multi-word phrases, applied before single tokens. Longest first at runtime. */
export const PHRASES = new Map([
  ['a code couleur', 'colour-coded'],
  ['a decouper', 'cutting'],
  ['a dessert', 'dessert'],
  ['a soupe', 'soup'],
  ['a cafe', 'coffee'],
  ['a melange', 'mixing'],
  ['a patisserie', 'pastry'],
  ['a sushi', 'sushi'],
  ['a glacons', 'ice'],
  ['a salade', 'salad'],
  ['a farine', 'flour'],
  ['avec couvercle', 'with lid'],
  ['sans couvercle', 'without lid'],
  ['sans trou', 'without hole'],
  ['sans boite distributrice', 'without dispenser box'],
  ['en boite distributrice', 'in a dispenser box'],
  ['en non tisse', 'non-woven'],
  ['non tisse', 'non-woven'],
  ['essuie tout', 'kitchen roll'],
  ['essuie main', 'hand towel'],
  ['essuie-tout', 'kitchen roll'],
  ['micro ondable', 'microwaveable'],
  ['micro-ondable', 'microwaveable'],
  ['papier dentelle', 'doily'],
  ['papier cuisson', 'baking paper'],
  ['liquide vaisselle', 'washing-up liquid'],
  ['sucre de canne', 'cane sugar'],
  ['fruits rouges', 'red berries'],
  ['noix de coco', 'coconut'],
  ['pomme granny smith', 'granny smith apple'],
  ['le fruit', 'fruit purée'],
  ['de service', 'serving'],
  ['de protection', 'protective'],
  ['de modena', 'of Modena'],
  ['deux compartiments', 'two compartments'],
  ['trois compartiments', 'three compartments'],
  ['la rame de', 'ream of'],
  ['bubble smoothie', 'bubble smoothie'],
  ['double elastiques', 'double-elastic'],
  ['simple elastique', 'single-elastic'],
]);

/** Materials, used by the "{noun} en {material}" pattern. */
export const MATERIALS = new Map([
  ['bois', 'wooden'],
  ['papier', 'paper'],
  ['carton', 'card'],
  ['plastique', 'plastic'],
  ['polycarbonate', 'polycarbonate'],
  ['polyethylene', 'polyethylene'],
  ['polypropylene', 'polypropylene'],
  ['latex', 'latex'],
  ['vinyle', 'vinyl'],
  ['metal', 'metal'],
  ['inox', 'stainless steel'],
  ['verre', 'glass'],
  ['aluminium', 'aluminium'],
  ['kraft', 'kraft'],
  ['pet', 'PET'],
  ['eps', 'EPS'],
  ['ps', 'PS'],
  ['pp', 'PP'],
  ['crepon', 'crêped paper'],
]);

/** Adjectives and colours, used by the "{noun} {adjective}" pattern. */
export const ADJECTIVES = new Map([
  ['blanc', 'white'], ['blanche', 'white'],
  ['noir', 'black'], ['noire', 'black'],
  ['rouge', 'red'], ['vert', 'green'], ['verte', 'green'],
  ['bleu', 'blue'], ['bleue', 'blue'], ['jaune', 'yellow'],
  ['brun', 'brown'], ['marron', 'brown'], ['lilas', 'lilac'],
  ['transparent', 'clear'], ['transparente', 'clear'],
  ['colorees', 'coloured'], ['colore', 'coloured'],
  ['simple', 'single'], ['double', 'double'],
  ['flexible', 'flexible'], ['forte', 'strong'],
  ['jetable', 'disposable'], ['jetables', 'disposable'],
  ['legere', 'light'], ['enveloppee', 'wrapped'], ['enveloppe', 'wrapped'],
  ['ronde', 'round'], ['rond', 'round'],
  ['rectangulaire', 'rectangular'], ['carre', 'square'],
  ['alimentaire', 'food-grade'], ['alimentaires', 'food-grade'],
  ['etirable', 'stretch'],
  ['bouffant', 'bouffant'],
  ['visiteurs', 'visitor'],
  ['petite', 'small'], ['petites', 'small'],
  ['raye', 'striped'], ['rayee', 'striped'],
  ['gastronorme', 'gastronorm'],
  ['patissier', 'pastry'], ['patissiere', 'pastry'],
  ['decoration', 'decorative'],
  ['doux', 'sweet'], ['douce', 'sweet'],
  ['tranches', 'sliced'],
  ['pvc', 'PVC'],
]);

/** Nouns. The head of the name. */
export const NOUNS = new Map([
  ['assiette', 'plate'],
  ['bac', 'container'],
  ['barquette', 'tray'],
  ['bol', 'bowl'],
  ['boite', 'box'], ['boites', 'boxes'],
  ['bouteille', 'bottle'], ['bouteilles', 'bottles'],
  ['caissette', 'baking case'], ['caissettes', 'baking cases'],
  ['calot', 'cap'],
  ['casquette', 'cap'],
  ['coiffe', 'hairnet'],
  ['concentre', 'cordial'],
  ['couteau', 'knife'],
  ['couvercle', 'lid'],
  ['couverts', 'cutlery'],
  ['creme', 'cream'],
  ['cuillere', 'spoon'],
  ['doseur', 'measure'],
  ['film', 'film'],
  ['fourchette', 'fork'],
  ['frappe', 'frappé base'],
  ['frites', 'chips'],
  ['fritures', 'fried food'],
  ['gant', 'glove'], ['gants', 'gloves'],
  ['gobelet', 'cup'],
  ['hamburger', 'burger'],
  ['masque', 'mask'],
  ['moutarde', 'mustard'],
  ['paille', 'straw'], ['pailles', 'straws'],
  ['papier', 'paper'],
  ['pilon', 'muddler'],
  ['pique', 'pick'], ['piques', 'picks'],
  ['planche', 'board'],
  ['plateau', 'tray'],
  ['pochette', 'sleeve'], ['poches', 'bags'],
  ['pompe', 'pump'],
  ['rack', 'rack'],
  ['rouleau', 'roll'], ['rouleaux', 'rolls'],
  ['sauce', 'sauce'],
  ['sirop', 'syrup'],
  ['surchaussure', 'overshoe'],
  ['tablier', 'apron'],
  ['toque', 'chef’s hat'],
  ['verre', 'glass'],
  ['verrine', 'verrine'], ['verrines', 'verrines'],
  ['vinaigre', 'vinegar'],
  ['blouse', 'coat'], ['blouses', 'coats'],
  ['champignons', 'mushrooms'],
  ['haricot', 'bean'], ['haricots', 'beans'],
  ['mais', 'sweetcorn'],
  ['salade', 'salad'],
  ['soupe', 'soup'],
  ['repas', 'meal'],
  ['boule', 'ball'], ['boules', 'balls'],
  ['etoile', 'star'],
  ['bamboo', 'bamboo'], ['bambou', 'bamboo'],
  ['barmat', 'bar mat'],
  ['cornet', 'cone'], ['cornets', 'cones'],
  ['dispenser', 'dispenser'],
  ['douille', 'piping nozzle'], ['douilles', 'piping nozzles'],
  ['pastille', 'disc'],
  ['pate', 'pasta'], ['pates', 'pasta'],
  ['pot', 'pot'],
  ['poche', 'piping bag'],
  ['ruban', 'ribbon'],
  ['shaker', 'shaker'],
  ['chope', 'tankard'],
  ['feuille', 'leaf'], ['feuilles', 'sheets'],
  ['support', 'stand'],
  ['sauces', 'sauces'],
]);

/** Flavours and other qualifiers that follow "saveur" or stand alone. */
export const FLAVOURS = new Map([
  ['grenadine', 'grenadine'], ['mojito', 'mojito'], ['mint', 'mint'],
  ['menthe', 'mint'], ['noisette', 'hazelnut'], ['rose', 'rose'],
  ['coco', 'coconut'], ['curacao', 'curaçao'], ['caramel', 'caramel'],
  ['chocolat', 'chocolate'], ['vanille', 'vanilla'], ['cafe', 'coffee'],
  ['fraise', 'strawberry'], ['framboise', 'raspberry'], ['kiwi', 'kiwi'],
  ['myrtille', 'blueberry'], ['citron', 'lemon'], ['agrume', 'citrus'],
  ['pomme', 'apple'], ['tiramisu', 'tiramisu'], ['balsamique', 'balsamic'],
  ['dijon', 'Dijon'], ['barbecue', 'barbecue'], ['sucre', 'sugar'],
  ['canne', 'cane'], ['fruit', 'fruit'], ['fruits', 'fruits'],
  ['cassis', 'blackcurrant'], ['speculos', 'speculoos'],
  ['glaciale', 'iced'], ['salee', 'salted'], ['orange', 'orange'],
  ['chinoise', 'Chinese'], ['biere', 'beer'], ['pin', 'pine'],
]);

/**
 * Several of the source's names are already in English — the Asian sauce range
 * is listed as "Ginger sauce For Chicken", "Sweet Chilli Sauce", "Oyster
 * Sauce". Those words need no translation and must not be reported as residue,
 * or a perfectly good English name gets flagged for a translator.
 */
const ALREADY_ENGLISH = new Set([
  'ginger', 'for', 'chicken', 'oyster', 'sweet', 'sriracha', 'hot', 'chilli',
  'chili', 'lime', 'juice', 'cordial', 'soy', 'sauce', 'type', 'chef',
]);

/** Words that carry no meaning in the English name. */
const DROP = new Set(['les', 'le', 'la', 'de', 'du', 'des', 'en', 'et', 'a', 'au', 'aux', 'pour', 'avec', 'saveur', 'la', 'pieces', 'piece']);

/** Brand and proper nouns pass through untouched. */
const PASSTHROUGH = new Set([
  'monin', 'martellato', 'plastport', 'dijona', 'mayor', 'varvello', 'emporium',
  'lilas', 'lamaa', 'cambi', 'modena', 'pro', 'gn', 'xl', 'jumbo', 'bubble', 'gum', 'smoothie',
  'boston', 'soy', 'gm', 'pm', 'plis', 'hauteur', 'h', 'n',
]);

const deaccent = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Translates one French product name.
 *
 * Returns the English string and the tokens it could not account for. A
 * non-empty `residue` means the record must be flagged for a human.
 */
export function translateName(french) {
  const original = String(french ?? '').trim();
  if (!original) return { english: '', residue: ['(empty)'] };

  // Measurements and pack quantities are language-neutral; they are lifted out,
  // translated structurally, and appended at the end in the English order.
  const tail = [];
  let work = deaccent(original.toLowerCase());

  work = work.replace(/\b(?:les|lot de|boite de|la rame de|par)\s+(\d+)\s*(pieces?|boites?|gobelets?|feuilles?)?/g, (_m, n, unit) => {
    const noun = unit && /boite/.test(unit) ? 'boxes' : unit && /feuille/.test(unit) ? 'sheets' : unit && /gobelet/.test(unit) ? 'cups' : 'pieces';
    tail.push(`pack of ${n} ${noun}`);
    return ' ';
  });

  // Dimensions first, and only then single measurements. The other order eats
  // the "30cm" out of "30cmx60cmx2cm" and leaves a trail of stray x's behind.
  work = work.replace(
    /\d+\s*(?:mm|cm|m)?\s*(?:[x×]\s*\d+\s*(?:mm|cm|m)?\s*)+/g,
    (whole) => {
      tail.push(whole.replace(/\s+/g, '').replace(/×/g, 'x').replace(/[x]$/, ''));
      return ' ';
    },
  );

  work = work.replace(/(\d+(?:[.,]\d+)?)\s*(ml|cl|l|g|gr|kg|mm|cm|m|oz)\b/g, (_m, n, u) => {
    const unit = { gr: 'g', lt: 'l' }[u] ?? u;
    tail.push(`${n.replace(',', '.')} ${unit}`);
    return ' ';
  });

  // Phrases, longest first.
  for (const [fr, en] of [...PHRASES.entries()].sort((a, b) => b[0].length - a[0].length)) {
    // The replacement is a single token: spaces inside it would be split apart
    // by the tokeniser below and the phrase would come back out in pieces.
    work = work.replace(
      new RegExp(`\\b${fr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'),
      ` ⟪${en.replace(/ /g, '_')}⟫ `,
    );
  }

  // Uppercase and hyphens have to survive the split, because the phrase markers
  // carry both ("⟪non-woven⟫", "⟪of_Modena⟫"). Stray hyphens are trimmed off
  // ordinary tokens afterwards.
  const tokens = work
    // Accented letters too: the replacements are English but not all ASCII
    // ("fruit purée", "chef’s hat"), and excluding them split the marker.
    .split(/[^A-Za-zÀ-ÿ0-9⟪⟫_’-]+/)
    .map((t) => (t.startsWith('⟪') ? t : t.replace(/^-+|-+$/g, '')))
    .filter(Boolean);

  const head = [];
  const before = [];
  const after = [];
  const residue = [];

  for (const token of tokens) {
    if (token.startsWith('⟪')) {
      after.push(token.slice(1, -1).replace(/_/g, ' '));
      continue;
    }
    if (DROP.has(token)) continue;
    if (PASSTHROUGH.has(token)) {
      after.push(token === 'monin' ? 'MONIN' : token.charAt(0).toUpperCase() + token.slice(1));
      continue;
    }
    if (NOUNS.has(token)) {
      head.push(NOUNS.get(token));
      continue;
    }
    if (MATERIALS.has(token)) {
      before.push(MATERIALS.get(token));
      continue;
    }
    if (ADJECTIVES.has(token)) {
      before.push(ADJECTIVES.get(token));
      continue;
    }
    if (FLAVOURS.has(token)) {
      after.push(FLAVOURS.get(token));
      continue;
    }
    if (/^n?°?\d+$/.test(token) || /^\d+$/.test(token)) {
      after.push(token);
      continue;
    }
    if (ALREADY_ENGLISH.has(token)) {
      after.push(token);
      continue;
    }
    // A single letter is a size or model code ("Pique P", "l 30cm"); it carries
    // through rather than being reported as an untranslated word.
    if (token.length === 1) {
      after.push(token.toUpperCase());
      continue;
    }
    residue.push(token);
  }

  // "{material/adjective} {noun} {qualifiers} {measurements}" — English order.
  const parts = [
    before.join(' '),
    head.join(' '),
    after.join(' '),
    tail.join(' '),
  ].filter(Boolean);

  const english = parts
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.])/g, '$1')
    .trim();

  return {
    english: english.charAt(0).toUpperCase() + english.slice(1),
    residue,
  };
}
