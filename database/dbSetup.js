const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      throw new Error("MONGODB_URI environment variable is not defined");
    }

    console.log("Attempting to connect to MongoDB...");
    console.log("Connection string format:", mongoURI.substring(0, 20) + "...");
    
    mongoose.set('bufferCommands', false);
    mongoose.set('strictQuery', false);
    
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      retryWrites: true,
      retryReads: true,
      connectTimeoutMS: 30000,
      heartbeatFrequencyMS: 10000, // Check connection health every 10 seconds
      family: 4 // Use IPv4, skip trying IPv6
    });

    console.log("✓ MongoDB connected successfully");
    console.log("✓ Database name:", mongoose.connection.db.databaseName);
    console.log("✓ Connection state:", mongoose.connection.readyState);

    // Monitor connection pool performance
    mongoose.connection.on("connected", () => {
      console.log("✓ Mongoose connected to MongoDB");
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("✗ Mongoose disconnected from MongoDB - attempting to reconnect...");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("✓ Mongoose reconnected to MongoDB");
    });

    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB connection error:", err.message);
      // Don't exit on connection errors in production - let it retry
      if (process.env.NODE_ENV !== 'production') {
        console.error("Full error:", err);
      }
    });

    mongoose.connection.on("close", () => {
      console.warn("✗ MongoDB connection closed");
    });

  } catch (error) {
    console.error("❌ Failed to connect to MongoDB:", error.message);
    
    // Log more details for debugging
    if (error.name === 'MongoServerSelectionError') {
      console.error("⚠️ Server selection error - possible causes:");
      console.error("  1. MongoDB Atlas Network Access not configured (most common)");
      console.error("  2. Invalid connection string or credentials");
      console.error("  3. MongoDB cluster is paused or unavailable");
      console.error("  4. Firewall or network issues");
    }
    
    // In production, we might want to retry instead of exiting
    if (process.env.NODE_ENV === 'production') {
      console.error("⚠️ Will attempt to reconnect on next request...");
      // Don't exit in production - let the app handle retries
    } else {
      process.exit(1);
    }
  }
};

module.exports = connectDB;
