/**
 * Restore a dump produced by scripts/db-dump.js into the configured MongoDB
 * database. Each collection in the dump is DROPPED and replaced with the
 * dumped documents (so the target ends up identical to the source).
 *
 * Usage:
 *   node scripts/db-restore.js [infile]     # default: db-dump.json
 *   MONGO_URI=mongodb://... node scripts/db-restore.js my-dump.json
 *
 * Collections that exist in the target but not in the dump are left untouched.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { EJSON } = mongoose.mongo.BSON;

(async () => {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/smart-restaurant';
  const inFile = path.resolve(process.argv[2] || 'db-dump.json');

  const dump = EJSON.parse(fs.readFileSync(inFile, 'utf8'), { relaxed: false });

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  console.log(`connected to ${db.databaseName}; restoring from ${inFile}`);

  for (const [name, docs] of Object.entries(dump)) {
    await db.collection(name).deleteMany({});
    if (docs.length) await db.collection(name).insertMany(docs, { ordered: false });
    console.log(`  ${name}: ${docs.length} docs`);
  }

  console.log('restore complete');
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
