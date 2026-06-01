const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/nanzip').then(async () => {
  const collections = await mongoose.connection.db.collections();
  for (let c of collections) {
    const all = await c.find({}).toArray();
    for (let d of all) {
      if (JSON.stringify(d).includes('Instacart')) {
        console.log('Found Instacart in', c.collectionName, d._id);
      }
    }
  }
  console.log('Done');
  process.exit(0);
});
