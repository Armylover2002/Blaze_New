const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/Blaze').then(() => {
  return mongoose.connection.db.collection('quick_products').find({ name: { $in: ['B12', 'Paracetamol'] } }).toArray();
}).then(docs => {
  console.log(JSON.stringify(docs.map(d => ({name: d.name, stock: d.stock, variants: d.variants})), null, 2));
  process.exit();
}).catch(console.error);
