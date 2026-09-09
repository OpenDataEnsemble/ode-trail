const fs = require('node:fs');
const path = require('node:path');
const AdmZip = require('adm-zip');

const appDirectory = path.resolve(__dirname, '../../app-bundles/app');
const outputDirectory = path.resolve(__dirname, '../../app-bundles');
const version = require('../package.json').version;

if (!fs.existsSync(appDirectory)) throw new Error('Build the app before creating a ZIP.');
const zip = new AdmZip();
zip.addLocalFolder(appDirectory, 'app');
const output = path.join(outputDirectory, `bundle-v${version}.zip`);
zip.writeZip(output);
console.log(`Bundle created: ${output}`);
