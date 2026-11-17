const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    maTheLoai: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    tenTheLoai: {
      type: String,
      required: true,
      trim: true
    },

    moTa: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Category', categorySchema);