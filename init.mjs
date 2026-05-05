import fs from 'fs';
import yaml from 'yaml';

console.log("Applying environment variables to config files via Node.js...");

const hpConfigPathIn = '/app/headplane_config.yml';
const hsConfigPathIn = '/app/headscale_config.yml';
const hpConfigPathOut = '/shared/headplane_config.yaml';
const hsConfigPathOut = '/shared/headscale_config.yaml';

// Helper to read, modify, and write YAML
function updateYaml(inPath, outPath, updater) {
  if (!fs.existsSync(inPath)) {
    console.warn(`File not found: ${inPath}`);
    return;
  }
  const fileContents = fs.readFileSync(inPath, 'utf8');
  
  // Use yaml.parseDocument to preserve comments
  const doc = yaml.parseDocument(fileContents);
  
  updater(doc);
  
  fs.writeFileSync(outPath, String(doc));
  console.log(`Updated and wrote to ${outPath}`);
}

// Update Headplane Config
updateYaml(hpConfigPathIn, hpConfigPathOut, (doc) => {
  const getSet = (pathArr, val) => {
    if (val !== undefined && val !== '') {
      doc.setIn(pathArr, val);
    }
  };
  
  console.log(`Writing Headplane Config:`);
  console.log(` - server.base_url: ${process.env.HEADPLANE_SERVER__BASE_URL}`);
  console.log(` - headscale.url: ${process.env.HEADSCALE_URL}`);
  console.log(` - headscale.public_url: ${process.env.HEADSCALE_PUBLIC_URL}`);

  getSet(['server', 'cookie_secret'], process.env.HEADPLANE_SERVER__COOKIE_SECRET);
  getSet(['server', 'info_secret'], process.env.HEADPLANE_SERVER__INFO_SECRET);
  getSet(['server', 'base_url'], process.env.HEADPLANE_SERVER__BASE_URL);
  getSet(['headscale', 'url'], process.env.HEADSCALE_URL);
  getSet(['headscale', 'api_key'], process.env.HEADSCALE_API_KEY);
  getSet(['headscale', 'public_url'], process.env.HEADSCALE_PUBLIC_URL);
  
  // Also update the headscale config path to point to the shared volume
  getSet(['headscale', 'config_path'], '/shared/headscale_config.yaml');
  
  if (process.env.INTEGRATION_AGENT__ENABLED === 'true') {
    doc.setIn(['integration', 'agent', 'enabled'], true);
  }
  
  getSet(['integration', 'agent', 'host_name'], process.env.INTEGRATION_AGENT__HOST_NAME);
});

// Update Headscale Config
updateYaml(hsConfigPathIn, hsConfigPathOut, (doc) => {
  const getSet = (pathArr, val) => {
    if (val !== undefined && val !== '') {
      doc.setIn(pathArr, val);
    }
  };

  getSet(['server_url'], process.env.SERVER_URL);
  getSet(['acme_email'], process.env.ACME_EMAIL);
  getSet(['tls_letsencrypt_hostname'], process.env.TLS_LETSENCRYPT_HOSTNAME);
});

async function probeHeadscale(url) {
  if (!url) return;
  console.log(`Probing Headscale API at: ${url}/swagger.json ...`);
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(`${url}/swagger.json`, { signal: controller.signal });
    clearTimeout(id);
    console.log(`Probe Result: Status ${resp.status} ${resp.statusText}`);
    console.log(`Headers: ${JSON.stringify(Object.fromEntries(resp.headers))}`);
  } catch (e) {
    console.error(`Probe Failed: ${e.message}`);
  }
}

await probeHeadscale(process.env.HEADSCALE_URL);

console.log("Configuration updated successfully.");
