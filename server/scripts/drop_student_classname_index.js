

const mongoose = require('mongoose');

const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/khedma_app';

(async () => {
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = mongoose.connection.db;
    const indexes = await db.collection('students').indexes();    console.dir(indexes, { depth: null });

    const idx = indexes.find(i => i.key && i.key.classname);
    if (!idx) {      process.exit(0);
    }

    if (!idx.unique) {      process.exit(0);
    }    await db.collection('students').dropIndex(idx.name);    process.exit(0);
  } catch (err) {
    console.error('Error while checking/dropping index:', err);
    process.exit(1);
  }
})();
