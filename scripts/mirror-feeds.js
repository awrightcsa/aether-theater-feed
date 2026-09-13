import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  ENDPOINTS,
  validateEndpointText,
} from "./validate-endpoints.js";

const MIRROR_FILES = Object.freeze([
  ["JSON", ENDPOINTS.json, "f.json"],
  ["RSS", ENDPOINTS.rss, "f.rss"],
  ["Atom", ENDPOINTS.atom, "f.atom"],
]);

const DEFAULT_INDEX = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "site",
  "index.html",
);

function decodeUtf8(bytes, name) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    throw new Error(`${name} endpoint is not valid UTF-8: ${error.message}`, {
      cause: error,
    });
  }
}

async function fetchBytes(url, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { "user-agent": "aether-theater-feed-mirror/1.0" },
    });
  } catch (error) {
    throw new Error(`${url} unavailable: ${error.message}`, { cause: error });
  }
  if (!response.ok) {
    throw new Error(`${url} unavailable: HTTP ${response.status} ${response.statusText}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

export async function mirrorFeeds(
  outputDir,
  fetchImpl = fetch,
  indexPath = DEFAULT_INDEX,
) {
  if (!outputDir) {
    throw new Error("Mirror output directory is required");
  }

  const validated = [];
  for (const [name, url, fileName] of MIRROR_FILES) {
    let bytes;
    try {
      bytes = await fetchBytes(url, fetchImpl);
      validateEndpointText(name, decodeUtf8(bytes, name));
    } catch (error) {
      throw new Error(`${name} endpoint ${url} failed validation: ${error.message}`, {
        cause: error,
      });
    }
    validated.push({ name, url, fileName, bytes });
  }

  await mkdir(outputDir);
  for (const { fileName, bytes } of validated) {
    await writeFile(resolve(outputDir, fileName), bytes);
  }
  await copyFile(indexPath, resolve(outputDir, "index.html"));

  return validated.map(({ name, url, fileName, bytes }) => ({
    name,
    url,
    fileName,
    bytes: bytes.byteLength,
  }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mirrorFeeds(process.argv[2])
    .then((results) => {
      for (const result of results) {
        console.log(`${result.name}: mirrored ${result.bytes} bytes to ${result.fileName}`);
      }
    })
    .catch((error) => {
      console.error(`Feed mirror failed: ${error.message}`);
      process.exitCode = 1;
    });
}
