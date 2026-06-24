const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://vishal211130cse_db_user:c6rLopYJBtPsK5go@blaze.fahlhq4.mongodb.net/Blaze?appName=Blaze";
const client = new MongoClient(uri);
async function run() {
  try {
    await client.connect();
    const database = client.db('Blaze');
    const products = database.collection('quick_products');
    const query = { name: { $in: ['B12', 'Paracetamol'] } };
    const result = await products.find(query).toArray();
    console.log(JSON.stringify(result.map(d => ({_id: d._id, name: d.name, stock: d.stock, variants: d.variants, sellerId: d.sellerId})), null, 2));
  } finally {
    await client.close();
  }
}
run().catch(console.dir);
