require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Class = require('./models/Class');

async function checkCoPrincipal() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);

    // Find all co-principals
    const coPrincipals = await User.find({ role: 'co-principal' });
    
    console.log('\n📋 Co-Principals found:');
    for (const coP of coPrincipals) {
      console.log(`\n👤 ${coP.fullName} (${coP.username})`);
      console.log(`   Assigned Level: ${coP.assignedlevel}`);
      
      if (coP.assignedlevel) {
        // Calculate which year they should see
        let year;
        if (coP.assignedlevel <= 2) {
          year = 1;
        } else if (coP.assignedlevel <= 4) {
          year = 2;
        } else {
          year = 3;
        }
        
        console.log(`   Should see Year: ${year}`);
        
        // Get classes they can see
        const classes = await Class.find({ year: year });
        console.log(`   Can see ${classes.length} classes:`);
        classes.forEach(c => {
          console.log(`      - ${c.name} (Level ${c.level})`);
        });
      } else {
        console.log('   ⚠️  No assignedlevel set!');
      }
    }

    // Also show all classes with their years
    console.log('\n\n📚 All Classes:');
    const allClasses = await Class.find().sort({ level: 1 });
    allClasses.forEach(cls => {
      console.log(`   ${cls.name} - Level ${cls.level}, Year ${cls.year}`);
    });

    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkCoPrincipal();

