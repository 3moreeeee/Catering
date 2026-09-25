// Brand surfaces around unchanged media. Colors come from the shared tokens.

export interface FilmPalette {
  readonly ground: string;
  readonly glow: string;
  readonly highKey: boolean;
}

export const FILM_PALETTE: Readonly<Record<string, FilmPalette>> = {
  'emballage-verrine': { ground: 'var(--c-packaging-900)', glow: 'var(--c-packaging-100)', highKey: false },
  'hygiene-jetable': { ground: 'var(--c-hygiene-800)', glow: 'var(--c-hygiene-100)', highKey: false },
  'hygiene-protocole': { ground: 'var(--c-hygiene-800)', glow: 'var(--c-hygiene-100)', highKey: false },
  'monin-fraicheur': { ground: 'var(--c-cat-monin)', glow: 'var(--c-dark-muted)', highKey: false },
  'sauce-burger': { ground: 'var(--c-food-900)', glow: 'var(--c-food-100)', highKey: false },
};
