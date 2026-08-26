#!/usr/bin/env node
// Builds an app-bundle zip for uploading to Synkronus.
//
// ODE Trail has no compile step (plain HTML/CSS/JS) — this script just
// stages app/ plus the JSON parts of forms/ into the app/... layout
// Synkronus expects, then zips it.
//
// Pure Node, no npm dependencies, so it runs the same on Windows/Mac/Linux:
//   node scripts/build-bundle.js

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.resolve(__dirname, '..');
const appSrc = path.join(root, 'app');
const formsSrc = path.join(root, 'forms');
const bundleDir = path.join(root, 'app-bundles');

// ---------------------------------------------------------------------
// Collect files: [{ zipPath, data }], zipPath always forward-slashed
// ---------------------------------------------------------------------

function collectFiles() {
  var files = [];

  (function walkApp(dir, prefix) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
      var full = path.join(dir, entry.name);
      var zipPath = prefix + '/' + entry.name;
      if (entry.isDirectory()) {
        walkApp(full, zipPath);
      } else {
        files.push({ zipPath: zipPath, data: fs.readFileSync(full) });
      }
    });
  })(appSrc, 'app');

  // Forms: one folder per form, JSON files only (schema.json, ui.json,
  // ext.json). Anything else (READMEs, .code-workspace files, helper JS)
  // is left out, since the server rejects non-JSON form files.
  if (fs.existsSync(formsSrc)) {
    fs.readdirSync(formsSrc, { withFileTypes: true }).forEach(function (entry) {
      if (!entry.isDirectory()) return;
      var formDir = path.join(formsSrc, entry.name);
      fs.readdirSync(formDir, { withFileTypes: true }).forEach(function (file) {
        if (file.isDirectory() || path.extname(file.name) !== '.json') return;
        files.push({
          zipPath: 'app/forms/' + entry.name + '/' + file.name,
          data: fs.readFileSync(path.join(formDir, file.name)),
        });
      });
    });
  }

  return files;
}

// ---------------------------------------------------------------------
// Minimal ZIP writer (store + deflate), no dependencies.
// ---------------------------------------------------------------------

var CRC_TABLE = (function () {
  var table = new Uint32Array(256);
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  var crc = 0xffffffff;
  for (var i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  var time =
    ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((date.getSeconds() >> 1) & 0x1f);
  var dosDate =
    (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0xf) << 5) | (date.getDate() & 0x1f);
  return { time: time, date: dosDate };
}

function buildZip(files) {
  var localChunks = [];
  var centralChunks = [];
  var offset = 0;
  var now = dosDateTime(new Date());

  files.forEach(function (file) {
    var nameBuf = Buffer.from(file.zipPath, 'utf8');
    var crc = crc32(file.data);
    var deflated = zlib.deflateRawSync(file.data);
    var useDeflate = deflated.length < file.data.length;
    var method = useDeflate ? 8 : 0;
    var storedData = useDeflate ? deflated : file.data;

    var localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(now.time, 10);
    localHeader.writeUInt16LE(now.date, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(storedData.length, 18);
    localHeader.writeUInt32LE(file.data.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localChunks.push(localHeader, nameBuf, storedData);

    var centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0, 8); // flags
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(now.time, 12);
    centralHeader.writeUInt16LE(now.date, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(storedData.length, 20);
    centralHeader.writeUInt32LE(file.data.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra length
    centralHeader.writeUInt16LE(0, 32); // comment length
    centralHeader.writeUInt16LE(0, 34); // disk number
    centralHeader.writeUInt16LE(0, 36); // internal attrs
    centralHeader.writeUInt32LE(0, 38); // external attrs
    centralHeader.writeUInt32LE(offset, 42);

    centralChunks.push(centralHeader, nameBuf);

    offset += localHeader.length + nameBuf.length + storedData.length;
  });

  var centralStart = offset;
  var centralBuf = Buffer.concat(centralChunks);
  var centralSize = centralBuf.length;

  var eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk with central dir
  eocd.writeUInt16LE(files.length, 8); // entries on this disk
  eocd.writeUInt16LE(files.length, 10); // total entries
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralStart, 16);
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([Buffer.concat(localChunks), centralBuf, eocd]);
}

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------

function main() {
  var config = JSON.parse(fs.readFileSync(path.join(appSrc, 'app.config.json'), 'utf8'));
  var version = config.version;
  var zipName = 'bundle-v' + version + '.zip';
  var zipPath = path.join(bundleDir, zipName);

  if (!fs.existsSync(bundleDir)) fs.mkdirSync(bundleDir, { recursive: true });

  var files = collectFiles();
  var zipBuffer = buildZip(files);
  fs.writeFileSync(zipPath, zipBuffer);

  console.log('Bundle created: ' + zipPath);
  console.log('  Files: ' + files.length);
  console.log('  Size: ' + (zipBuffer.length / 1024).toFixed(2) + ' KB');
}

main();
