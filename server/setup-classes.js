require('dotenv').config();
const mongoose = require('mongoose');
const Class = require('./models/Class');

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function setupClasses() {
  try {    
    
    await Class.deleteMany({});    
    
    const classes = [
      { name: 'الشاروبيم', level: 1, year: 1 },
      { name: 'السيرافيم', level: 2, year: 1 },
      { name: 'الملاك رفائيل', level: 3, year: 2 },
      { name: 'الملاك ميخائيل', level: 4, year: 2 },
      { name: 'الملاك سوريال', level: 5, year: 3 },
      { name: 'الملاك غبريال', level: 6, year: 3 },
    ];
    
    const createdClasses = [];
    for (const clsData of classes) {
      const cls = new Class(clsData);
      await cls.save();
      createdClasses.push(cls);
    }    
    createdClasses.forEach(cls => {    });    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error setting up classes:', err);
    process.exit(1);
  }
}

setupClasses();
