import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  ENDPOINTS,
  validateAtom,
  validateEndpoints,
  validateJsonFeed,
  validateRss,
} from "../scripts/validate-endpoints.js";
import { mirrorFeeds } from "../scripts/mirror-feeds.js";

const item = {
  id: "https://aethertheater.com/musings/f/example",
  html_content: "<p>Canonical content.</p>",
  url: "https://aethertheater.com/musings/f/example",
  title: "Example",
  summary: "Canonical summary.",
  date_modified: "2026-09-12T17:00:00Z",
};

const feed = {
  version: "https://jsonfeed.org/version/1",
  title: "Aether Theater",
  home_page_url: "https://aethertheater.com",
  description: "Aether Theater",
  author: { name: "Aether Theater" },
  items: [item],
};

test("validates the observed JSON Feed production shape", () => {
  assert.deepEqual(validateJsonFeed(feed), feed);
});

test("rejects JSON feeds with missing item fields", () => {
  const invalid = structuredClone(feed);
  delete invalid.items[0].summary;
  assert.throws(() => validateJsonFeed(invalid), /missing summary/);
});

test("rejects malformed or empty XML endpoint responses", () => {
  assert.throws(() => validateRss(""), /empty response/);
  assert.throws(() => validateRss("<rss><channel></rss>"), /complete <channel>/);
  assert.throws(() => validateAtom("<feed></feed>"), /<entry>/);
});

test("validates all three canonical endpoints without transforming them", async () => {
  const responses = new Map([
    [ENDPOINTS.json, JSON.stringify(feed)],
    [
      ENDPOINTS.rss,
      '<?xml version="1.0"?><rss version="2.0"><channel><title>Aether Theater</title></channel></rss>',
    ],
    [
      ENDPOINTS.atom,
      '<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Example</title></entry></feed>',
    ],
  ]);
  const fetchStub = async (url) => ({
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => responses.get(url),
  });

  const results = await validateEndpoints(fetchStub);

  assert.deepEqual(
    results.map(({ name, url }) => ({ name, url })),
    [
      { name: "JSON", url: ENDPOINTS.json },
      { name: "RSS", url: ENDPOINTS.rss },
      { name: "Atom", url: ENDPOINTS.atom },
    ],
  );
});

test("reports unavailable endpoints clearly", async () => {
  await assert.rejects(
    validateEndpoints(async () => {
      throw new Error("network down");
    }),
    /unavailable: network down/,
  );
});

test("mirrors validated response bytes exactly", async () => {
  const responses = new Map([
    [ENDPOINTS.json, Buffer.from(`\uFEFF${JSON.stringify(feed)}\n`, "utf8")],
    [
      ENDPOINTS.rss,
      Buffer.from('<?xml version="1.0"?>\n<rss><channel></channel></rss>\r\n', "utf8"),
    ],
    [
      ENDPOINTS.atom,
      Buffer.from('<?xml version="1.0"?>\n<feed><entry></entry></feed>\n', "utf8"),
    ],
  ]);
  const outputDir = join(await mkdtemp(join(os.tmpdir(), "aether-mirror-")), "pages");
  const indexPath = join(await mkdtemp(join(os.tmpdir(), "aether-index-")), "index.html");
  const indexBytes = Buffer.from("<p>Compatibility documentation only.</p>\n", "utf8");
  await writeFile(indexPath, indexBytes);
  const fetchStub = async (url) => ({
    ok: true,
    status: 200,
    statusText: "OK",
    arrayBuffer: async () => responses.get(url),
  });

  await mirrorFeeds(outputDir, fetchStub, indexPath);

  assert.deepEqual(await readFile(join(outputDir, "f.json")), responses.get(ENDPOINTS.json));
  assert.deepEqual(await readFile(join(outputDir, "f.rss")), responses.get(ENDPOINTS.rss));
  assert.deepEqual(await readFile(join(outputDir, "f.atom")), responses.get(ENDPOINTS.atom));
  assert.deepEqual(await readFile(join(outputDir, "index.html")), indexBytes);
});

test("does not create mirror output when validation fails", async () => {
  const parent = await mkdtemp(join(os.tmpdir(), "aether-mirror-failure-"));
  const outputDir = join(parent, "pages");
  const fetchStub = async (url) => ({
    ok: true,
    status: 200,
    statusText: "OK",
    arrayBuffer: async () =>
      Buffer.from(url === ENDPOINTS.json ? "{}" : "<broken>", "utf8"),
  });

  await assert.rejects(mirrorFeeds(outputDir, fetchStub), /failed validation/);
  await assert.rejects(readdir(outputDir), /ENOENT/);
});
