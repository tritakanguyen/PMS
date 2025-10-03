const mongoose = require("mongoose");

const podItemSchema = new mongoose.Schema(
  {
    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    uBinId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["available", "missing", "hunting"],
      default: "available",
    },
    quantity: {
      type: Number,
      required: false,
      min: 0,
      default: 1,
    },
    asin: {
      type: String,
      trim: true,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    user: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// OPTIMIZED INDEXES FOR COMMON QUERY PATTERNS
// Primary indexes (automatically created by unique: true)
// - sku: 1
// - uBinId: 1

// Compound index for filtering by status (most common filter)
podItemSchema.index({ status: 1, uBinId: 1 }); // Order matters! status first for efficient filtering

// Index for quantity filtering (used in analytics)
podItemSchema.index({ quantity: 1 });

// Compound index for time-based queries
podItemSchema.index({ lastUpdated: -1, status: 1 });

// Index for user activity tracking
podItemSchema.index({ user: 1, lastUpdated: -1 });

// Text search index on sku (for autocomplete/search)
podItemSchema.index({ sku: "text", asin: "text" });

// Middleware to update lastUpdated on changes
podItemSchema.pre("save", function (next) {
  this.lastUpdated = new Date();
  next();
});

// Static method to find items by status
podItemSchema.statics.findByStatus = function (status) {
  return this.find({ status });
};

// Static method to find items by uBinId
podItemSchema.statics.findByUBinId = function (uBinId) {
  return this.find({ uBinId });
};

// HIGHLY OPTIMIZED: Static method to get items with pod/bin mapping
// Uses selective projection and efficient indexing to minimize data transfer
podItemSchema.statics.getItemsWithBinMapping = async function (query = {}) {
  const startTime = Date.now();

  // OPTIMIZATION 1: Project only necessary fields from items early
  const pipeline = [
    {
      $match: query, // Apply filter FIRST using indexes
    },
    {
      $project: {
        // Only keep fields we actually need
        sku: 1,
        uBinId: 1,
        status: 1,
        quantity: 1,
        asin: 1,
        user: 1,
        lastUpdated: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
    {
      $lookup: {
        from: "pods",
        let: { itemUBinId: "$uBinId" },
        pipeline: [
          // OPTIMIZATION 2: Use index-friendly match BEFORE unwind
          {
            $match: {
              "podFace.bins.uBinId": { $exists: true, $ne: null },
            },
          },
          // OPTIMIZATION 3: Project early to reduce document size before unwind
          {
            $project: {
              podBarcode: 1,
              podName: 1,
              "podFace.podFace": 1,
              "podFace.bins.uBinId": 1,
              "podFace.bins.binId": 1,
              "podFace.bins.binItemCount": 1,
            },
          },
          { $unwind: "$podFace" },
          { $unwind: "$podFace.bins" },
          {
            $match: {
              $expr: { $eq: ["$podFace.bins.uBinId", "$$itemUBinId"] },
            },
          },
          // OPTIMIZATION 4: Final minimal projection
          {
            $project: {
              _id: 0,
              podBarcode: 1,
              podName: 1,
              faceId: "$podFace.podFace",
              binId: "$podFace.bins.binId",
              uBinId: "$podFace.bins.uBinId",
              binItemCount: "$podFace.bins.binItemCount",
            },
          },
          { $limit: 1 }, // OPTIMIZATION 5: Stop after first match
        ],
        as: "binInfo",
      },
    },
    {
      $unwind: {
        path: "$binInfo",
        preserveNullAndEmptyArrays: true,
      },
    },
  ];

  const result = await this.aggregate(pipeline).allowDiskUse(true); // Allow disk use for large datasets

  const queryTime = Date.now() - startTime;
  if (queryTime > 200) {
    console.log(
      `⚠️  Aggregation query took ${queryTime}ms for ${result.length} items`
    );
  } else {
    console.log(
      `⚡ Fast aggregation: ${queryTime}ms for ${result.length} items`
    );
  }

  return result;
};

// FAST method for pod-specific queries (bypasses expensive aggregation)
podItemSchema.statics.getItemsByPodBarcodeFast = async function (
  podBarcode,
  filters = {}
) {
  const startTime = Date.now();

  try {
    // Step 1: Get pod data first (fast query with index)
    const Pod = mongoose.model("Pod");
    const pod = await Pod.findOne(
      { podBarcode },
      { podFace: 1, podBarcode: 1, podName: 1 }
    ).lean();

    if (!pod) {
      return [];
    }

    // Step 2: Extract all uBinIds from pod structure
    const uBinIds = [];
    const binMapping = new Map(); // uBinId -> bin info

    pod.podFace.forEach((face) => {
      face.bins.forEach((bin) => {
        if (bin.uBinId) {
          uBinIds.push(bin.uBinId);
          binMapping.set(bin.uBinId, {
            podBarcode: pod.podBarcode,
            podName: pod.podName,
            faceId: face.podFace,
            binId: bin.binId,
            uBinId: bin.uBinId,
            binItemCount: bin.binItemCount,
          });
        }
      });
    });

    // Step 3: Query items using optimized index (uBinId + status)
    const itemQuery = {
      uBinId: { $in: uBinIds },
    };

    // Add additional filters
    if (filters.status) itemQuery.status = filters.status;
    if (filters.faceId) {
      // Filter uBinIds by face
      const faceUBinIds = uBinIds.filter((uBinId) => {
        const binInfo = binMapping.get(uBinId);
        return binInfo && binInfo.faceId === filters.faceId;
      });
      itemQuery.uBinId = { $in: faceUBinIds };
    }
    if (filters.binId) {
      // Filter uBinIds by bin
      const binUBinIds = uBinIds.filter((uBinId) => {
        const binInfo = binMapping.get(uBinId);
        return binInfo && binInfo.binId === filters.binId;
      });
      itemQuery.uBinId = { $in: binUBinIds };
    }

    // Step 4: Get items (fast with compound index)
    const items = await this.find(itemQuery).lean();

    // Step 5: Map bin info to items
    const result = items.map((item) => ({
      ...item,
      binInfo: binMapping.get(item.uBinId) || null,
    }));

    const queryTime = Date.now() - startTime;
    console.log(
      `⚡ Fast pod query: ${queryTime}ms for ${result.length} items (podBarcode: ${podBarcode})`
    );

    return result;
  } catch (error) {
    console.error("Error in getItemsByPodBarcodeFast:", error);
    // Fallback to original method
    console.log("Falling back to original aggregation method...");
    return this.getItemsByPodBarcode(podBarcode, filters);
  }
};

// Optimized method for pod-specific queries
podItemSchema.statics.getItemsByPodBarcode = async function (
  podBarcode,
  filters = {}
) {
  const pipeline = [
    // Start with all items and add bin mapping to filter by pod
    {
      $lookup: {
        from: "pods",
        let: { itemUBinId: "$uBinId" },
        pipeline: [
          { $match: { podBarcode: podBarcode } },
          { $unwind: "$podFace" },
          { $unwind: "$podFace.bins" },
          {
            $match: { $expr: { $eq: ["$podFace.bins.binId", "$$itemUBinId"] } },
          },
          {
            $project: {
              podBarcode: 1,
              podName: 1,
              faceId: "$podFace.faceId",
              binId: "$podFace.bins.binId",
              binItemCount: "$podFace.bins.binItemCount",
            },
          },
        ],
        as: "binInfo",
      },
    },
    {
      $unwind: {
        path: "$binInfo",
        preserveNullAndEmptyArrays: false, // Only items with valid bins for this pod
      },
    },
    // Apply additional filters
    ...(filters.status ? [{ $match: { status: filters.status } }] : []),
    ...(filters.binId ? [{ $match: { uBinId: filters.binId } }] : []),
    ...(filters.faceId
      ? [{ $match: { "binInfo.faceId": filters.faceId } }]
      : []),
    // Project final result format
    {
      $project: {
        sku: 1,
        status: 1,
        quantity: 1,
        asin: 1,
        uBinId: 1,
        binId: "$binInfo.binId",
        faceId: "$binInfo.faceId",
        podBarcode: "$binInfo.podBarcode",
        podName: "$binInfo.podName",
        user: 1,
        lastUpdated: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ];

  return this.aggregate(pipeline);
};

// Instance method to update quantity
podItemSchema.methods.updateQuantity = function (newQuantity) {
  this.quantity = newQuantity;
  this.lastUpdated = new Date();
  return this.save();
};

const PodItem = mongoose.model("PodItem", podItemSchema, "podItems");

module.exports = PodItem;
