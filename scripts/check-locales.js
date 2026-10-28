import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getMissingTranslationKeys, i18n, supportedLanguages } from "../src-ui/locales.js";

const sourcePath = fileURLToPath(new URL("../src-ui/main.js", import.meta.url));
const source = readFileSync(sourcePath, "utf8");
const referencedKeys = new Set();
const callPattern = /(?:^|[^A-Za-z0-9_$.])t\(\s*([^)]*)\)/g;
const keyPattern = /["']([a-z][a-z0-9_]*)["']/g;

for (const call of source.matchAll(callPattern)) {
  const args = call[1].trim();
  const directKey = args.match(/^["']([a-z][a-z0-9_]*)["']$/);
  if (directKey) {
    referencedKeys.add(directKey[1]);
    continue;
  }
  for (const key of args.matchAll(keyPattern)) {
    if (Object.hasOwn(i18n.en, key[1]) || key[1].includes("_")) referencedKeys.add(key[1]);
  }
}

const missingEnglish = getMissingTranslationKeys("en", [...referencedKeys]);
const unsupportedCatalogs = supportedLanguages.filter((language) => !Object.hasOwn(i18n, language));
const unknownCatalogKeys = Object.entries(i18n).flatMap(([language, catalog]) =>
  Object.keys(catalog).filter((key) => !Object.hasOwn(i18n.en, key)).map((key) => `${language}.${key}`)
);

if (missingEnglish.length || unsupportedCatalogs.length || unknownCatalogKeys.length) {
  if (missingEnglish.length) console.error(`Missing EN strings referenced by UI: ${missingEnglish.join(", ")}`);
  if (unsupportedCatalogs.length) console.error(`Languages without catalogs: ${unsupportedCatalogs.join(", ")}`);
  if (unknownCatalogKeys.length) console.error(`Catalog keys absent from EN: ${unknownCatalogKeys.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log(`Locale check passed: ${referencedKeys.size} referenced UI keys have EN strings.`);
}

for (const language of supportedLanguages) {
  const missing = getMissingTranslationKeys(language, [...referencedKeys]);
  if (language === "en") {
    console.log(`EN: ${missing.length} referenced key(s) are missing English strings.`);
  } else {
    console.log(`${language.toUpperCase()}: ${missing.length} referenced key(s) use EN fallback.`);
  }
}
