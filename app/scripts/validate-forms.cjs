const fs = require('node:fs');
const path = require('node:path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const formsDirectory = path.resolve(__dirname, '../../forms');
const errors = [];
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
['photo', 'likert', 'gps', 'signature', 'qrcode', 'audio', 'video', 'select_file', 'sub-observation'].forEach(
  (format) => ajv.addFormat(format, true)
);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function resolveScope(schema, scope) {
  if (typeof scope !== 'string' || !scope.startsWith('#/')) return undefined;
  return scope.slice(2).split('/').reduce((node, key) => node?.[key], schema);
}

function validateUi(formName, schema, node) {
  if (Array.isArray(node)) return node.forEach((item) => validateUi(formName, schema, item));
  if (!node || typeof node !== 'object') return;
  if (node.type === 'Control' && resolveScope(schema, node.scope) === undefined) {
    errors.push(`${formName}: ui.json scope ${JSON.stringify(node.scope)} has no matching schema property`);
  }
  Object.values(node).forEach((value) => validateUi(formName, schema, value));
}

for (const entry of fs.readdirSync(formsDirectory, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const formDirectory = path.join(formsDirectory, entry.name);
  const schemaPath = path.join(formDirectory, 'schema.json');
  const uiPath = path.join(formDirectory, 'ui.json');
  if (!fs.existsSync(schemaPath) || !fs.existsSync(uiPath)) {
    errors.push(`${entry.name}: each form needs schema.json and ui.json`);
    continue;
  }
  try {
    const schema = readJson(schemaPath);
    const ui = readJson(uiPath);
    if (schema.$schema !== 'http://json-schema.org/draft-07/schema#') errors.push(`${entry.name}: schema must declare draft-07`);
    if (schema.type !== 'object' || !schema.properties) errors.push(`${entry.name}: schema root must be an object with properties`);
    ajv.compile(schema);
    validateUi(entry.name, schema, ui);
  } catch (error) {
    errors.push(`${entry.name}: ${error.message}`);
  }
}

if (errors.length) {
  errors.forEach((error) => console.error(`error    ${error}`));
  process.exit(1);
}
console.log('All forms passed schema and UI-scope validation.');
