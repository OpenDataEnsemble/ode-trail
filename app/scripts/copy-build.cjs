const fs = require('node:fs');
const path = require('node:path');

const source = path.resolve(__dirname, '../dist');
const destination = path.resolve(__dirname, '../../app-bundles/app');

if (!fs.existsSync(source)) throw new Error(`Build output directory not found: ${source}`);
fs.rmSync(destination, { recursive: true, force: true });
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.cpSync(source, destination, { recursive: true });
console.log(`Copied build output to ${destination}`);
