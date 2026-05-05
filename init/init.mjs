// @ts-check
import fs from "node:fs";
import yaml from "yaml";
import "dotenv/config";
import { dirname } from "node:path";

console.log("Applying environment variables to config files via Node.js...");

const hpConfigPathIn =
  process.env.hpConfigPathIn || "/app/headplane_config.yml";
const hsConfigPathIn =
  process.env.hsConfigPathIn || "/app/headscale_config.yml";
const hpConfigPathOut =
  process.env.hpConfigPathOut || "/shared/headplane_config.yaml";
const hsConfigPathOut =
  process.env.hsConfigPathOut || "/shared/headscale_config.yaml";

if (!fs.existsSync(hpConfigPathOut)) {
  fs.mkdirSync(dirname(hpConfigPathOut), {
    recursive: true,
  });
}

if (!fs.existsSync(hsConfigPathOut)) {
  fs.mkdirSync(dirname(hsConfigPathOut), {
    recursive: true,
  });
}

// Helper to read, modify, and write YAML
/**
 *
 * @param {string} inPath
 * @param {string} outPath
 * @param {(doc: import("yaml").Document.Parsed) => void} updater
 * @returns
 */
function updateYaml(inPath, outPath, updater) {
  if (!fs.existsSync(inPath)) {
    console.warn(`File not found: ${inPath}`);
    return;
  }
  const fileContents = fs.readFileSync(inPath, "utf8");

  // Use yaml.parseDocument to preserve comments
  const doc = yaml.parseDocument(fileContents);

  updater(doc);

  fs.writeFileSync(outPath, String(doc));
  console.log(`Updated and wrote to ${outPath}`);
}

// Update Headplane Config
updateYaml(hpConfigPathIn, hpConfigPathOut, (doc) => {
  const getSet = (
    /** @type {Iterable<unknown> | null} */ pathArr,
    /** @type {unknown} */ val,
  ) => {
    if (val !== undefined && val !== "") {
      doc.setIn(pathArr, val);
    }
  };

  console.log(`Writing Headplane Config:`);
  console.log(` - server.base_url: ${process.env.HEADPLANE_SERVER__BASE_URL}`);
  console.log(` - headscale.url: ${process.env.HEADSCALE_URL}`);
  console.log(` - headscale.public_url: ${process.env.HEADSCALE_PUBLIC_URL}`);

  const cleanUrl = (url) => (url ? url.replace(/\/+$/, "") : url);

  getSet(["server", "cookie_secret"], process.env.HEADPLANE_SERVER__COOKIE_SECRET);
  getSet(["server", "info_secret"], process.env.HEADPLANE_SERVER__INFO_SECRET);
  getSet(["server", "base_url"], cleanUrl(process.env.HEADPLANE_SERVER__BASE_URL));
  getSet(["headscale", "url"], cleanUrl(process.env.HEADSCALE_URL));
  getSet(["headscale", "api_key"], process.env.HEADSCALE_API_KEY);
  getSet(["headscale", "public_url"], cleanUrl(process.env.HEADSCALE_PUBLIC_URL));

  // Also update the headscale config path to point to the shared volume
  getSet(["headscale", "config_path"], "/shared/headscale_config.yaml");

  if (process.env.INTEGRATION_AGENT__ENABLED === "true") {
    doc.setIn(["integration", "agent", "enabled"], true);
  }

  getSet(
    ["integration", "agent", "host_name"],
    process.env.INTEGRATION_AGENT__HOST_NAME,
  );
});

// Update Headscale Config
updateYaml(hsConfigPathIn, hsConfigPathOut, (doc) => {
  const getSet = (
    /** @type {Iterable<unknown> | null} */ pathArr,
    /** @type {unknown} */ val,
  ) => {
    if (val !== undefined && val !== "") {
      doc.setIn(pathArr, val);
    }
  };

  getSet(["server_url"], process.env.SERVER_URL);
  getSet(["acme_email"], process.env.ACME_EMAIL);
  getSet(["tls_letsencrypt_hostname"], process.env.TLS_LETSENCRYPT_HOSTNAME);
});

// Verify file content without network probe (which fails before services start)
if (fs.existsSync(hsConfigPathOut)) {
  const hsFinal = fs.readFileSync(hsConfigPathOut, "utf8");
  const match = hsFinal.match(/server_url: .*/);
  console.log(
    "Verified Headscale configuration on disk:",
    match ? match[0] : "server_url not found!",
  );
}

console.log("Configuration updated successfully.");
