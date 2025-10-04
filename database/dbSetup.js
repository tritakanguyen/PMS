const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      throw new Error("MONGODB_URI environment variable is not defined");
    }

    console.log("Attempting to connect to MongoDB...");
    console.log("Connection string format:", mongoURI.substring(0, 20) + "...");
    console.log("Environment:", process.env.NODE_ENV);
    
    mongoose.set('bufferCommands', false);
    mongoose.set('strictQuery', false);
    
    await mongoose.connect(mongoURI);

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
    console.error("❌ Failed to connect to MongoDB");
    console.error("Error Type:", error.name);
    console.error("Error Message:", error.message);
    
    // Log more details for debugging
    if (error.name === 'MongoServerSelectionError') {
      console.error("\n🚨 NETWORK ACCESS ISSUE - Cannot reach MongoDB Atlas");
      console.error("This means MongoDB Atlas is blocking the connection.");
      console.error("\n✅ FIX: Add 0.0.0.0/0 to Network Access in MongoDB Atlas:");
      console.error("   1. Go to https://cloud.mongodb.com/");
      console.error("   2. Click 'Network Access' → 'Add IP Address'");
      console.error("   3. Select 'Allow Access from Anywhere' (0.0.0.0/0)");
      console.error("   4. Click 'Confirm' and wait 1-2 minutes\n");
    } else if (error.message.includes('authentication') || error.message.includes('auth')) {
      console.error("\n🚨 AUTHENTICATION FAILED");
      console.error("Check your username and password in MONGODB_URI\n");
    }
    
    // Always log full error in production for debugging
    if (process.env.NODE_ENV === 'production') {
      console.error("\nFull error details for debugging:");
      console.error(error);
      console.error("\n⚠️ Server will start but database will not work until this is fixed!");
    } else {
      console.error("\n❌ Exiting in development mode");
      process.exit(1);
    }
  }
};

module.exports = connectDB;
