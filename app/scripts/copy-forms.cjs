const fs = require('node:fs');
const path = require('node:path');

const formsSource = path.resolve(__dirname, '../../forms');
const formsDestination = path.resolve(__dirname, '../public/forms');

if (!fs.existsSync(formsSource)) throw new Error(`Forms directory not found: ${formsSource}`);
fs.rmSync(formsDestination, { recursive: true, force: true });
fs.mkdirSync(formsDestination, { recursive: true });

for (const entry of fs.readdirSync(formsSource, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const source = path.join(formsSource, entry.name);
  const schema = path.join(source, 'schema.json');
  const ui = path.join(source, 'ui.json');
  if (!fs.existsSync(schema) || !fs.existsSync(ui)) continue;
  const destination = path.join(formsDestination, entry.name);
  fs.mkdirSync(destination, { recursive: true });
  fs.copyFileSync(schema, path.join(destination, 'schema.json'));
  fs.copyFileSync(ui, path.join(destination, 'ui.json'));
}

console.log(`Copied forms to ${formsDestination}`);
