/**
 * Dump every collection in the configured MongoDB database to a single
 * Extended-JSON file (preserves ObjectIds, Dates, etc.).
 *
 * Usage:
 *   node scripts/db-dump.js [outfile]      # default: db-dump.json (repo root of Server)
 *   MONGO_URI=mongodb://... node scripts/db-dump.js my-dump.json
 *
 * Pair with scripts/db-restore.js to copy a local database onto another
 * environment (e.g. the Dockerised Mongo on the AWS box).
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { EJSON } = mongoose.mongo.BSON;

(async () => {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/smart-restaurant';
  const outFile = path.resolve(process.argv[2] || 'db-dump.json');

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  console.log(`connected to ${db.databaseName}`);

  const collections = await db.listCollections().toArray();
  const dump = {};
  for (const { name, type } of collections) {
    if (type && type !== 'collection') continue;       // skip views
    if (name.startsWith('system.')) continue;
    const docs = await db.collection(name).find({}).toArray();
    dump[name] = docs;
    console.log(`  ${name}: ${docs.length} docs`);
  }

  fs.writeFileSync(outFile, EJSON.stringify(dump, { relaxed: false }));
  console.log(`wrote ${outFile} (${collections.length} collections)`);
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
