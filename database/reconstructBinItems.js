const mongoose = require("mongoose");
const connectDB = require("./dbSetup");

async function reconstructBinItems() {
  try {
    console.log("🔌 Connecting to database...");
    await connectDB();
    const db = mongoose.connection.db;

    console.log("📊 Analyzing existing pod data...");
    // Get all pods with their bin data
    const pods = await db.collection("pods").find({}).toArray();
    console.log(`Found ${pods.length} pods to process`);

    // Clear existing bin items
    console.log("🗑️  Clearing existing bin items...");
    await db.collection("binitems").deleteMany({});

    const newBinItems = [];
    let totalItemsCreated = 0;

    // Process each pod
    for (const pod of pods) {
      console.log(`\n📦 Processing pod: ${pod.podBarcode}`);

      // Process each face
      for (const face of pod.podFace) {
        console.log(`  📋 Processing face: ${face.faceId}`);
        let faceItemCount = 0;

        // Process each bin
        for (const bin of face.bins) {
          const itemCount = bin.binItemCount || 0;

          if (itemCount > 0) {
            // Extract face letter from faceId (e.g., "H12-A" -> "a")
            const faceLetter =
              face.faceId.split("-")[1]?.toLowerCase() || "unknown";

            // Create new binId format: faceLetter_bin_columnrow (e.g., "a_bin_1a")
            const newBinId = `${faceLetter}_bin_${bin.binId}`;

            console.log(
              `    📦 Bin ${bin.binId} -> ${newBinId}: Creating ${itemCount} items`
            );

            // Create individual items for this bin
            for (let itemNum = 1; itemNum <= itemCount; itemNum++) {
              const binItem = {
                sku: `${pod.podBarcode}-${face.faceId}-${newBinId}-${itemNum}`,
                status: "available", // Use lowercase to match schema
                quantity: 1,
                binId: newBinId.toLowerCase(),
                faceId: face.faceId,
                podBarcode: pod.podBarcode,
                lastUpdated: new Date(),
              };

              newBinItems.push(binItem);
              faceItemCount++;
              totalItemsCreated++;
            }
          }
        }

        console.log(`  ✅ Face ${face.faceId}: ${faceItemCount} items created`);
      }
    }

    console.log(
      `\n💾 Inserting ${newBinItems.length} bin items into database...`
    );

    if (newBinItems.length > 0) {
      // Insert in batches to avoid memory issues
      const batchSize = 1000;
      for (let i = 0; i < newBinItems.length; i += batchSize) {
        const batch = newBinItems.slice(i, i + batchSize);
        await db.collection("binitems").insertMany(batch);
        console.log(
          `  ✅ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
            newBinItems.length / batchSize
          )}`
        );
      }
    }

    console.log(`\n🎯 Reconstruction completed successfully!`);
    console.log(`📊 Total items created: ${totalItemsCreated}`);
    console.log(`📊 Total pods processed: ${pods.length}`);

    // Verify the reconstruction
    console.log("\n🔍 Verification:");
    const verifyCount = await db.collection("binitems").countDocuments();
    console.log(`  Database now contains: ${verifyCount} bin items`);

    // Show sample items
    const sampleItems = await db
      .collection("binitems")
      .find({})
      .limit(5)
      .toArray();
    console.log("\n📋 Sample reconstructed items:");
    sampleItems.forEach((item, index) => {
      console.log(
        `  ${index + 1}. SKU: ${item.sku}, Bin: ${item.binId}, Status: ${
          item.status
        }`
      );
    });

    // Show statistics by pod
    console.log("\n📊 Items by pod:");
    const podStats = {};
    for (const pod of pods) {
      const count = await db
        .collection("binitems")
        .countDocuments({ podBarcode: pod.podBarcode });
      podStats[pod.podBarcode] = count;
      console.log(`  ${pod.podBarcode}: ${count} items`);
    }
  } catch (error) {
    console.error("❌ Error during reconstruction:", error.message);
    console.error(error.stack);
  } finally {
    mongoose.connection.close();
    console.log("\n🔌 Database connection closed");
  }
}

// Run the reconstruction
console.log("🚀 Starting BinItems Collection Reconstruction...");
console.log(
  "📝 Using template: [podBarcode-faceId-binId-itemId] for SKU values"
);
console.log("🎯 Preserving existing schema structure");
console.log("📊 Using binItemCount from pods collection\n");

reconstructBinItems();
