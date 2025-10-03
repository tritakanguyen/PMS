const mongoose = require("mongoose");
const connectDB = require("./dbSetup");

async function clearSkuValuesFromItems() {
  try {
    // Connect to MongoDB
    console.log("🔌 Connecting to database...");
    await connectDB();
    console.log("✅ Connected successfully to MongoDB");

    const db = mongoose.connection.db;
    const itemsCollection = db.collection("items");

    console.log("\n📊 Starting items collection sku value clearing process...");

    // Get all items
    const items = await itemsCollection.find({}).toArray();
    console.log(`📦 Found ${items.length} items to process`);

    let totalItemsUpdated = 0;
    let totalSkuValuesCleared = 0;

    for (const item of items) {
      console.log(`\n🔍 Processing item: ${item._id}`);
      let itemUpdated = false;

      // Clear sku field value if it exists and has a value
      if (item.sku !== undefined && item.sku !== null && item.sku !== "") {
        const originalSkuValue = item.sku;
        item.sku = ""; // Clear the value but keep the field
        itemUpdated = true;
        totalSkuValuesCleared++;
        console.log(
          `    🧹 Cleared sku value ("${originalSkuValue}") from item: ${item._id}`
        );
      }

      // Update the item in database if sku value was cleared
      if (itemUpdated) {
        await itemsCollection.replaceOne({ _id: item._id }, item);
        console.log(`  ✅ Updated item ${item._id} in database`);
        totalItemsUpdated++;
      } else {
        console.log(`  ⏭️  No sku value to clear in item ${item._id}`);
      }
    }

    console.log("\n🎯 Cleanup Summary:");
    console.log(`✅ Items updated: ${totalItemsUpdated}/${items.length}`);
    console.log(`✅ Total sku values cleared: ${totalSkuValuesCleared}`);

    // Create unique index on uBinId field
    console.log("\n🔧 Creating unique index on uBinId field...");
    try {
      // First, check existing indexes
      const existingIndexes = await itemsCollection.listIndexes().toArray();
      console.log("📋 Existing indexes:");
      existingIndexes.forEach((index) => {
        console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
      });

      // Check if uBinId unique index already exists
      const uBinIdIndexExists = existingIndexes.some(
        (index) => index.name === "uBinId_1" && index.unique === true
      );

      if (uBinIdIndexExists) {
        console.log("✅ uBinId unique index already exists!");
      } else {
        // Create unique index on uBinId field
        await itemsCollection.createIndex(
          { uBinId: 1 },
          {
            unique: true,
            name: "uBinId_unique",
            sparse: true, // Allow multiple null/undefined values
          }
        );
        console.log("✅ Successfully created unique index on uBinId field!");
      }
    } catch (indexError) {
      if (indexError.code === 11000) {
        console.log(
          "⚠️  Cannot create unique index due to duplicate uBinId values!"
        );
        console.log("🔍 Finding duplicate uBinId values...");

        // Find duplicates
        const duplicates = await itemsCollection
          .aggregate([
            { $match: { uBinId: { $exists: true, $ne: null, $ne: "" } } },
            {
              $group: {
                _id: "$uBinId",
                count: { $sum: 1 },
                docs: { $push: "$$ROOT" },
              },
            },
            { $match: { count: { $gt: 1 } } },
          ])
          .toArray();

        if (duplicates.length > 0) {
          console.log(`📊 Found ${duplicates.length} duplicate uBinId values:`);
          duplicates.slice(0, 5).forEach((dup, index) => {
            console.log(
              `  ${index + 1}. uBinId: "${dup._id}" (${dup.count} documents)`
            );
          });
          console.log(
            "❗ Please resolve duplicate uBinId values before creating unique index"
          );
        }
      } else {
        console.error("❌ Error creating unique index:", indexError.message);
      }
    }

    // Verify cleanup - check if any sku fields still have values
    console.log("\n🔍 Verification: Checking for remaining sku values...");
    const remainingSkuValues = await itemsCollection.findOne({
      sku: { $exists: true, $ne: "", $ne: null },
    });

    if (remainingSkuValues) {
      console.log("⚠️  Warning: Some sku fields still have values!");
      console.log(`Sample: ${JSON.stringify(remainingSkuValues.sku)}`);
    } else {
      console.log("✅ Success: All sku field values have been cleared!");
    }
  } catch (error) {
    console.error("❌ Error clearing sku values:", error);
  } finally {
    // Close connection
    mongoose.connection.close();
    console.log("\n🔌 Database connection closed");
  }
}

// Run the update function
console.log("🚀 Starting items collection sku value clearing...\n");
clearSkuValuesFromItems()
  .then(() => {
    console.log("✅ Cleanup completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Cleanup failed:", error);
    process.exit(1);
  });
