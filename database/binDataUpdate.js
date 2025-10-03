const mongoose = require("mongoose");
const fs = require("fs");
const csv = require("csv-parser");
const connectDB = require("./dbSetup");

const collectionName = "items";

async function uploadBinsToDatabase() {
  try {
    // Connect to MongoDB using the same method as addNewPods.js
    console.log("🔌 Connecting to database...");
    await connectDB();
    console.log("✅ Connected successfully to MongoDB");

    // Access database and collection
    const db = mongoose.connection.db;
    const collection = db.collection(collectionName);

    // Clear existing data (optional - remove this if you want to append)
    console.log("Clearing existing items collection...");
    await collection.deleteMany({});
    console.log("Existing data cleared");

    // Read and parse CSV file
    const binsData = [];
    console.log("📄 Reading CSV file...");
    await new Promise((resolve, reject) => {
      fs.createReadStream("bins.csv")
        .pipe(csv())
        .on("data", (row) => {
          // Convert CSV row to database document
          const binDocument = {
            uBinId: row.uuid,
            podBarcode: row.podBarcode.split(" ")[0],
            binId: row.binID,
          };
          binsData.push(binDocument);
        })
        .on("end", () => {
          console.log(`📊 Parsed ${binsData.length} records from CSV`);
          resolve();
        })
        .on("error", (error) => {
          reject(error);
        });
    });

    // Insert data in batches for better performance
    const batchSize = 1000;
    let insertedCount = 0;

    console.log("📥 Starting batch uploads...");
    for (let i = 0; i < binsData.length; i += batchSize) {
      const batch = binsData.slice(i, i + batchSize);
      const result = await collection.insertMany(batch);
      insertedCount += result.insertedCount;
      console.log(
        `Inserted batch: ${insertedCount}/${binsData.length} records`
      );
    }

    console.log(
      `\n✅ Successfully uploaded ${insertedCount} bin records to database`
    );

    // Verify the upload
    const count = await collection.countDocuments();
    console.log(`\n📊 Total records in items collection: ${count}`);

    // Show sample data
    console.log("\n🔍 Sample records:");
    const sampleRecords = await collection.find({}).limit(5).toArray();
    sampleRecords.forEach((record, index) => {
      console.log(
        `${index + 1}. UUID: ${record.uuid}, Pod: ${
          record.podBarcode
        }, BinId: ${record.binId}`
      );
    });
  } catch (error) {
    console.error("❌ Error uploading bins to database:", error);
  } finally {
    // Close connection using mongoose
    mongoose.connection.close();
    console.log("\n🔌 Database connection closed");
  }
}

// Check if CSV file exists
if (!fs.existsSync("bins.csv")) {
  console.error("❌ Error: bins.csv file not found in current directory");
  console.log(
    "Please make sure the bins.csv file is in the same directory as this script"
  );
  process.exit(1);
}

// Run the upload function
console.log("🚀 Starting bins data upload to MongoDB...\n");
uploadBinsToDatabase()
  .then(() => {
    console.log("✅ Upload completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Upload failed:", error);
    process.exit(1);
  });
