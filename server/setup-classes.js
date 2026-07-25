require('dotenv').config();
const mongoose = require('mongoose');
const Class = require('./models/Class');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function setupClasses() {
  try {
    console.log('🏫 Setting up 6-class system...');
    
    // Clear existing classes
    await Class.deleteMany({});
    console.log('🗑️ Cleared existing classes');
    
    // Create 6 classes
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
    console.log('✅ Created 6 classes:');
    
    createdClasses.forEach(cls => {
      console.log(`   📚 ${cls.name} (Level ${cls.level}, Year ${cls.year})`);
    });
    
    console.log('\n🎓 Class progression system:');
    console.log('   Year 1: Class 1 → Class 2');
    console.log('   Year 2: Class 3 → Class 4');
    console.log('   Year 3: Class 5 → Class 6 (Graduation)');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error setting up classes:', err);
    process.exit(1);
  }
}

setupClasses();
