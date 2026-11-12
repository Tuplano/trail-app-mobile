#!/usr/bin/env node
/**
 * Copies the shared hike rules from the API (trail-app-api/src/geo) into the
 * app (src/tracking/geo). The API is their one home: change them there, then
 * run `npm run sync:geo`. `npm run sync:geo -- --check` only reports whether
 * the copy is out of date (exit code 1 if it is).
 *
 * The API repo is looked for next to this one; set TRAIL_API_DIR otherwise.
 */
const fs = require('node:fs');
const path = require('node:path');

/** The pure files the app needs. gpx.ts stays in the API (it needs an XML library). */
const FILES = [
  'types.ts',
  'distance.ts',
  'filter.ts',
  'thin.ts',
  'moving.ts',
  'elevation.ts',
  'hike-stats.ts',
  'hike-stats.cases.ts',
];

const APP_ROOT = path.resolve(__dirname, '..');
const API_GEO = path.resolve(APP_ROOT, process.env.TRAIL_API_DIR ?? '../trail-app-api', 'src/geo');
const APP_GEO = path.join(APP_ROOT, 'src/tracking/geo');

const HEADER =
  '// Copied from trail-app-api/src/geo by `npm run sync:geo`. Do not edit here:\n' +
  '// change it in the API, then run the sync again.\n\n';

/**
 * The API file as the app keeps it: the header, and imports without the
 * ".js" the API's ESM setup needs (Metro resolves "./distance", not "./distance.js").
 */
function toAppFile(source) {
  return HEADER + source.replace(/(from\s+['"]\.\/[\w.-]+)\.js(['"])/g, '$1$2');
}

/** Each file whose app copy differs from what the sync would write. */
function outdatedFiles() {
  return FILES.filter((name) => {
    const want = toAppFile(fs.readFileSync(path.join(API_GEO, name), 'utf8'));
    const target = path.join(APP_GEO, name);
    return !fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== want;
  });
}

function main() {
  if (!fs.existsSync(API_GEO)) {
    console.error(`Can't find the API's rules at ${API_GEO}. Set TRAIL_API_DIR to the trail-app-api folder.`);
    process.exit(2);
  }
  const outdated = outdatedFiles();
  if (process.argv.includes('--check')) {
    if (outdated.length > 0) {
      console.error(`Out of date with the API: ${outdated.join(', ')}. Run npm run sync:geo.`);
      process.exit(1);
    }
    console.log('src/tracking/geo matches the API.');
    return;
  }
  fs.mkdirSync(APP_GEO, { recursive: true });
  for (const name of FILES) {
    const source = fs.readFileSync(path.join(API_GEO, name), 'utf8');
    fs.writeFileSync(path.join(APP_GEO, name), toAppFile(source));
  }
  console.log(outdated.length ? `Updated: ${outdated.join(', ')}` : 'Already up to date.');
}

module.exports = { API_GEO, FILES, outdatedFiles, toAppFile };

if (require.main === module) main();
