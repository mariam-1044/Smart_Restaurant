const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

function withInMemoryMongo({ dropBetween = true } = {}) {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterEach(async () => {
    if (!dropBetween) return;
    const collections = mongoose.connection.collections;
    for (const key of Object.keys(collections)) {
      await collections[key].deleteMany({});
    }
  });

  afterAll(async () => {
    try {
      await mongoose.disconnect();
    } finally {
      if (mongoServer) await mongoServer.stop();
    }
  });
}

module.exports = { withInMemoryMongo };