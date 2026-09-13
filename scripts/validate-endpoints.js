import { fileURLToPath } from "node:url";

export const ENDPOINTS = Object.freeze({
  json: "https://aethertheater.com/musings/f.json",
  rss: "https://aethertheater.com/musings/f.rss",
  atom: "https://aethertheater.com/musings/f.atom",
});

const REQUIRED_ITEM_FIELDS = Object.freeze([
  "id",
  "html_content",
  "url",
  "title",
  "summary",
  "date_modified",
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function requireUrl(value, label) {
  requireNonEmptyString(value, label);
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      throw new Error();
    }
  } catch {
    throw new Error(`${label} must be an HTTPS URL`);
  }
}

function validateItem(item, index) {
  if (!isObject(item)) {
    throw new Error(`JSON item at index ${index} must be an object`);
  }

  for (const field of REQUIRED_ITEM_FIELDS) {
    if (!(field in item)) {
      throw new Error(`JSON item at index ${index} is missing ${field}`);
    }
    requireNonEmptyString(item[field], `JSON item ${field} at index ${index}`);
  }

  requireUrl(item.id, `JSON item id at index ${index}`);
  requireUrl(item.url, `JSON item url at index ${index}`);

  if (Number.isNaN(Date.parse(item.date_modified))) {
    throw new Error(
      `JSON item date_modified at index ${index} must be a valid date`,
    );
  }
}

export function validateJsonFeed(value) {
  if (!isObject(value)) {
    throw new Error("JSON endpoint must contain a top-level object");
  }
  if (value.version !== "https://jsonfeed.org/version/1") {
    throw new Error("JSON endpoint must declare JSON Feed version 1");
  }
  requireNonEmptyString(value.title, "JSON title");
  requireUrl(value.home_page_url, "JSON home_page_url");

  requireNonEmptyString(value.description, "JSON description");
  if (!isObject(value.author)) {
    throw new Error("JSON author must be an object");
  }
  requireNonEmptyString(value.author.name, "JSON author.name");
  if (!Array.isArray(value.items) || value.items.length === 0) {
    throw new Error("JSON items must be a non-empty array");
  }

  value.items.forEach(validateItem);
  return value;
}

function validateXmlDocument(text, kind) {
  if (typeof text !== "string" || text.trim() === "") {
    throw new Error(`${kind} endpoint returned an empty response`);
  }

  const body = text.trim();
  const root = kind === "RSS" ? "rss" : "feed";
  const rootPattern = new RegExp(`<${root}(?:\\s|>)`, "i");
  const closingRootPattern = new RegExp(`</${root}\\s*>`, "i");

  if (!rootPattern.test(body) || !closingRootPattern.test(body)) {
    throw new Error(`${kind} endpoint does not contain a complete <${root}> document`);
  }
  return text;
}

export function validateRss(text) {
  const document = validateXmlDocument(text, "RSS");
  if (!/<channel(?:\s|>)/i.test(document) || !/<\/channel\s*>/i.test(document)) {
    throw new Error("RSS endpoint does not contain a complete <channel>");
  }
  return document;
}

export function validateAtom(text) {
  const document = validateXmlDocument(text, "Atom");
  if (!/<entry(?:\s|>)/i.test(document) || !/<\/entry\s*>/i.test(document)) {
    throw new Error("Atom endpoint does not contain an <entry>");
  }
  return document;
}

export function validateEndpointText(name, text) {
  if (name === "JSON") {
    try {
      validateJsonFeed(JSON.parse(text.replace(/^\uFEFF/, "")));
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`JSON endpoint is not valid JSON: ${error.message}`, {
          cause: error,
        });
      }
      throw error;
    }
    return;
  }

  if (name === "RSS") {
    validateRss(text);
    return;
  }
  if (name === "Atom") {
    validateAtom(text);
    return;
  }
  throw new Error(`Unknown endpoint type: ${name}`);
}

async function fetchEndpoint(url, fetchImpl = fetch) {
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { "user-agent": "aether-theater-feed-validator/1.0" },
    });
  } catch (error) {
    throw new Error(`${url} unavailable: ${error.message}`, { cause: error });
  }
  if (!response.ok) {
    throw new Error(`${url} unavailable: HTTP ${response.status} ${response.statusText}`);
  }
  return response.text();
}

export async function validateEndpoints(fetchImpl = fetch) {
  const checks = [
    ["JSON", ENDPOINTS.json],
    ["RSS", ENDPOINTS.rss],
    ["Atom", ENDPOINTS.atom],
  ];

  const results = [];
  for (const [name, url] of checks) {
    let text;
    try {
      text = await fetchEndpoint(url, fetchImpl);
      validateEndpointText(name, text);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`${name} endpoint ${url} is not valid JSON: ${error.message}`, {
          cause: error,
        });
      }
      throw new Error(`${name} endpoint ${url} failed validation: ${error.message}`, {
        cause: error,
      });
    }
    results.push({ name, url, bytes: Buffer.byteLength(text, "utf8") });
  }
  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  validateEndpoints()
    .then((results) => {
      for (const result of results) {
        console.log(`${result.name}: valid (${result.bytes} bytes) ${result.url}`);
      }
    })
    .catch((error) => {
      console.error(`Endpoint validation failed: ${error.message}`);
      process.exitCode = 1;
    });
}
