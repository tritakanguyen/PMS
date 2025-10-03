const mongoose = require("mongoose");
const fs = require("fs");
const csv = require("csv-parser");
const connectDB = require("./dbSetup");

async function updateItemsFromCSV() {
  try {
    // Connect to MongoDB
    console.log("🔌 Connecting to database...");
    await connectDB();
    console.log("✅ Connected successfully to MongoDB");

    const db = mongoose.connection.db;
    const podItemsCollection = db.collection("podItems");

    console.log("\n📊 Starting podItems collection update from CSV...");

    // Read and process CSV data
    const csvData = [];
    const csvFilePath = "./items.csv";

    // Check if CSV file exists
    if (!fs.existsSync(csvFilePath)) {
      throw new Error(`CSV file not found: ${csvFilePath}`);
    }

    console.log("📁 Reading CSV file...");

    // Read CSV data into memory first
    await new Promise((resolve, reject) => {
      fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on("data", (row) => {
          // Clean up the data - handle N/A and none values as null
          const cleanValue = (value) => {
            if (
              !value ||
              value.trim() === "" ||
              value.trim() === "N/A" ||
              value.trim().toLowerCase() === "none"
            ) {
              return null;
            }
            return value.trim();
          };

          // Check if uBinId is a real/valid value (not N/A, none, blank)
          const isValidUBinId = (uBinId) => {
            if (!uBinId || uBinId.trim() === "") return false;
            const cleaned = uBinId.trim();
            if (
              cleaned === "N/A" ||
              cleaned.toLowerCase() === "none" ||
              cleaned.toLowerCase() === "null" ||
              cleaned === "0"
            ) {
              return false;
            }
            // Valid uBinId should have some meaningful content (like P-6-R326Q053 pattern)
            return cleaned.length > 3;
          };

          // Handle podBarcode with space splitting
          let cleanedPodBarcode = cleanValue(row.podBarcode);
          if (cleanedPodBarcode && cleanedPodBarcode.includes(" ")) {
            cleanedPodBarcode = cleanedPodBarcode.split(" ")[0];
          }

          const cleanRow = {
            sku: cleanValue(row.sku),
            uBinId: cleanValue(row.uBinId),
            podBarcode: cleanedPodBarcode,
            hasValidUBinId: isValidUBinId(cleanValue(row.uBinId)),
          };
          csvData.push(cleanRow);
        })
        .on("end", () => {
          console.log(`📦 Loaded ${csvData.length} records from CSV`);
          resolve();
        })
        .on("error", reject);
    });

    let totalProcessed = 0;
    let totalSkipped = 0;
    let totalPodItemsInserted = 0;
    let totalPodItemsUpdated = 0;

    console.log("\n🔄 Processing CSV records...");

    for (const csvRow of csvData) {
      totalProcessed++;

      if (totalProcessed % 1000 === 0) {
        console.log(
          `📈 Processed ${totalProcessed}/${csvData.length} records...`
        );
      }

      // Skip rows with empty SKU
      if (!csvRow.sku) {
        totalSkipped++;
        continue;
      }

      try {
        // Process podItems collection for items with valid uBinId
        if (csvRow.hasValidUBinId && csvRow.uBinId) {
          try {
            // Check if item already exists in podItems collection
            const existingPodItem = await podItemsCollection.findOne({
              sku: csvRow.sku,
            });

            if (existingPodItem) {
              // Update existing podItem if uBinId is different
              if (csvRow.uBinId !== existingPodItem.uBinId) {
                await podItemsCollection.updateOne(
                  { sku: csvRow.sku },
                  {
                    $set: {
                      uBinId: csvRow.uBinId,
                      updatedAt: new Date(),
                    },
                  }
                );
                totalPodItemsUpdated++;
              }
            } else {
              // Insert new podItem
              const newPodItem = {
                sku: csvRow.sku,
                uBinId: csvRow.uBinId,
                quantity: 1,
                status: "available",
                updatedAt: new Date(),
                user: null,
              };

              await podItemsCollection.insertOne(newPodItem);
              totalPodItemsInserted++;
            }
          } catch (podItemError) {
            console.error(
              `❌ Error processing podItem for SKU ${csvRow.sku}:`,
              podItemError.message
            );
          }
        }
      } catch (itemError) {
        console.error(
          `❌ Error processing SKU ${csvRow.sku}:`,
          itemError.message
        );
        totalSkipped++;
      }
    }

    console.log("\n🎯 Update Summary:");
    console.log(`📊 Total records processed: ${totalProcessed}`);
    console.log(`⏭️  Records skipped: ${totalSkipped}`);
    console.log(`🎯 PodItems inserted: ${totalPodItemsInserted}`);
    console.log(`🔄 PodItems updated: ${totalPodItemsUpdated}`);

    // Get final collection statistics
    const totalPodItemsInDB = await podItemsCollection.countDocuments();
    console.log(`\n📈 Final podItems collection count: ${totalPodItemsInDB}`);

    // Show sample podItems records
    console.log("\n🔍 Sample podItems records (with valid uBinId):");
    const samplePodItems = await podItemsCollection.find({}).limit(3).toArray();
    samplePodItems.forEach((record, index) => {
      console.log(
        `${index + 1}. SKU: ${record.sku}, uBinId: ${record.uBinId}, Status: ${
          record.status
        }`
      );
    });

    console.log("\n✅ PodItems update completed successfully!");
  } catch (error) {
    console.error("❌ Error updating podItems from CSV:", error);
    throw error;
  } finally {
    // Close connection
    mongoose.connection.close();
    console.log("\n🔌 Database connection closed");
  }
}

// Run the update function
console.log("🚀 Starting podItems collection update from CSV...\n");
updateItemsFromCSV()
  .then(() => {
    console.log("✅ Update process completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Update process failed:", error);
    process.exit(1);
  });
