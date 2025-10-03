const mongoose = require("mongoose");

// =====================================================
// NESTED SCHEMAS
// =====================================================

/**
 * Schema for individual items within a bin
 * Represents inventory items stored in specific bin locations
 */
const itemSchema = new mongoose.Schema(
  {
    itemSku: {
      type: String,
      required: true,
      trim: true,
    },
    itemStatus: {
      type: String,
      required: true,
      enum: {
        values: ["missing", "available", "hunting"],
        message: "Status must be missing, available, or hunting",
      },
      default: "available",
    },
  },
  {
    _id: false,
    timestamps: false,
  }
);

/**
 * Schema for bins within a face
 * Each bin can contain multiple items and has validation status
 */
const binSchema = new mongoose.Schema(
  {
    binId: {
      type: String,
      required: true,
      trim: true,
      index: true, // Index for faster queries
    },
    uBinId: {
      type: String,
      required: false,
      trim: true,
      index: true, // Unique bin identifier for mapping with PodItem collection
      sparse: true,
    },
    binItemCount: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Item count cannot be negative"],
    },
    binValidated: {
      type: Boolean,
      required: true,
      default: false,
    },
    items: [itemSchema],
  },
  {
    _id: false,
    timestamps: false,
  }
);

/**
 * Schema for each face of a pod
 * A pod can have multiple faces (A, B, C, D), each containing bins
 */
const podFaceSchema = new mongoose.Schema(
  {
    podFace: {
      type: String,
      required: true,
      enum: {
        values: ["A", "B", "C", "D"],
        message: "Pod face must be A, B, C, or D",
      },
      uppercase: true,
      trim: true,
    },
    gcu: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function (v) {
          return /^\d{1,3}%?$/.test(v); // Validates percentage format like "85" or "85%"
        },
        message: "GCU must be a valid percentage",
      },
    },
    faceItemTotal: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Face item total cannot be negative"],
    },
    bins: {
      type: [binSchema],
      default: [],
      validate: {
        validator: function (bins) {
          return bins.length <= 52; // Maximum bins per face (13 rows × 4 columns)
        },
        message: "A face cannot have more than 52 bins",
      },
    },
  },
  {
    _id: false,
    timestamps: false,
  }
);

// =====================================================
// MAIN POD SCHEMA
// =====================================================

/**
 * Main Pod Schema
 * Represents a complete pod with all its faces, bins, and items
 */
const podSchema = new mongoose.Schema(
  {
    // =================== IDENTIFIERS ===================
    podBarcode: {
      type: String,
      required: [true, "Pod barcode is required"],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
      validate: {
        validator: function (v) {
          return /^HB\d{11}$/.test(v); // Format: HB + 11 digits
        },
        message: (props) =>
          `${props.value} is not a valid pod barcode! Format should be HB followed by 11 digits`,
      },
    },

    podName: {
      type: String,
      required: [true, "Pod name is required"],
      trim: true,
      index: true,
    },

    // =================== CLASSIFICATION ===================
    podType: {
      type: String,
      required: [true, "Pod type is required"],
      enum: {
        values: ["H8", "H10", "H11", "H12"],
        message: "Pod type must be H8, H10, H11, or H12",
      },
      uppercase: true,
      trim: true,
      index: true,
    },

    podStatus: {
      type: String,
      required: [true, "Pod status is required"],
      enum: {
        values: ["in progress", "completed"],
        message: "Pod status must be 'in progress' or 'completed'",
      },
      default: "in progress",
      index: true,
    },

    // =================== STRUCTURE ===================
    podFace: {
      type: [podFaceSchema],
      default: [],
      validate: {
        validator: function (faces) {
          // Validate maximum 4 faces
          if (faces.length > 4) return false;

          // Validate unique face letters
          const faceLetters = faces.map((face) => face.podFace);
          const uniqueFaces = new Set(faceLetters);
          return uniqueFaces.size === faceLetters.length;
        },
        message:
          "Pod cannot have more than 4 faces, and face letters must be unique",
      },
    },
  },
  {
    timestamps: true,
    collection: "pods", // Explicit collection name

    // Indexes for better query performance
    indexes: [
      { podBarcode: 1 }, // Primary lookup
      { podType: 1, podStatus: 1 }, // Common filtering
      { podName: 1 }, // Search functionality
      { createdAt: -1 }, // Recent pods first
      { "podFace.podFace": 1 }, // Face-specific queries
    ],
  }
);

// =====================================================
// MIDDLEWARE
// =====================================================

/**
 * Pre-save middleware to automatically update calculated fields
 */
podSchema.pre("save", function (next) {
  // Update faceItemTotal for each face
  if (this.podFace && Array.isArray(this.podFace)) {
    this.podFace.forEach((face) => {
      face.faceItemTotal = face.bins.reduce(
        (total, bin) => total + (bin.binItemCount || 0),
        0
      );
    });
  }

  // Ensure podBarcode is uppercase
  if (this.podBarcode) {
    this.podBarcode = this.podBarcode.toString().toUpperCase();
  }

  next();
});

/**
 * Pre-validate middleware for additional validation
 */
podSchema.pre("validate", function (next) {
  // Ensure GCU format includes %
  if (this.podFace) {
    this.podFace.forEach((face) => {
      if (face.gcu && !face.gcu.includes("%")) {
        face.gcu = face.gcu + "%";
      }
    });
  }

  next();
});

// =====================================================
// INSTANCE METHODS
// =====================================================

/**
 * Calculate total items across all faces in this pod
 * @returns {number} Total item count
 */
podSchema.methods.getTotalItems = function () {
  if (!this.podFace || !Array.isArray(this.podFace)) return 0;

  return this.podFace.reduce((total, face) => {
    return total + (face.faceItemTotal || 0);
  }, 0);
};

/**
 * Get comprehensive item summary for this pod
 * @returns {Object} Summary with totals and breakdown by face and status
 */
podSchema.methods.getItemSummary = function () {
  const summary = {
    totalItems: 0,
    available: 0,
    missing: 0,
    hunting: 0,
    byFace: {},
  };

  if (!this.podFace) return summary;

  this.podFace.forEach((face) => {
    const faceSummary = {
      totalItems: 0,
      available: 0,
      missing: 0,
      hunting: 0,
      bins: face.bins ? face.bins.length : 0,
    };

    if (face.bins) {
      face.bins.forEach((bin) => {
        if (bin.items) {
          bin.items.forEach((item) => {
            faceSummary.totalItems++;
            if (
              item.itemStatus &&
              faceSummary.hasOwnProperty(item.itemStatus)
            ) {
              faceSummary[item.itemStatus]++;
            }
          });
        }
      });
    }

    // Add face summary to overall summary
    summary.totalItems += faceSummary.totalItems;
    summary.available += faceSummary.available;
    summary.missing += faceSummary.missing;
    summary.hunting += faceSummary.hunting;
    summary.byFace[face.podFace] = faceSummary;
  });

  return summary;
};

/**
 * Find items by SKU within this pod
 * @param {string} sku - The SKU to search for
 * @returns {Array} Array of items matching the SKU with location info
 */
podSchema.methods.findItemsBySku = function (sku) {
  const results = [];

  if (!this.podFace || !sku) return results;

  this.podFace.forEach((face) => {
    if (face.bins) {
      face.bins.forEach((bin) => {
        if (bin.items) {
          bin.items.forEach((item) => {
            if (item.itemSku === sku) {
              results.push({
                podFace: face.podFace,
                binId: bin.binId,
                uBinId: bin.uBinId,
                item: {
                  itemSku: item.itemSku,
                  itemStatus: item.itemStatus,
                },
              });
            }
          });
        }
      });
    }
  });

  return results;
};

// =====================================================
// STATIC METHODS (FINDERS)
// =====================================================

/**
 * Find pods by status
 * @param {string} status - Pod status to filter by
 * @returns {Query} Mongoose query object
 */
podSchema.statics.findByStatus = function (status) {
  return this.find({ podStatus: status });
};

/**
 * Find pods by type
 * @param {string} type - Pod type to filter by
 * @returns {Query} Mongoose query object
 */
podSchema.statics.findByType = function (type) {
  return this.find({ podType: type });
};

/**
 * Find pods with items in specific status
 * @param {string} itemStatus - Item status to search for
 * @returns {Query} Mongoose query object
 */
podSchema.statics.findByItemStatus = function (itemStatus) {
  return this.find({
    "podFace.bins.items.itemStatus": itemStatus,
  });
};

// =====================================================
// STATIC METHODS (SYNCHRONIZATION)
// =====================================================

/**
 * Sync all pods with items from PodItem collection
 * @returns {Object} Summary of sync operation
 */
podSchema.statics.syncAllPodsWithItems = async function () {
  const PodItem = mongoose.model("PodItem");

  try {
    const pods = await this.find({});
    let totalSynced = 0;
    let totalErrors = 0;
    const errorDetails = [];

    console.log(`Starting sync for ${pods.length} pods...`);

    for (const pod of pods) {
      try {
        const syncResult = await pod.syncItemsFromPodItemCollection();
        totalSynced += syncResult.itemsSynced;

        if (syncResult.itemsSynced > 0) {
          console.log(
            `✓ Synced ${syncResult.itemsSynced} items for pod ${pod.podBarcode}`
          );
        }
      } catch (error) {
        totalErrors++;
        const errorDetail = `Pod ${pod.podBarcode}: ${error.message}`;
        errorDetails.push(errorDetail);
        console.error(`✗ ${errorDetail}`);
      }
    }

    return {
      success: true,
      totalPods: pods.length,
      totalItemsSynced: totalSynced,
      totalErrors: totalErrors,
      errorDetails: errorDetails,
    };
  } catch (error) {
    throw new Error(`Failed to sync pods with items: ${error.message}`);
  }
};

/**
 * Sync specific pod by barcode with items from PodItem collection
 * @param {string} podBarcode - The pod barcode to sync
 * @returns {Object} Sync result for the specific pod
 */
podSchema.statics.syncPodWithItems = async function (podBarcode) {
  const pod = await this.findOne({ podBarcode: podBarcode.toUpperCase() });

  if (!pod) {
    throw new Error(`Pod with barcode ${podBarcode} not found`);
  }

  return await pod.syncItemsFromPodItemCollection();
};

// =====================================================
// INSTANCE METHODS (SYNCHRONIZATION & UPDATES)
// =====================================================

/**
 * Sync items from PodItem collection into this pod's structure
 * @returns {Object} Sync operation summary
 */
podSchema.methods.syncItemsFromPodItemCollection = async function () {
  const PodItem = mongoose.model("PodItem");

  try {
    let totalItemsSynced = 0;
    let binsProcessed = 0;

    // Iterate through each face and bin
    for (const face of this.podFace || []) {
      for (const bin of face.bins || []) {
        if (bin.uBinId) {
          // Find all items for this uBinId
          const podItems = await PodItem.find({
            uBinId: bin.uBinId,
          })
            .select("sku status")
            .lean();

          // Clear existing items and add new ones
          bin.items = podItems.map((podItem) => ({
            itemSku: podItem.sku,
            itemStatus: podItem.status || "available",
          }));

          // Update bin item count based on actual items found
          bin.binItemCount = bin.items.length;
          totalItemsSynced += bin.items.length;
          binsProcessed++;
        }
      }
    }

    // Save the updated pod if items were synced
    if (totalItemsSynced > 0) {
      await this.save();
    }

    return {
      success: true,
      podBarcode: this.podBarcode,
      itemsSynced: totalItemsSynced,
      binsProcessed: binsProcessed,
      facesProcessed: this.podFace ? this.podFace.length : 0,
    };
  } catch (error) {
    throw new Error(
      `Failed to sync items for pod ${this.podBarcode}: ${error.message}`
    );
  }
};

/**
 * Update item status for a specific item in this pod
 * @param {string} sku - Item SKU
 * @param {string} uBinId - Unique bin identifier
 * @param {string} newStatus - New status (missing, available, hunting)
 * @returns {boolean} True if item was updated successfully
 */
podSchema.methods.updateItemStatus = async function (sku, uBinId, newStatus) {
  const PodItem = mongoose.model("PodItem");

  // Validate status
  const validStatuses = ["missing", "available", "hunting"];
  if (!validStatuses.includes(newStatus)) {
    throw new Error(
      `Invalid status: ${newStatus}. Must be one of: ${validStatuses.join(
        ", "
      )}`
    );
  }

  try {
    // Update in PodItem collection first
    const podItem = await PodItem.findOne({ sku, uBinId });
    if (podItem) {
      podItem.status = newStatus;
      await podItem.save();
    }

    // Update in pod structure
    let updated = false;

    if (this.podFace) {
      this.podFace.forEach((face) => {
        if (face.bins) {
          face.bins.forEach((bin) => {
            if (bin.uBinId === uBinId && bin.items) {
              bin.items.forEach((item) => {
                if (item.itemSku === sku) {
                  item.itemStatus = newStatus;
                  updated = true;
                }
              });
            }
          });
        }
      });
    }

    if (updated) {
      await this.save();
    }

    return updated;
  } catch (error) {
    throw new Error(`Failed to update item status: ${error.message}`);
  }
};

// =====================================================
// VIRTUAL PROPERTIES
// =====================================================

/**
 * Virtual property for pod display name
 */
podSchema.virtual("displayName").get(function () {
  return `${this.podName} (${this.podType})`;
});

/**
 * Virtual property for completion percentage
 */
podSchema.virtual("completionPercentage").get(function () {
  const summary = this.getItemSummary();
  if (summary.totalItems === 0) return 100;

  const completedItems = summary.available + summary.hunting;
  return Math.round((completedItems / summary.totalItems) * 100);
});

// =====================================================
// SCHEMA OPTIONS
// =====================================================

// Ensure virtual fields are serialized
podSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    // Remove internal fields from JSON output
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

podSchema.set("toObject", { virtuals: true });

// =====================================================
// MODEL CREATION & EXPORT
// =====================================================

/**
 * Pod Model
 *
 * Represents a warehouse pod containing multiple faces with bins and items.
 * Each pod has a unique barcode, type classification, and tracking status.
 *
 * Key Features:
 * - Automatic item count calculations
 * - Synchronization with PodItem collection
 * - Status tracking and validation
 * - Comprehensive item summaries
 * - Flexible querying capabilities
 *
 * @model Pod
 */
const Pod = mongoose.model("Pod", podSchema);

module.exports = Pod;
