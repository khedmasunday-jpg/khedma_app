require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Class = require('./models/Class');

async function checkCoPrincipal() {
  try {    await mongoose.connect(process.env.MONGO_URI);

    const coPrincipals = await User.find({ role: 'co-principal' });    for (const coP of coPrincipals) {      
      if (coP.assignedlevel) {
        
        let year;
        if (coP.assignedlevel <= 2) {
          year = 1;
        } else if (coP.assignedlevel <= 4) {
          year = 2;
        } else {
          year = 3;
        }        
        
        const classes = await Class.find({ year: year });        classes.forEach(c => {        });
      } else {      }
    }

        const allClasses = await Class.find().sort({ level: 1 });
    allClasses.forEach(cls => {    });

    await mongoose.disconnect();  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkCoPrincipal();

