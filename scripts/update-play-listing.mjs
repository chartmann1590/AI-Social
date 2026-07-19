#!/usr/bin/env node
/**
 * Pushes play-store/listing/{title,short-description,full-description}.txt to the
 * live Google Play Console store listing (en-US) via the Android Publisher API.
 *
 * This is intentionally separate from the app-publish workflow: publishing a new
 * binary and editing the store listing text are different Play Console operations,
 * and re-running a full ~15 minute build just to change marketing copy is wasteful.
 *
 * Auth: signs its own service-account JWT and exchanges it for an OAuth2 access
 * token, using only Node's built-in `crypto`/`fetch` — no googleapis/google-auth
 * dependency needed for this one call.
 *
 * Env:
 *   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON - service account JSON (same secret the
 *     publish workflow uses), as a raw JSON string.
 *   PLAY_PACKAGE_NAME - defaults to com.charles.aisocial.
 */
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const PACKAGE_NAME = process.env.PLAY_PACKAGE_NAME || 'com.charles.aisocial';
const LANGUAGE = 'en-US';

function readListingFile(name) {
  const text = readFileSync(path.join(repoRoot, 'play-store', 'listing', name), 'utf8');
  return text.replace(/\r\n/g, '\n').trim();
}

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(serviceAccount.private_key).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function api(accessToken, method, urlPath, body) {
  const res = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${urlPath} failed: ${res.status} ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function main() {
  const rawServiceAccount = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  if (!rawServiceAccount) {
    throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not set.');
  }
  const serviceAccount = JSON.parse(rawServiceAccount);

  const title = readListingFile('title.txt');
  const shortDescription = readListingFile('short-description.txt');
  const fullDescription = readListingFile('full-description.txt');

  console.log(`Updating Play Store listing for ${PACKAGE_NAME} (${LANGUAGE})`);
  console.log(`  title: ${title} (${[...title].length} chars)`);
  console.log(`  shortDescription: ${shortDescription.length} chars`);
  console.log(`  fullDescription: ${fullDescription.length} chars`);

  const accessToken = await getAccessToken(serviceAccount);

  const edit = await api(accessToken, 'POST', `${PACKAGE_NAME}/edits`);
  const editId = edit.id;
  console.log(`Created edit ${editId}`);

  await api(accessToken, 'PUT', `${PACKAGE_NAME}/edits/${editId}/listings/${LANGUAGE}`, {
    language: LANGUAGE,
    title,
    shortDescription,
    fullDescription,
  });
  console.log('Updated listing text.');

  await api(accessToken, 'POST', `${PACKAGE_NAME}/edits/${editId}:commit`);
  console.log('Committed edit — store listing is now live.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
