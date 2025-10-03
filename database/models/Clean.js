const mongoose = require("mongoose");

const cleanSchema = new mongoose.Schema(
  {
    _id: { type: String }, // Allow custom _id
    podBarcode: { type: String, required: true },
    podName: { type: String },
    orchestratorId: { type: String },
    podType: { type: String, required: true },
    podFace: { type: String, required: true },
    stowedItems: [
      {
        itemFcsku: String,
        binId: String,
        status: String,
      },
    ],
    attemptedStows: [
      {
        itemFcsku: String,
        binId: String,
        status: String,
      },
    ],
    uploadAt: { type: String }, // Store as string to match existing data
    status: { type: String, default: "incomplete" },
    totalItems: { type: Number, default: 0 },
    user: { type: String, required: true },
    station: { type: String, required: true },
    completedAt: { type: String },
    updateAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

cleanSchema.pre("save", function (next) {
  this.updateAt = Date.now();
  next();
});

module.exports = mongoose.model("Clean", cleanSchema);
