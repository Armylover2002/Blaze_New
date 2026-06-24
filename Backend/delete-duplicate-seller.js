
import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "dns";

dotenv.config();

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

const Seller = mongoose.model(
  "Seller",
  new mongoose.Schema(
    {
      _id: mongoose.Schema.Types.ObjectId,
      name: String,
      shopName: String,
      phone: String,
      phoneDigits: String,
      phoneLast10: String,
      approved: Boolean,
      approvalStatus: String,
    },
    {
      collection: "quick_sellers",
    }
  )
);

async function deleteDuplicateSeller() {
  try {
    // Set DNS servers to public DNS (Google & Cloudflare) to avoid local DNS/SRV resolution failures
    try {
      dns.setServers(["8.8.8.8", "1.1.1.1"]);
    } catch (dnsErr) {
      console.warn(`Failed to set DNS servers: ${dnsErr.message}`);
    }

    await mongoose.connect(uri, {
      family: 4, // Force IPv4
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
    });
    console.log("Connected to MongoDB");

    // Delete the draft seller with name "Seller 7233"
    const result = await Seller.deleteOne({
      name: "Seller 7233",
      approvalStatus: "draft",
    });

    console.log(`Deleted ${result.deletedCount} duplicate seller`);

    // Backfill phoneDigits and phoneLast10 for the "Maa Durga" seller
    const updated = await Seller.updateOne(
      { shopName: "Maa Durga" },
      {
        phoneDigits: "7999267233",
        phoneLast10: "7999267233",
      }
    );

    console.log(`Updated ${updated.modifiedCount} seller with phoneDigits/phoneLast10`);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

deleteDuplicateSeller();
