const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const mongoURI =
      process.env.MONGODB_URI;
    await mongoose.connect(mongoURI);

    console.log("MongoDB connected successfully");

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
