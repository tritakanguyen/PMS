const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const connectDB = require("./dbSetup");

// Define bin layouts for each pod type and face combination
const BIN_LAYOUTS = {
  "H12-A": { rows: "ABCDEFGH", columns: 3 }, // 8 rows × 3 columns = 24 bins
  "H12-C": { rows: "ABCDEFGH", columns: 3 }, // 8 rows × 3 columns = 24 bins
  "H11-A": { rows: "ABCDEFGHIJKLM", columns: 4 }, // 13 rows × 4 columns = 52 bins
  "H11-C": { rows: "ABCDEFGHIJKL", columns: 4 }, // 12 rows × 4 columns = 48 bins
  "H10-A": { rows: "ABCDEFGHIJKL", columns: 4 }, // 12 rows × 4 columns = 48 bins
  "H10-C": { rows: "ABCDEFGHIJK", columns: 4 }, // 11 rows × 4 columns = 44 bins
  "H8-A": { rows: "ABCDEFGHIJ", columns: 4 }, // 10 rows × 4 columns = 40 bins
  "H8-C": { rows: "ABCDEFGHIJK", columns: 4 }, // 11 rows × 4 columns = 44 bins
};

// Function to generate bins for a given faceId
function generateBinsForFaceId(faceId) {
  const layout = BIN_LAYOUTS[faceId];

  if (!layout) {
    console.log(`⚠️  Unknown faceId pattern: ${faceId}`);
    console.log(
      `📋 Available patterns: ${Object.keys(BIN_LAYOUTS).join(", ")}`
    );
    return [];
  }

  const bins = [];
  const rows = Array.from(layout.rows);

  for (const row of rows) {
    for (let col = 1; col <= layout.columns; col++) {
      bins.push({
        binId: `${row}${col}`,
        binItemCount: 0,
        binValidated: false,
        items: [],
      });
    }
  }

  console.log(
    `✅ Generated ${bins.length} bins for ${faceId} (${layout.rows.length} rows × ${layout.columns} columns)`
  );
  return bins;
}

async function addNewPodsFromCSV() {
  try {
    console.log("🔌 Connecting to database...");
    await connectDB();

    console.log("📄 Reading CSV file...");
    const csvPath = path.join(__dirname, "new-pods.csv");

    if (!fs.existsSync(csvPath)) {
      console.error("❌ CSV file 'new-pods.csv' not found!");
      console.log(
        "📋 Please create the file using the template: new-pods-template.csv"
      );
      return;
    }

    let csvContent = fs.readFileSync(csvPath, "utf8");

    // Remove BOM (Byte Order Mark) if present
    csvContent = csvContent.replace(/^\uFEFF/, "");

    console.log("🔍 Parsing CSV data...");
    const lines = csvContent.split("\n").filter((line) => line.trim());

    if (lines.length < 2) {
      console.error(
        "❌ CSV file must have at least header row and one data row!"
      );
      return;
    }

    // First row contains headers
    const headers = lines[0].split(",").map((header) => header.trim());
    console.log("📊 CSV Headers:", headers);

    // Expected headers - podStatus, faceId, gcu are now optional for name-only updates
    const requiredHeaders = ["podBarcode", "podName"];
    const optionalHeaders = ["podStatus", "faceId", "gcu", "bins"];
    const allExpectedHeaders = [...requiredHeaders, ...optionalHeaders];

    const hasRequiredHeaders = requiredHeaders.every((header) =>
      headers.includes(header)
    );

    if (!hasRequiredHeaders) {
      console.error(
        "❌ Missing required CSV headers! Required:",
        requiredHeaders
      );
      console.error("📋 Found:", headers);
      return;
    }

    // Check if this is a name-only update mode
    const hasLegacyFields =
      headers.includes("podStatus") &&
      headers.includes("faceId") &&
      headers.includes("gcu");

    if (hasLegacyFields) {
      console.log(
        "✅ CSV format valid. Bins will be auto-generated from faceId patterns."
      );
    } else {
      console.log(
        "✅ CSV format valid for name-only updates. Pod names will be corrected."
      );
    }

    const db = mongoose.connection.db;
    const podsToProcess = [];
    const errors = [];

    console.log(`📋 Processing ${lines.length - 1} pod records...`);

    // Process each data row
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(",").map((cell) => cell.trim());

      if (row.length < 2) {
        errors.push(
          `Row ${
            i + 1
          }: Insufficient columns (expected at least 2: podBarcode, podName)`
        );
        continue;
      }

      // Parse row data - get what's available
      const podBarcode = row[0] || "";
      const podName = row[1] || "";
      const podStatus = row[2] || "";
      const faceId = row[3] || "";
      const gcu = row[4] || "";
      const binsString = row[5] || "";

      // Validate required fields
      if (!podBarcode || !podName) {
        errors.push(
          `Row ${i + 1}: Missing required fields (podBarcode, podName)`
        );
        continue;
      }

      // Validate podBarcode format
      if (!/^HB\d{11}$/.test(podBarcode)) {
        errors.push(
          `Row ${
            i + 1
          }: Invalid podBarcode format '${podBarcode}' (must be HB + 11 digits)`
        );
        continue;
      }

      // Check if this is a name-only update (no face data)
      const isNameOnlyUpdate = !podStatus || !faceId || !gcu;

      if (isNameOnlyUpdate) {
        // For name-only updates, just store basic info
        console.log(`📝 Row ${i + 1}: Name-only update for ${podBarcode}`);
        podsToProcess.push({
          podBarcode,
          podName,
          nameOnlyUpdate: true,
        });
        continue;
      }

      // Full pod creation with face data - validate face-related fields
      if (!["in progress", "completed"].includes(podStatus)) {
        errors.push(
          `Row ${
            i + 1
          }: Invalid podStatus '${podStatus}' (must be 'in progress' or 'completed')`
        );
        continue;
      }

      // Validate faceId pattern
      if (!BIN_LAYOUTS[faceId]) {
        errors.push(
          `Row ${
            i + 1
          }: Unknown faceId pattern '${faceId}'. Available: ${Object.keys(
            BIN_LAYOUTS
          ).join(", ")}`
        );
        continue;
      }

      // Generate bins automatically based on faceId pattern
      let bins = [];

      if (binsString && binsString !== '""' && binsString.trim() !== "") {
        // If bins are manually specified, use them
        console.log(`📋 Row ${i + 1}: Using manual bin data for ${faceId}`);
        const binEntries = binsString.replace(/"/g, "").split(",");

        for (const binEntry of binEntries) {
          const [binId, itemCount] = binEntry.split(":");
          if (binId && itemCount !== undefined) {
            bins.push({
              binId: binId.trim(),
              binItemCount: parseInt(itemCount) || 0,
              binValidated: false,
              items: [],
            });
          }
        }
      } else {
        // Auto-generate bins based on faceId pattern
        console.log(`🤖 Row ${i + 1}: Auto-generating bins for ${faceId}`);
        bins = generateBinsForFaceId(faceId);
      }

      // Calculate face item total
      const faceItemTotal = bins.reduce(
        (sum, bin) => sum + bin.binItemCount,
        0
      );

      podsToProcess.push({
        podBarcode,
        podName,
        podStatus,
        face: {
          faceId,
          gcu: `${gcu}%`,
          faceItemTotal,
          bins,
        },
      });
    }

    // Report parsing errors
    if (errors.length > 0) {
      console.log("⚠️  Parsing errors found:");
      errors.forEach((error) => console.log(`  ${error}`));
      console.log(
        `\n📊 ${podsToProcess.length} valid records found, ${errors.length} errors`
      );
    }

    if (podsToProcess.length === 0) {
      console.log("❌ No valid pod records to process!");
      return;
    }

    // Process each pod
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const podData of podsToProcess) {
      try {
        console.log(
          `\n📦 Processing: ${podData.podBarcode} (${podData.podName})`
        );

        // Check if pod already exists
        const existingPod = await db
          .collection("pods")
          .findOne({ podBarcode: podData.podBarcode });

        // Handle name-only updates
        if (podData.nameOnlyUpdate) {
          if (existingPod) {
            // Check if pod name needs updating
            if (existingPod.podName !== podData.podName) {
              console.log(
                `📝 Updating pod name: "${existingPod.podName}" → "${podData.podName}"`
              );
              existingPod.podName = podData.podName;
              existingPod.updatedAt = new Date();

              await db
                .collection("pods")
                .replaceOne({ podBarcode: podData.podBarcode }, existingPod);
              console.log(`✅ Updated pod name for ${podData.podBarcode}`);
              updated++;
            } else {
              console.log(`⏭️  Pod name unchanged - skipping`);
              skipped++;
            }
          } else {
            console.log(
              `❌ Pod ${podData.podBarcode} not found - cannot update name only`
            );
            errors.push(
              `Pod ${podData.podBarcode}: Not found for name-only update`
            );
          }
          continue;
        }

        // Handle full pod creation/update with faces
        if (existingPod) {
          console.log(
            `📋 Pod ${podData.podBarcode} already exists - checking updates...`
          );

          // Check if pod name needs updating
          let podUpdated = false;
          if (existingPod.podName !== podData.podName) {
            console.log(
              `📝 Updating pod name: "${existingPod.podName}" → "${podData.podName}"`
            );
            existingPod.podName = podData.podName;
            existingPod.updatedAt = new Date();
            podUpdated = true;
          }

          // Check if face already exists
          const existingFaceIndex = existingPod.podFace.findIndex(
            (face) => face.faceId === podData.face.faceId
          );

          if (existingFaceIndex !== -1) {
            if (podUpdated) {
              // Update the pod with corrected name even though face exists
              await db
                .collection("pods")
                .replaceOne({ podBarcode: podData.podBarcode }, existingPod);
              console.log(`✅ Updated pod name for ${podData.podBarcode}`);
              console.log(
                `⏭️  Face ${podData.face.faceId} already exists - no face changes`
              );
              updated++;
            } else {
              console.log(
                `⏭️  Face ${podData.face.faceId} already exists - skipping`
              );
              skipped++;
            }
          } else {
            console.log(
              `➕ Adding new face ${podData.face.faceId} to existing pod`
            );

            // Add new face to existing pod
            existingPod.podFace.push(podData.face);

            await db
              .collection("pods")
              .replaceOne({ podBarcode: podData.podBarcode }, existingPod);

            if (podUpdated) {
              console.log(
                `✅ Updated pod ${podData.podBarcode} with corrected name AND new face ${podData.face.faceId}`
              );
            } else {
              console.log(
                `✅ Updated pod ${podData.podBarcode} with new face ${podData.face.faceId}`
              );
            }
            updated++;
          }
        } else {
          console.log(`➕ Creating new pod: ${podData.podBarcode}`);

          // Create new pod
          const newPod = {
            podBarcode: podData.podBarcode,
            podName: podData.podName,
            podStatus: podData.podStatus,
            podFace: [podData.face],
          };

          await db.collection("pods").insertOne(newPod);
          console.log(
            `✅ Created new pod: ${podData.podBarcode} with face: ${podData.face.faceId}`
          );
          created++;
        }

        // Log pod details
        console.log(
          `  📊 Face: ${podData.face.faceId}, GCU: ${podData.face.gcu}`
        );
        console.log(
          `  📦 Bins: ${podData.face.bins.length}, Total items: ${podData.face.faceItemTotal}`
        );
      } catch (podError) {
        console.error(
          `❌ Error processing pod ${podData.podBarcode}:`,
          podError.message
        );
        errors.push(`Pod ${podData.podBarcode}: ${podError.message}`);
      }
    }

    // Final summary
    console.log("\n🎯 Processing Summary:");
    console.log(`✅ Created: ${created} new pods`);
    console.log(
      `🔄 Updated: ${updated} existing pods (name corrections, new faces, or name-only updates)`
    );
    console.log(
      `⏭️  Skipped: ${skipped} existing pod/face combinations or unchanged names`
    );

    if (errors.length > 0) {
      console.log(`❌ Errors: ${errors.length}`);
      errors.forEach((error) => console.log(`  ${error}`));
    }

    console.log(
      `\n📊 Total pods processed: ${created + updated} out of ${
        podsToProcess.length
      } valid records`
    );
  } catch (error) {
    console.error("❌ Error adding new pods:", error.message);
    console.error("Stack trace:", error.stack);
  } finally {
    mongoose.connection.close();
    console.log("\n🔌 Database connection closed");
  }
}

// Run the function
addNewPodsFromCSV();
