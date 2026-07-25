// One-off script to remove an accidental unique index on students.classname
// Usage: set MONGO_URI="mongodb://..."; node server/scripts/drop_student_classname_index.js

const mongoose = require('mongoose');

const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/khedma_app';

(async () => {
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = mongoose.connection.db;
    const indexes = await db.collection('students').indexes();
    console.log('Existing indexes on students collection:');
    console.dir(indexes, { depth: null });

    const idx = indexes.find(i => i.key && i.key.classname);
    if (!idx) {
      console.log('No index found on classname; nothing to do.');
      process.exit(0);
    }

    if (!idx.unique) {
      console.log('Index on classname exists but is not unique. Nothing to do.');
      process.exit(0);
    }

    console.log('Found unique index on classname. Dropping it now...');
    await db.collection('students').dropIndex(idx.name);
    console.log('Dropped index', idx.name);
    process.exit(0);
  } catch (err) {
    console.error('Error while checking/dropping index:', err);
    process.exit(1);
  }
})();
