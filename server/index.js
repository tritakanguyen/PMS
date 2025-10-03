// Load environment variables first
require('dotenv').config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const connectDB = require("../database/dbSetup");
const Pod = require("../database/models/Pod");
const PodItem = require("../database/models/PodItem");
const Clean = require("../database/models/Clean");

// Simple in-memory cache for frequently accessed data
const cache = new Map();
const CACHE_TTL = 60 * 1000; // 1 minute cache

// Cache helper functions
const getCacheKey = (prefix, params) => {
  return `${prefix}:${JSON.stringify(params)}`;
};

const setCache = (key, data) => {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });

  // Clean up old cache entries (simple LRU)
  if (cache.size > 100) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
};

const getCache = (key) => {
  const entry = cache.get(key);
  if (!entry) return null;

  // Check if cache is still valid
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  return entry.data;
};

// Clear cache when items are modified
const clearItemCache = () => {
  for (const key of cache.keys()) {
    if (key.startsWith("items:") || key.startsWith("pod-items:")) {
      cache.delete(key);
    }
  }
};

const app = express();
const PORT = process.env.PORT || 5000;
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const DEBUG = process.env.DEBUG === "true" || !IS_PRODUCTION;

// Helper logging function - only logs in development or when DEBUG is enabled
const log = (...args) => {
  if (DEBUG) console.log(...args);
};

const logError = (...args) => {
  console.error(...args); // Always log errors
};

// Connect to MongoDB
connectDB()
  .then(() => {
    log("Database connected successfully");
    mongoose.connection.on("error", (err) => {
      logError("MongoDB error:", err);
    });
  })
  .catch((error) => {
    logError("Failed to connect to database:", error);
    process.exit(1);
  });

// Middleware
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : true,
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());

// Enhanced debug and performance middleware
app.use((req, res, next) => {
  const startTime = Date.now();

  log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

  // Add performance tracking
  const originalSend = res.send;
  res.send = function (data) {
    const responseTime = Date.now() - startTime;

    // Log slow requests (>500ms)
    if (responseTime > 500) {
      logError(`SLOW REQUEST: ${req.method} ${req.url} took ${responseTime}ms`);
    } else if (DEBUG && responseTime > 100) {
      log(`${req.method} ${req.url} took ${responseTime}ms`);
    }

    originalSend.call(this, data);
  };

  next();
});

// Pod Routes

// Get pods for cleaning mode from clean collection
app.get("/cleans", async (req, res) => {
  try {
    log("GET /cleans - Fetching from clean collection");

    // Try to find pods with both possible status field names
    const query = {
      $or: [{ podStatus: "incomplete" }, { status: "incomplete" }],
    };
    log("MongoDB Query:", JSON.stringify(query));

    let cleanPods = await Clean.find(query).lean();

    log(`Found ${cleanPods.length} pods in clean collection`);
    if (DEBUG && cleanPods.length > 0) {
      log("First pod sample:", JSON.stringify(cleanPods[0], null, 2));
      log("First pod _id:", cleanPods[0]._id);
    }

    // Transform data for frontend compatibility
    const transformedPods = cleanPods.map((pod) => ({
      ...pod,
      // Explicitly include _id (it should be there from ...pod, but let's be explicit)
      _id: pod._id,
      // Ensure we have all the fields the frontend expects
      podName: pod.podName || pod.podBarcode,
      totalItems: pod.totalItems || 0,
      podStatus: pod.podStatus || pod.status || "incomplete",
      updateAt: pod.updateAt || pod.uploadAt || pod.createAt,
    }));

    log("Transformed pods count:", transformedPods.length);
    if (DEBUG && transformedPods.length > 0) {
      log("First transformed pod _id:", transformedPods[0]._id);
    }
    log("=== SENDING RESPONSE ===");
    res.json(transformedPods);
  } catch (error) {
    logError("Error in GET /cleans:", error);
    res.status(500).json({
      message: "Error fetching cleaning pods",
      error: error.message,
    });
  }
});

// Update cleaning pod status
app.patch("/cleans/:podBarcode/status", async (req, res) => {
  try {
    const { podStatus } = req.body;
    const updatedPod = await Clean.findOneAndUpdate(
      { podBarcode: req.params.podBarcode },
      { podStatus, updateAt: new Date() },
      { new: true }
    );

    if (!updatedPod) {
      return res.status(404).json({ message: "Cleaning pod not found" });
    }

    res.json(updatedPod);
  } catch (error) {
    res.status(500).json({
      message: "Error updating cleaning pod status",
      error: error.message,
    });
  }
});

// Delete cleaning pod (mark as completed) - uses MongoDB _id (supports both ObjectId and UUID)
app.delete("/cleans/:id", async (req, res) => {
  try {
    const { id } = req.params;
    log(`DELETE /cleans/${id} - Attempting to delete cleaning pod`);
    log(`Received ID: ${id}, length: ${id.length}`);

    // Validate ID format - check UUID first (more specific pattern)
    const uuidPattern =
      /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
    const isUUID = uuidPattern.test(id);

    // Then check ObjectId (24 hex characters, no dashes)
    const objectIdPattern = /^[a-f\d]{24}$/i;
    const isObjectId = objectIdPattern.test(id);

    log(`ID validation - isUUID: ${isUUID}, isObjectId: ${isObjectId}`);

    if (!isObjectId && !isUUID) {
      logError(`Invalid ID format: ${id}`);
      return res.status(400).json({
        message: "Invalid cleaning pod ID format. Expected ObjectId or UUID.",
      });
    }

    log(
      `ID format validated (${
        isUUID ? "UUID" : "ObjectId"
      }), searching for document with _id: ${id}`
    );

    // Try to find and delete by _id (works with both ObjectId and UUID strings)
    const deletedPod = await Clean.findOneAndDelete({ _id: id });

    if (!deletedPod) {
      logError(`No cleaning pod found with _id: ${id}`);
      return res.status(404).json({ message: "Cleaning pod not found" });
    }

    log(`Cleaning pod ${deletedPod.podBarcode} (ID: ${id}) removed from queue`);
    res.json({
      message: "Cleaning pod completed and removed successfully",
      podBarcode: deletedPod.podBarcode,
      deletedId: id,
    });
  } catch (error) {
    logError("Error deleting cleaning pod:", error);
    res.status(500).json({
      message: "Error completing cleaning pod",
      error: error.message,
    });
  }
});

// Get all pods with optional filtering and pagination
app.get("/pods", async (req, res) => {
  try {
    log("GET /pods - Query params:", req.query);
    const { status, name, page = 1, limit = 50 } = req.query;
    let query = {};

    if (status) query.podStatus = status;
    if (name) query.podName = new RegExp(name, "i"); // Case-insensitive search

    log("Executing MongoDB query:", JSON.stringify(query));

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const pageLimit = parseInt(limit);

    // Execute query with pagination and use lean() for better performance
    const pods = await Pod.find(query)
      .skip(skip)
      .limit(pageLimit)
      .select(
        "podBarcode podName podType podStatus podFace createdAt updatedAt"
      ) // Select only needed fields
      .lean(); // Convert to plain JavaScript objects for better performance

    log(`Found ${pods.length} pods (page ${page})`);

    // Get total count for pagination
    const totalCount = await Pod.countDocuments(query);

    // Transform data for frontend consumption
    const transformedPods = pods.map((pod) => ({
      podBarcode: pod.podBarcode,
      podName: pod.podName,
      podType: pod.podType,
      podStatus: pod.podStatus,
      totalItems: pod.podFace.reduce(
        (total, face) => total + (face.faceItemTotal || 0),
        0
      ),
      podFace: pod.podFace.map((face) => ({
        podFace: face.podFace,
        gcu: face.gcu,
        faceItemTotal: face.faceItemTotal,
        bins: face.bins.map((bin) => ({
          binId: bin.binId,
          binItemCount: bin.binItemCount,
          items: bin.items || [],
        })),
      })),
      createdAt: pod.createdAt,
      updatedAt: pod.updatedAt,
    }));

    if (pods.length === 0 && page === 1 && DEBUG) {
      log("No pods found, checking database state...");
      const collections = await mongoose.connection.db
        .listCollections()
        .toArray();
      log(
        "Available collections:",
        collections.map((c) => c.name)
      );
    }

    // Return with pagination metadata
    res.json({
      pods: transformedPods,
      pagination: {
        page: parseInt(page),
        limit: pageLimit,
        totalPods: totalCount,
        totalPages: Math.ceil(totalCount / pageLimit),
        hasMore: skip + pods.length < totalCount,
      },
    });
  } catch (error) {
    logError("Error in GET /pods:", error);
    res.status(500).json({
      message: "Error fetching pods",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

// Get pod summary data for dashboard
app.get("/pods/summary", async (req, res) => {
  try {
    const totalPods = await Pod.countDocuments();
    const inProgressPods = await Pod.countDocuments({
      podStatus: "in progress",
    });
    const completedPods = await Pod.countDocuments({ podStatus: "completed" });

    const totalItems = await PodItem.countDocuments();
    const missingItems = await PodItem.countDocuments({ status: "missing" });
    const availableItems = await PodItem.countDocuments({
      status: "available",
    });
    const huntingItems = await PodItem.countDocuments({ status: "hunting" });

    res.json({
      pods: {
        total: totalPods,
        inProgress: inProgressPods,
        completed: completedPods,
      },
      podItems: {
        total: totalItems,
        missing: missingItems,
        available: availableItems,
        hunting: huntingItems,
      },
    });
  } catch (error) {
    logError("Error fetching summary:", error);
    res.status(500).json({
      message: "Error fetching summary data",
      error: error.message,
    });
  }
});

// Get a single pod by barcode with enhanced data
app.get("/pods/:podBarcode", async (req, res) => {
  try {
    const pod = await Pod.findOne({ podBarcode: req.params.podBarcode }).lean();
    if (!pod) {
      return res.status(404).json({ message: "Pod not found" });
    }

    // Transform data for frontend
    const transformedPod = {
      podBarcode: pod.podBarcode,
      podName: pod.podName,
      podType: pod.podType,
      podStatus: pod.podStatus,
      totalItems: pod.podFace.reduce(
        (total, face) => total + (face.faceItemTotal || 0),
        0
      ),
      podFace: pod.podFace.map((face) => ({
        podFace: face.podFace,
        gcu: face.gcu,
        faceItemTotal: face.faceItemTotal,
        bins: face.bins.map((bin) => ({
          binId: bin.binId,
          binItemCount: bin.binItemCount,
          items: bin.items || [],
        })),
      })),
      updatedAt: pod.updatedAt,
    };

    res.json(transformedPod);
  } catch (error) {
    logError("Error in GET /pods/:podBarcode:", error);
    res.status(500).json({
      message: "Error fetching pod",
      error: error.message,
    });
  }
});

// Get items for a specific pod and bin using new mapping
app.get("/pods/:podBarcode/face/:faceId/bin/:binId/items", async (req, res) => {
  try {
    const { podBarcode, faceId, binId } = req.params;

    // Get items from podItems collection using uBinId mapping
    const items = await PodItem.getItemsWithBinMapping({
      "binInfo.podBarcode": podBarcode,
      "binInfo.faceId": faceId,
      "binInfo.binId": binId,
    });

    // Transform for frontend
    const transformedItems = items.map((item) => ({
      sku: item.sku,
      status: item.status,
      quantity: item.quantity,
      // description: item.description,
      asin: item.asin,
      // fnsku: item.fnsku,
      // price: item.price,
      uBinId: item.uBinId,
      binId: item.binInfo?.binId,
      faceId: item.binInfo?.faceId,
      podBarcode: item.binInfo?.podBarcode,
      // lastUpdated: item.lastUpdated,
    }));

    res.json(transformedItems);
  } catch (error) {
    logError("Error fetching bin items:", error);
    res.status(500).json({
      message: "Error fetching bin items",
      error: error.message,
    });
  }
});

// Create new pod
app.post("/pods", async (req, res) => {
  try {
    const { podBarcode, podName, podType, podStatus, podFace } = req.body;

    // Check if pod already exists
    const existingPod = await Pod.findOne({ podBarcode });
    if (existingPod) {
      return res.status(400).json({ message: "Pod already exists" });
    }

    const pod = new Pod({
      podBarcode,
      podName,
      podType,
      podStatus: podStatus || "in progress",
      podFace: podFace || [],
    });

    await pod.save();

    // Transform response for frontend
    const transformedPod = {
      podBarcode: pod.podBarcode,
      podName: pod.podName,
      podType: pod.podType,
      podStatus: pod.podStatus,
      totalItems: pod.podFace.reduce(
        (total, face) => total + (face.faceItemTotal || 0),
        0
      ),
      podFace: pod.podFace,
      createdAt: pod.createdAt,
      updatedAt: pod.updatedAt,
    };

    res.status(201).json(transformedPod);
  } catch (error) {
    logError("Error creating pod:", error);
    res.status(500).json({
      message: "Error creating pod",
      error: error.message,
    });
  }
});

// Update pod status
app.patch("/pods/:podBarcode/status", async (req, res) => {
  try {
    const { podStatus } = req.body;
    const updatedPod = await Pod.findOneAndUpdate(
      { podBarcode: req.params.podBarcode },
      { podStatus },
      { new: true }
    );

    if (!updatedPod) {
      return res.status(404).json({ message: "Pod not found" });
    }

    res.json(updatedPod);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating pod status", error: error.message });
  }
});

// Update pod face data
app.patch("/pods/:podBarcode/face/:faceId", async (req, res) => {
  try {
    const { gcu, faceItemTotal, bins } = req.body;
    const pod = await Pod.findOne({ podBarcode: req.params.podBarcode });

    if (!pod) {
      return res.status(404).json({ message: "Pod not found" });
    }

    // Find and update the specific face
    const faceIndex = pod.podFace.findIndex(
      (face) => face.podFace === req.params.faceId
    );
    if (faceIndex === -1) {
      return res.status(404).json({ message: "Face not found in pod" });
    }

    // Update face data
    if (gcu !== undefined) pod.podFace[faceIndex].gcu = gcu;
    if (faceItemTotal !== undefined)
      pod.podFace[faceIndex].faceItemTotal = faceItemTotal;
    if (bins !== undefined) pod.podFace[faceIndex].bins = bins;

    await pod.save();

    // Transform response for frontend
    const transformedPod = {
      podBarcode: pod.podBarcode,
      podName: pod.podName,
      podType: pod.podType,
      podStatus: pod.podStatus,
      totalItems: pod.podFace.reduce(
        (total, face) => total + (face.faceItemTotal || 0),
        0
      ),
      podFace: pod.podFace,
      updatedAt: pod.updatedAt,
    };

    res.json(transformedPod);
  } catch (error) {
    logError("Error updating pod face:", error);
    res.status(500).json({
      message: "Error updating pod face",
      error: error.message,
    });
  }
});

// Delete pod
app.delete("/pods/:podBarcode", async (req, res) => {
  try {
    const pod = await Pod.findOneAndDelete({
      podBarcode: req.params.podBarcode,
    });
    if (!pod) {
      return res.status(404).json({ message: "Pod not found" });
    }
    res.json({ message: "Pod deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting pod", error: error.message });
  }
});

// PodItems Routes (Pod-Associated Items Collection)

// Get all pod items with bin mapping and optional filtering
app.get("/items", async (req, res) => {
  try {
    const {
      sku,
      uBinId,
      status,
      podBarcode,
      binId,
      faceId,
      page = 1,
      limit = 100,
    } = req.query;
    let query = {};

    if (sku) query.sku = new RegExp(sku, "i");
    if (uBinId) query.uBinId = uBinId;
    if (status) query.status = status;

    log("Fetching podItems with query:", query);

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const pageLimit = parseInt(limit);

    // Use aggregation to include bin mapping with pagination
    const items = await PodItem.aggregate([
      { $match: query },
      { $skip: skip },
      { $limit: pageLimit },
    ]).then(async (pagedItems) => {
      // Apply bin mapping to paginated results
      const skus = pagedItems.map((item) => item.sku);
      return PodItem.getItemsWithBinMapping({ sku: { $in: skus } });
    });

    let filteredItems = items;
    if (podBarcode || binId || faceId) {
      filteredItems = items.filter((item) => {
        if (podBarcode && item.binInfo?.podBarcode !== podBarcode) return false;
        if (binId && item.binInfo?.binId !== binId) return false;
        if (faceId && item.binInfo?.faceId !== faceId) return false;
        return true;
      });
    }

    // Get total count for pagination metadata
    const totalCount = await PodItem.countDocuments(query);

    // Transform for frontend consumption
    const transformedItems = filteredItems.map((item) => ({
      sku: item.sku,
      status: item.status,
      quantity: item.quantity,
      asin: item.asin,
      uBinId: item.uBinId,
      binId: item.binInfo?.binId,
      faceId: item.binInfo?.faceId,
      podBarcode: item.binInfo?.podBarcode,
      podName: item.binInfo?.podName,
      user: item.user,
      lastUpdated: item.lastUpdated,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    // Return with pagination metadata
    res.json({
      items: transformedItems,
      pagination: {
        page: parseInt(page),
        limit: pageLimit,
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / pageLimit),
        hasMore: skip + transformedItems.length < totalCount,
      },
    });
  } catch (error) {
    logError("Error fetching items:", error);
    res.status(500).json({
      message: "Error fetching items",
      error: error.message,
    });
  }
});

// Get pod item by SKU with bin mapping
app.get("/items/:sku", async (req, res) => {
  try {
    const items = await PodItem.getItemsWithBinMapping({
      sku: req.params.sku,
    });

    if (!items || items.length === 0) {
      return res.status(404).json({ message: "Pod item not found" });
    }

    const item = items[0];
    const transformedItem = {
      sku: item.sku,
      status: item.status,
      quantity: item.quantity,
      asin: item.asin,
      uBinId: item.uBinId,
      binId: item.binInfo?.binId,
      faceId: item.binInfo?.faceId,
      podBarcode: item.binInfo?.podBarcode,
      podName: item.binInfo?.podName,
      user: item.user,
      lastUpdated: item.lastUpdated,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };

    res.json(transformedItem);
  } catch (error) {
    logError("Error fetching item:", error);
    res.status(500).json({
      message: "Error fetching item",
      error: error.message,
    });
  }
});

// Create new pod item
app.post("/items", async (req, res) => {
  try {
    const { sku, uBinId, status, quantity, asin, user } = req.body;

    // Check if pod item already exists
    const existingItem = await PodItem.findOne({ sku });
    if (existingItem) {
      return res
        .status(400)
        .json({ message: "Pod item with this SKU already exists" });
    }

    const newItem = new PodItem({
      sku,
      uBinId,
      status: status || "available",
      quantity: quantity || 1,
      asin,
      user,
    });

    await newItem.save();

    // Get pod item with bin mapping for response
    const items = await PodItem.getItemsWithBinMapping({
      sku: newItem.sku,
    });
    const item = items[0];

    const transformedItem = {
      sku: item.sku,
      status: item.status,
      quantity: item.quantity,
      asin: item.asin,
      uBinId: item.uBinId,
      binId: item.binInfo?.binId,
      faceId: item.binInfo?.faceId,
      podBarcode: item.binInfo?.podBarcode,
      podName: item.binInfo?.podName,
      user: item.user,
      lastUpdated: item.lastUpdated,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };

    res.status(201).json(transformedItem);
  } catch (error) {
    logError("Error creating item:", error);
    res.status(500).json({
      message: "Error creating item",
      error: error.message,
    });
  }
});

// Update pod item status (with cache invalidation)
app.patch("/items/:sku/status", async (req, res) => {
  try {
    const { status } = req.body;

    const updatedItem = await PodItem.findOneAndUpdate(
      { sku: req.params.sku },
      { status, lastUpdated: new Date() },
      { new: true }
    );

    if (!updatedItem) {
      return res.status(404).json({ message: "Item not found" });
    }

    // Clear cache since item status changed
    clearItemCache();

    // Get item with bin mapping for response
    const items = await PodItem.getItemsWithBinMapping({
      sku: updatedItem.sku,
    });
    const item = items[0];

    const transformedItem = {
      sku: item.sku,
      status: item.status,
      quantity: item.quantity,
      asin: item.asin,
      uBinId: item.uBinId,
      binId: item.binInfo?.binId,
      faceId: item.binInfo?.faceId,
      podBarcode: item.binInfo?.podBarcode,
      podName: item.binInfo?.podName,
      user: item.user,
      lastUpdated: item.lastUpdated,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };

    res.json(transformedItem);
  } catch (error) {
    logError("Error updating item status:", error);
    res.status(500).json({
      message: "Error updating item status",
      error: error.message,
    });
  }
});

// Update pod item details
app.patch("/items/:sku", async (req, res) => {
  try {
    const { status, quantity, asin, user } = req.body;
    const updateData = {};

    if (status !== undefined) updateData.status = status;
    if (quantity !== undefined) updateData.quantity = quantity;
    if (asin !== undefined) updateData.asin = asin;
    if (user !== undefined) updateData.user = user;

    updateData.lastUpdated = new Date();

    const updatedItem = await PodItem.findOneAndUpdate(
      { sku: req.params.sku },
      updateData,
      { new: true }
    );

    if (!updatedItem) {
      return res.status(404).json({ message: "Item not found" });
    }

    // Get item with bin mapping for response
    const items = await PodItem.getItemsWithBinMapping({
      sku: updatedItem.sku,
    });
    const item = items[0];

    const transformedItem = {
      sku: item.sku,
      status: item.status,
      quantity: item.quantity,
      asin: item.asin,
      uBinId: item.uBinId,
      binId: item.binInfo?.binId,
      faceId: item.binInfo?.faceId,
      podBarcode: item.binInfo?.podBarcode,
      podName: item.binInfo?.podName,
      user: item.user,
      lastUpdated: item.lastUpdated,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };

    res.json(transformedItem);
  } catch (error) {
    logError("Error updating item:", error);
    res.status(500).json({
      message: "Error updating item",
      error: error.message,
    });
  }
});

// Delete pod item
app.delete("/items/:sku", async (req, res) => {
  try {
    const item = await PodItem.findOneAndDelete({ sku: req.params.sku });
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }
    res.json({ message: "Item deleted successfully" });
  } catch (error) {
    logError("Error deleting item:", error);
    res.status(500).json({
      message: "Error deleting item",
      error: error.message,
    });
  }
});

// OPTIMIZED endpoint with caching: Get items by pod barcode with high performance
app.get("/pods/:podBarcode/items", async (req, res) => {
  try {
    const { podBarcode } = req.params;
    const { faceId, binId, status } = req.query;
    const startTime = Date.now();

    // Create cache key
    const cacheKey = getCacheKey("pod-items", {
      podBarcode,
      faceId,
      binId,
      status,
    });

    // Check cache first
    const cachedResult = getCache(cacheKey);
    if (cachedResult) {
      log(
        `Cache HIT for pod ${podBarcode} items (${Date.now() - startTime}ms)`
      );
      return res.json(cachedResult);
    }

    log(
      `Fetching items for pod ${podBarcode}, face: ${faceId}, bin: ${binId}, status: ${status}`
    );

    // Use the new optimized method that bypasses expensive aggregation
    const items = await PodItem.getItemsByPodBarcodeFast(podBarcode, {
      faceId,
      binId,
      status,
    });

    // Transform for frontend consumption
    const transformedItems = items.map((item) => ({
      sku: item.sku,
      status: item.status,
      quantity: item.quantity,
      asin: item.asin,
      uBinId: item.uBinId,
      binId: item.binInfo?.binId,
      faceId: item.binInfo?.faceId,
      podBarcode: item.binInfo?.podBarcode,
      podName: item.binInfo?.podName,
      user: item.user,
      lastUpdated: item.lastUpdated,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    // Cache the result
    setCache(cacheKey, transformedItems);

    const queryTime = Date.now() - startTime;
    log(
      `Query completed in ${queryTime}ms - Found ${transformedItems.length} items for pod ${podBarcode} (cached)`
    );

    res.json(transformedItems);
  } catch (error) {
    logError("Error fetching pod items:", error);
    res.status(500).json({
      error: "Failed to fetch items",
      details: error.message,
    });
  }
});

// Add bin-items endpoint for mobile compatibility
app.get("/bin-items", async (req, res) => {
  try {
    const { sku, uBinId, status, podBarcode, binId, faceId } = req.query;
    let query = {};

    if (sku) query.sku = new RegExp(sku, "i");
    if (uBinId) query.uBinId = uBinId;
    if (status) query.status = status;

    log("Fetching bin-items with query:", query);

    // Use aggregation to include bin mapping
    const items = await PodItem.getItemsWithBinMapping(query);
    let filteredItems = items;

    if (podBarcode || binId || faceId) {
      filteredItems = items.filter((item) => {
        if (podBarcode && item.binInfo?.podBarcode !== podBarcode) return false;
        if (binId && item.binInfo?.binId !== binId) return false;
        if (faceId && item.binInfo?.faceId !== faceId) return false;
        return true;
      });
    }

    // Transform for frontend consumption
    const transformedItems = filteredItems.map((item) => ({
      sku: item.sku,
      status: item.status,
      quantity: item.quantity,
      asin: item.asin,
      uBinId: item.uBinId,
      binId: item.binInfo?.binId,
      faceId: item.binInfo?.faceId,
      podBarcode: item.binInfo?.podBarcode,
      podName: item.binInfo?.podName,
      user: item.user,
      lastUpdated: item.lastUpdated,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    res.json(transformedItems);
  } catch (error) {
    logError("Error fetching bin-items:", error);
    res.status(500).json({
      message: "Error fetching bin-items",
      error: error.message,
    });
  }
});

// Get pod items by bin ID (using uBinId mapping)
app.get("/items/bin/:binId", async (req, res) => {
  try {
    const { binId } = req.params;
    const { status } = req.query;

    let query = {};
    if (status) query.status = status;

    // Use aggregation to find items with matching binId in pod structure
    const items = await PodItem.aggregate([
      { $match: query },
      {
        $lookup: {
          from: "pods",
          let: { itemUBinId: "$uBinId" },
          pipeline: [
            { $unwind: "$podFace" },
            { $unwind: "$podFace.bins" },
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$podFace.bins.uBinId", "$$itemUBinId"] },
                    { $eq: ["$podFace.bins.binId", binId] },
                  ],
                },
              },
            },
            {
              $project: {
                podBarcode: 1,
                podName: 1,
                faceId: "$podFace.podFace",
                binId: "$podFace.bins.binId",
                uBinId: "$podFace.bins.uBinId",
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
          preserveNullAndEmptyArrays: false, // Only return items that have matching bins
        },
      },
    ]);

    // Transform for frontend consumption
    const transformedItems = items.map((item) => ({
      sku: item.sku,
      status: item.status,
      quantity: item.quantity,
      asin: item.asin,
      uBinId: item.uBinId,
      binId: item.binInfo?.binId,
      faceId: item.binInfo?.faceId,
      podBarcode: item.binInfo?.podBarcode,
      podName: item.binInfo?.podName,
      user: item.user,
      lastUpdated: item.lastUpdated,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    res.json(transformedItems);
  } catch (error) {
    logError("Error fetching items by bin:", error);
    res.status(500).json({
      message: "Error fetching items by bin",
      error: error.message,
    });
  }
});

// Bulk update pod item statuses
app.patch("/items/bulk-status", async (req, res) => {
  try {
    const { skus, status } = req.body;

    if (!Array.isArray(skus) || !status) {
      return res.status(400).json({
        message: "Invalid request. Provide array of SKUs and status.",
      });
    }

    const result = await PodItem.updateMany(
      { sku: { $in: skus } },
      { status, lastUpdated: new Date() }
    );

    res.json({
      message: `Updated ${result.modifiedCount} items`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    logError("Error bulk updating items:", error);
    res.status(500).json({
      message: "Error bulk updating items",
      error: error.message,
    });
  }
});

// Additional API endpoints for better frontend support

// Health check endpoint
app.get("/health", (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    const dbStatus = {
      0: "disconnected",
      1: "connected",
      2: "connecting",
      3: "disconnecting",
    };

    // Additional check: if connection exists and we can access the database
    const isConnected = dbState === 1 || (mongoose.connection.db && mongoose.connection.db.databaseName);
    const actualStatus = isConnected ? "connected" : dbStatus[dbState] || "unknown";

    res.json({
      status: "healthy",
      timestamp: new Date(),
      database: actualStatus,
      version: "1.0.0",
      connectionState: dbState,
      databaseName: mongoose.connection.db ? mongoose.connection.db.databaseName : null,
    });
  } catch (error) {
    res.status(500).json({
      status: "unhealthy",
      error: error.message,
    });
  }
});

// Start server with error handling
const server = app.listen(PORT, () => {
  log(`Server running on http://localhost:${PORT}`);
  log("Available endpoints:");
  log("Pod endpoints:");
  log(
    "- GET    /pods                              - Get all pods with optional filtering"
  );
  log(
    "- GET    /pods/summary                      - Get pod and item summary statistics"
  );
  log(
    "- GET    /pods/:podBarcode                  - Get specific pod by barcode"
  );
  log("- POST   /pods                              - Create new pod");
  log("- PATCH  /pods/:podBarcode/status           - Update pod status");
  log("- PATCH  /pods/:podBarcode/face/:faceId     - Update pod face data");
  log("- DELETE /pods/:podBarcode                  - Delete pod");
  log("");
  log("PodItems endpoints (Pod-Associated Items with uBinId mapping):");
  log(
    "- GET    /items                             - Get all pod items with bin mapping"
  );
  log(
    "- GET    /items/:sku                        - Get specific pod item by SKU"
  );
  log("- POST   /items                             - Create new pod item");
  log("- PATCH  /items/:sku                        - Update pod item details");
  log("- PATCH  /items/:sku/status                 - Update pod item status");
  log("- DELETE /items/:sku                        - Delete pod item");
  log(
    "- PATCH  /items/bulk-status                 - Bulk update pod item statuses"
  );

  log("");
  log("Pod-Bin specific endpoints:");
  log(
    "- GET    /pods/:podBarcode/items                 - Get all items for a specific pod"
  );
  log(
    "- GET    /pods/:podBarcode/face/:faceId/bin/:binId/items - Get items in specific bin"
  );
  log(
    "- GET    /bin-items                             - Get bin items with filtering (mobile compatibility)"
  );
  log(
    "- GET    /items/bin/:binId                      - Get items by specific bin ID"
  );
  log("");
  log("Utility endpoints:");
  log("- GET    /health                            - Health check");
});

server.on("error", (error) => {
  logError("Server error:", error);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  log("SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    log("Server closed. Database connections are being terminated...");
    mongoose.connection.close(false, () => {
      log("Database connections terminated.");
      process.exit(0);
    });
  });
});
