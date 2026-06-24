const mongoose = require('mongoose');

async function test() {
  await mongoose.connect('mongodb+srv://vishal211130cse_db_user:c6rLopYJBtPsK5go@blaze.fahlhq4.mongodb.net/Blaze?appName=Blaze');
  const db = mongoose.connection.db;
  const users = await db.collection('common_users').find({ _id: new mongoose.Types.ObjectId('6a1accb3734a8cea0bc7b315') }).toArray();
  console.log("Users with ID:", users);
  
  process.exit(0);
}
test().catch(console.error);
