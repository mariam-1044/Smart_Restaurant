require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const connectDB = require('../src/infrastructure/config/db');

(async () => {
  await connectDB();
  const Notification = mongoose.model('Notification') || require('../src/domain/models/Notification');
  const cursor = Notification.collection.find({});
  let migrated = 0;
  for await (const doc of cursor) {
    const update = {};
    if (doc.read !== undefined) {
      update.readByAdmin   = doc.read === true;
      update.readByAdminAt = doc.read === true ? doc.readAt || null : null;
      update.readByStaff   = doc.read === true;
      update.readByStaffAt = doc.read === true ? doc.readAt || null : null;
    }
    if (doc.lastSeenAt === undefined) update.lastSeenAt = doc.createdAt || new Date();
    const unset = {};
    if ('read' in doc)   unset.read = '';
    if ('readAt' in doc) unset.readAt = '';

    if (Object.keys(update).length || Object.keys(unset).length) {
      await Notification.collection.updateOne(
        { _id: doc._id },
        { $set: update, $unset: unset }
      );
      migrated += 1;
    }
  }
  console.log(`Migrated ${migrated} notifications.`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });