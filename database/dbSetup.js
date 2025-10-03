const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const mongoURI =
      process.env.MONGODB_URI ||
      "mongodb+srv://admin:connecttodb@podmanagement.yv8dt9t.mongodb.net/podManagement";
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // Connection pool optimization
      maxPoolSize: 50, // Maximum number of connections in pool (default: 100)
      minPoolSize: 10, // Minimum number of connections (default: 0)
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      serverSelectionTimeoutMS: 10000, // Timeout for server selection (10s)
      heartbeatFrequencyMS: 10000, // How often to check server status
      // Performance optimizations
      autoIndex: false, // Disable auto-indexing in production for better performance
      retryWrites: true, // Automatically retry failed writes
      retryReads: true, // Automatically retry failed reads
      compressors: ["zlib"], // Enable compression for network traffic
      zlibCompressionLevel: 6, // Compression level (0-9, default: 6)
    });

    console.log("MongoDB connected successfully with optimized pool settings");
    console.log(
      `Connection pool: min=${mongoose.connection.minPoolSize}, max=${mongoose.connection.maxPoolSize}`
    );

    // Monitor connection pool performance
    mongoose.connection.on("connected", () => {
      console.log("✓ Mongoose connected to MongoDB");
    });

    mongoose.connection.on("disconnected", () => {
      console.log("✗ Mongoose disconnected from MongoDB");
    });

    mongoose.connection.on("error", (err) => {
      console.error("MongoDB connection error:", err);
    });
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
};

module.exports = connectDB;
