// -----------------------------------------------------------------------------
// Configuration: DEFAULT_CONFIG mirrors the manifest defaults (tied by
// test/manifest.test.js), and normalizeConfig() turns whatever Gladys sends
// (a field never saved is absent) into a complete, valid object. Nothing here
// throws.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

export const DEFAULT_CONFIG = {
  language: 'fr',
  filters: '',
};

// One device per filter: a few are plenty, and each one is a device.
export const MAX_FILTERS = 5;

/**
 * @param {object} [raw] the configuration sent by Gladys
 * @returns {object} DEFAULT_CONFIG's keys with valid values
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
    filters: typeof source.filters === 'string' ? source.filters.trim().slice(0, 300) : '',
  };
}

/** A name compared without case, accents nor punctuation: "Rocket Lab" = "rocketlab". */
export function foldName(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

/**
 * The filters typed by the user ("SpaceX, Kourou; Ariane"), each with the
 * slug of its device id. The slug is the folded term: retyping "spacex" or
 * "Space X" keeps the same device.
 * @returns {{ label: string, slug: string }[]}
 */
export function parseFilters(text) {
  const filters = [];
  for (const part of String(text ?? '').split(/[,;\n]/)) {
    const label = part.trim().slice(0, 40);
    const slug = foldName(label);
    if (slug && !filters.some((filter) => filter.slug === slug)) {
      filters.push({ label, slug });
    }
  }
  return filters.slice(0, MAX_FILTERS);
}
