#!/usr/bin/env node
// Structural checks on forms/ before a bundle goes anywhere near Synkronus.
//
// Deliberately dependency-free (same as build-bundle.js) so it runs on a
// fresh checkout with nothing installed. It is not a full draft-07 validator
// — it catches the mistakes that actually break a bundle: unparseable JSON,
// a missing schema/ui pair, and a UI scope pointing at a property that
// doesn't exist.
//
//   node scripts/validate-forms.js

'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const formsDir = path.join(root, 'forms');

const problems = [];
const warnings = [];

function fail(form, message) {
  problems.push(form + ': ' + message);
}

function warn(form, message) {
  warnings.push(form + ': ' + message);
}

function readJson(form, file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    fail(form, 'invalid JSON in ' + path.basename(file) + ' — ' + err.message);
    return null;
  }
}

// "#/properties/foo" -> "foo". Nested scopes are resolved one level at a time.
function resolveScope(schema, scope) {
  if (typeof scope !== 'string' || scope.indexOf('#/') !== 0) return undefined;
  const parts = scope.slice(2).split('/');
  let node = schema;
  for (const part of parts) {
    if (!node || typeof node !== 'object') return undefined;
    node = node[part];
  }
  return node;
}

function walkUi(form, schema, node) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach(function (child) {
      walkUi(form, schema, child);
    });
    return;
  }
  if (node.type === 'Control') {
    if (typeof node.scope !== 'string') {
      fail(form, 'Control without a scope');
    } else if (resolveScope(schema, node.scope) === undefined) {
      fail(form, 'ui.json scope "' + node.scope + '" has no matching schema property');
    }
  }
  Object.keys(node).forEach(function (key) {
    walkUi(form, schema, node[key]);
  });
}

function validateForm(form) {
  const dir = path.join(formsDir, form);
  const schemaPath = path.join(dir, 'schema.json');
  const uiPath = path.join(dir, 'ui.json');

  if (!fs.existsSync(schemaPath)) return fail(form, 'missing schema.json');
  if (!fs.existsSync(uiPath)) return fail(form, 'missing ui.json');

  const schema = readJson(form, schemaPath);
  const ui = readJson(form, uiPath);
  if (!schema || !ui) return;

  if (schema.$schema !== 'http://json-schema.org/draft-07/schema#') {
    warn(form, 'schema.json does not declare draft-07');
  }
  if (schema.type !== 'object') {
    fail(form, 'schema.json root type must be "object"');
  }

  const properties = schema.properties && typeof schema.properties === 'object' ? schema.properties : {};
  if (!Object.keys(properties).length) {
    fail(form, 'schema.json has no properties');
  }

  (schema.required || []).forEach(function (key) {
    if (!Object.prototype.hasOwnProperty.call(properties, key)) {
      fail(form, 'required field "' + key + '" is not defined in properties');
    }
  });

  // Every form in this app is stamped with the submitting account so that
  // progress and the leaderboard can be keyed on something stable.
  if (!properties.username) {
    warn(form, 'no "username" property — progress and leaderboard rely on it');
  }

  // Every form is also stamped with when it was filled in, so the event data
  // can be read as a timeline. `$now` is what makes the stamp survive a form
  // opened outside the app, straight from the Formulus forms list.
  const stamps = Object.keys(properties).filter(function (key) {
    return properties[key] && properties[key].format === 'date-time';
  });
  if (!stamps.length) {
    warn(form, 'no "date-time" property — submissions will have no timestamp');
  }
  stamps.forEach(function (key) {
    if (properties[key].default !== '$now') {
      warn(form, '"' + key + '" has no `"default": "$now"` — it is only stamped when opened from the app');
    }
  });

  walkUi(form, schema, ui);
}

function main() {
  if (!fs.existsSync(formsDir)) {
    console.error('No forms/ directory found at ' + formsDir);
    process.exit(1);
  }

  const forms = fs
    .readdirSync(formsDir, { withFileTypes: true })
    .filter(function (entry) {
      return entry.isDirectory();
    })
    .map(function (entry) {
      return entry.name;
    });

  if (!forms.length) {
    console.error('No form folders found in forms/');
    process.exit(1);
  }

  forms.forEach(validateForm);

  warnings.forEach(function (message) {
    console.warn('warning  ' + message);
  });

  if (problems.length) {
    problems.forEach(function (message) {
      console.error('error    ' + message);
    });
    console.error('\n' + problems.length + ' problem(s) in ' + forms.length + ' form(s).');
    process.exit(1);
  }

  console.log('All ' + forms.length + ' form(s) look structurally valid.');
}

main();
