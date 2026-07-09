// Pure i18n helpers extracted from the main IIFE in index.html: the
// {{yearsSince:YYYY}} token substitution used by strings that cannot render
// HTML (document.title, meta description), and an EN/ES key-parity check
// that used to only exist as a manual snippet (see audit item 4).
function computeYearsSince(since, nowYear) {
  return nowYear - since;
}

function subYears(str, nowYear) {
  return String(str).replace(/\{\{yearsSince:(\d+)\}\}/g, (_, y) => String(computeYearsSince(parseInt(y, 10), nowYear)));
}

// Compares the key sets of the two locale dictionaries. Returns keys present
// in one locale but missing in the other so a broken translation cannot ship
// silently in either language.
function checkI18nParity(enDict, esDict) {
  const enKeys = Object.keys(enDict || {});
  const esKeys = Object.keys(esDict || {});
  const esSet = new Set(esKeys);
  const enSet = new Set(enKeys);
  const missingInEs = enKeys.filter((k) => !esSet.has(k));
  const missingInEn = esKeys.filter((k) => !enSet.has(k));
  return {
    missingInEs,
    missingInEn,
    isInSync: missingInEs.length === 0 && missingInEn.length === 0
  };
}

const JSMI18nUtils = {
  computeYearsSince,
  subYears,
  checkI18nParity
};

if (typeof window !== 'undefined') window.JSMI18nUtils = JSMI18nUtils;
if (typeof module !== 'undefined' && module.exports) module.exports = JSMI18nUtils;
