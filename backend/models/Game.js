const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema(
  {
    maGame: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    tenTroChoi: {
      type: String,
      required: true,
      trim: true
    },

    duongDanSlug: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    giaGoc: {
      type: Number,
      required: true,
      min: 0
    },

    phanTramGiamGia: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },

    giaHienTai: {
      type: Number,
      required: true,
      min: 0
    },

    anhBia: {
      type: String,
      default: ''
    },

    anhThuNho: {
      type: String,
      default: ''
    },

    danhSachAnh: {
      type: [String],
      default: []
    },

    videoTrailer: {
      type: String,
      default: ''
    },

    moTaNgan: {
      type: String,
      default: ''
    },

    moTaChiTiet: {
      type: String,
      default: ''
    },

    maTheLoai: {
      type: [String],
      default: []
    },

    tenTheLoai: {
      type: [String],
      default: []
    },

    doTuoi: {
      type: Number,
      default: null
    },

    nhaPhatHanh: {
      type: String,
      default: ''
    },

    nhaPhatTrien: {
      type: String,
      default: ''
    },

    ngayPhatHanh: {
      type: Date
    },

    // Các nhóm game trên trang Customer
    laGameNoiBat: {
      type: Boolean,
      default: false
    },

    laGameMoi: {
      type: Boolean,
      default: false
    },

    laGameMienPhi: {
      type: Boolean,
      default: false
    },

    laGameBanChay: {
      type: Boolean,
      default: false
    },

    laGameUuDai: {
      type: Boolean,
      default: false
    },

    trangThaiBan: {
      type: Boolean,
      default: true
    },

    osToiThieu: {
      type: String,
      default: ''
    },

    cpuToiThieu: {
      type: String,
      default: ''
    },

    ramToiThieu: {
      type: String,
      default: ''
    },

    gpuToiThieu: {
      type: String,
      default: ''
    },

    diskToiThieu: {
      type: String,
      default: ''
    },

    osDeNghi: {
      type: String,
      default: ''
    },

    cpuDeNghi: {
      type: String,
      default: ''
    },

    ramDeNghi: {
      type: String,
      default: ''
    },

    gpuDeNghi: {
      type: String,
      default: ''
    },

    diskDeNghi: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Game', gameSchema);