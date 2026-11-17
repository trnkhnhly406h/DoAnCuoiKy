
const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

const Notification = require('../models/Notification');
const NotificationCampaign = require('../models/NotificationCampaign');
const User = require('../models/User');

const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const orderRoleMiddleware = require('../middleware/orderRoleMiddleware');
const STATUS_NAME = {
  draft: 'Nháp',
  scheduled: 'Đã lên lịch',
  sending: 'Đang gửi',
  sent: 'Đã gửi',
  failed: 'Gửi lỗi'
};

const CATEGORY_NAME = {
  promo: 'Khuyến mãi',
  order: 'Đơn hàng',
  system: 'Hệ thống'
};

const objectIdOK = id => mongoose.isValidObjectId(id);
const clean = v => String(v ?? '').trim();

// LẤY THÔNG BÁO KHÁCH HÀNG XÓA TÀI KHOẢN
router.get(
  '/notifications/admin/account-deletions',
  authMiddleware,
  adminMiddleware,
  orderRoleMiddleware,
  async (req, res) => {
    try {
      const records = await Notification.find({
        userId: req.user._id,
        loaiThongBao: 'account_deleted'
      })
        .sort({ createdAt: -1 })
        .limit(30)
        .lean();

      return res.json({
        success: true,
        data: records
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Không tải được sự kiện xóa tài khoản'
      });
    }
  }
);

// ĐÁNH DẤU ĐÃ ĐỌC
router.patch(
  '/notifications/admin/account-deletions/:id/read',
  authMiddleware,
  adminMiddleware,
  orderRoleMiddleware,
  async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.sendStatus(400);
      }

      const item = await Notification.findOneAndUpdate(
        {
          _id: req.params.id,
          userId: req.user._id,
          loaiThongBao: 'account_deleted'
        },
        {
          $set: {
            isRead: true,
            daDoc: true
          }
        },
        { new: true }
      );

      if (!item) {
        return res.sendStatus(404);
      }

      return res.json({ success: true });

    } catch {
      return res.status(500).json({
        success: false
      });
    }
  }
);

// ===============================
// 1. ĐỊNH DẠNG LỊCH SỬ ĐỢT GỬI
// ===============================

function convertCampaign(c) {
  return {
    id: String(c._id),
    tieuDe: c.tieuDe,
    noiDung: c.noiDung,
    loai: c.loai,
    loaiNotification: c.nguon,
    trangThai: STATUS_NAME[c.trangThai],
    doiTuong: c.doiTuong,
    nguoiNhanCuThe: c.nguoiNhanCuThe || '',
    soNguoiNhan: c.soNguoiNhan || 0,
    ngayGui: c.daGuiLuc || c.henGuiLuc || c.createdAt,
    ngayHenGio: c.henGuiLuc,
    createdAt: c.createdAt,
    isCampaign: true
  };
}

// ===============================
// 2. GỬI THÔNG BÁO CHO KHÁCH HÀNG
// ===============================

async function sendCampaign(id) {
  // Chỉ một tiến trình được quyền gửi.
  const c = await NotificationCampaign.findOneAndUpdate(
    {
      _id: id,
      trangThai: {
        $in: ['draft', 'scheduled', 'failed']
      }
    },
    {
      $set: {
        trangThai: 'sending',
        loiGui: ''
      }
    },
    { new: true }
  );

  if (!c) return null;

  try {
    let users;

    if (c.doiTuong === 'specific') {
      const key = c.nguoiNhanCuThe;

      const user = await User.findOne({
        vaiTro: 'customer',
        $or: [
          { maTaiKhoan: key },
          { tenDangNhap: key },
          { email: key }
        ]
      }).select('_id maTaiKhoan');

      users = user ? [user] : [];

    } else {
      users = await User.find({
        vaiTro: 'customer'
      }).select('_id maTaiKhoan');
    }

    if (!users.length) {
      throw new Error(
        'Không tìm thấy khách hàng hợp lệ để nhận thông báo'
      );
    }

    const cat =
      c.loai === 'Khuyến mãi'
        ? 'promo'
        : c.loai === 'Đơn hàng'
          ? 'order'
          : 'system';

    const icon =
      cat === 'promo'
        ? '🏷️'
        : cat === 'order'
          ? '📦'
          : '🔔';

    // Mỗi khách hàng chỉ nhận một bản
    // của cùng một chiến dịch.
    await Notification.bulkWrite(
      users.map(u => ({
        updateOne: {
          filter: {
            campaignId: c._id,
            userId: u._id
          },

          update: {
            $setOnInsert: {
              campaignId: c._id,
              userId: u._id,
              maTaiKhoan: u.maTaiKhoan,

              title: c.tieuDe,
              tieuDe: c.tieuDe,

              desc: c.noiDung,
              noiDung: c.noiDung,

              icon,
              category: cat,
              loaiThongBao: cat,

              isRead: false,
              daDoc: false
            }
          },

          upsert: true
        }
      })),
      { ordered: false }
    );

    const total = await Notification.countDocuments({
      campaignId: c._id
    });

    c.trangThai = 'sent';
    c.daGuiLuc = new Date();
    c.soNguoiNhan = total;

    await c.save();

    return c;

  } catch (error) {
    await NotificationCampaign.updateOne(
      { _id: c._id },
      {
        $set: {
          trangThai: 'failed',
          loiGui: error.message
        }
      }
    );

    throw error;
  }
}

// ===============================
// 3. CUSTOMER: DANH SÁCH
// ===============================

router.get(
  '/notifications/me',
  authMiddleware,
  async (req, res) => {
    try {
      const notifications = await Notification.find({
        $or: [
          { maTaiKhoan: req.user.maTaiKhoan },
          { userId: req.user._id }
        ]
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      const data = notifications.map(n => ({
        _id: n._id,

        title: n.title || n.tieuDe || 'Thông báo',
        desc: n.desc || n.noiDung || '',

        icon: n.icon || '🔔',
        category: n.category || 'system',

        isRead: Boolean(n.isRead || n.daDoc),
        createdAt: n.createdAt
      }));

      return res.json({
        success: true,
        data
      });

    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: 'Không tải được thông báo khách hàng'
      });
    }
  }
);

// ===============================
// 4. CUSTOMER: ĐỌC VÀ XÓA
// ===============================

const ownNotification = req => ({
  _id: req.params.id,
  $or: [
    { maTaiKhoan: req.user.maTaiKhoan },
    { userId: req.user._id }
  ]
});

const markRead = async (req, res) => {
  try {
    if (!objectIdOK(req.params.id)) {
      return res.status(400).json({
        success: false
      });
    }

    const isRead =
      req.body.isRead === undefined
        ? true
        : req.body.isRead === true;

    const n = await Notification.findOneAndUpdate(
      ownNotification(req),
      {
        $set: {
          isRead,
          daDoc: isRead
        }
      },
      { new: true }
    );

    if (!n) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông báo'
      });
    }

    return res.json({
      success: true,
      data: n
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Không cập nhật được thông báo'
    });
  }
};

router.put(
  '/notifications/:id/read',
  authMiddleware,
  markRead
);

router.patch(
  '/notifications/:id/read',
  authMiddleware,
  markRead
);

router.delete(
  '/notifications/:id',
  authMiddleware,
  async (req, res) => {
    try {
      if (!objectIdOK(req.params.id)) {
        return res.status(400).json({
          success: false
        });
      }

      const n = await Notification.findOneAndDelete(
        ownNotification(req)
      );

      if (!n) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy thông báo'
        });
      }

      return res.json({
        success: true,
        message: 'Đã xóa thông báo'
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Không xóa được thông báo'
      });
    }
  }
);

// ===============================
// 5. ADMIN: DANH SÁCH THÔNG BÁO
// ===============================

router.get(
  '/notifications/admin/all',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const [campaigns, legacy] = await Promise.all([
        NotificationCampaign.find()
          .sort({ createdAt: -1 })
          .limit(300)
          .lean(),

        Notification.find({
          campaignId: null
        })
          .sort({ createdAt: -1 })
          .limit(3000)
          .lean()
      ]);

      // Mỗi chiến dịch mới = một dòng.
      const entries = campaigns.map(convertCampaign);

      // Gộp lịch sử cũ không có campaignId.
      // Những bản cùng nội dung, cùng loại và
      // sinh gần nhau (<=20 giây) được xem là
      // cùng một đợt gửi cũ.
      const legacyBatches = [];

      for (const n of legacy.slice().reverse()) {
        const cat =
          n.loaiThongBao || n.category || 'system';

        const isLegacyAdmin =
          cat === 'promo' || cat === 'order';

        const title =
          n.tieuDe || n.title || 'Thông báo';

        const desc =
          n.noiDung || n.desc || '';

        const ms = new Date(n.createdAt).getTime();

        const last =
          legacyBatches[legacyBatches.length - 1];

        if (
          isLegacyAdmin &&
          last &&
          last.isLegacyAdmin &&
          last.cat === cat &&
          last.title === title &&
          last.desc === desc &&
          ms - last.lastMs <= 20000
        ) {
          last.ids.push(String(n._id));
          last.lastMs = ms;

        } else {
          legacyBatches.push({
            n,
            cat,
            title,
            desc,
            lastMs: ms,
            ids: [String(n._id)],
            isLegacyAdmin
          });
        }
      }

      for (const group of legacyBatches) {
        const { n, isLegacyAdmin, ids, cat } = group;

        entries.push({
          id: String(n._id),
          tieuDe: group.title,
          noiDung: group.desc,


loai: /^ĐƠN HÀNG /i.test(group.title)
  ? 'Đơn hàng'
  : (CATEGORY_NAME[cat] || 'Hệ thống'),

          loaiNotification:
            isLegacyAdmin ? 'admin' : 'system',

          trangThai:
            isLegacyAdmin ? 'Đã gửi' : 'Tự động',

          doiTuong:
            ids.length > 1 ? 'all' : 'specific',

          nguoiNhanCuThe:
            ids.length > 1 ? '' : (n.maTaiKhoan || ''),

          soNguoiNhan: ids.length,
          ngayGui: n.createdAt,
          createdAt: n.createdAt,

          isCampaign: false,
          legacyIds: ids
        });
      }

      entries.sort(
        (a, b) =>
          new Date(b.createdAt) - new Date(a.createdAt)
      );

      return res.json({
        success: true,
        data: entries.slice(0, 350)
      });

    } catch (error) {
      console.error(
        'Lỗi lịch sử thông báo:',
        error
      );

      return res.status(500).json({
        success: false,
        message: 'Không tải được lịch sử thông báo'
      });
    }
  }
);

// ===============================
// 6. KIỂM TRA THÔNG TIN NHẬP
// ===============================

function validateBody(body, mode) {
  const tieuDe = clean(body.tieuDe);
  const noiDung = clean(body.noiDung);

  const doiTuong =
    body.doiTuong === 'specific'
      ? 'specific'
      : 'all';

  const nguoiNhanCuThe =
    clean(body.nguoiNhanCuThe);

  const loai = [
    'Hệ thống',
    'Khuyến mãi',
    'Đơn hàng'
  ].includes(body.loai)
    ? body.loai
    : 'Hệ thống';

  const nguon =
    body.nguon === 'system'
      ? 'system'
      : 'admin';

  const henGuiLuc = body.ngayHenGio
    ? new Date(body.ngayHenGio)
    : null;

  if (
    !tieuDe ||
    !noiDung ||
    tieuDe.length > 200 ||
    noiDung.length > 5000
  ) {
    return {
      error:
        'Nhập tiêu đề (tối đa 200 ký tự) và nội dung (tối đa 5000 ký tự)'
    };
  }

  if (
    doiTuong === 'specific' &&
    !nguoiNhanCuThe
  ) {
    return {
      error: 'Bạn chưa nhập tài khoản người nhận'
    };
  }

  if (
    mode === 'scheduled' &&
    (
      !henGuiLuc ||
      isNaN(henGuiLuc.getTime()) ||
      henGuiLuc <= new Date()
    )
  ) {
    return {
      error:
        'Thời gian hẹn gửi phải là thời điểm trong tương lai'
    };
  }

  return {
    tieuDe,
    noiDung,
    doiTuong,

    nguoiNhanCuThe:
      doiTuong === 'specific'
        ? nguoiNhanCuThe
        : '',

    loai,
    nguon,

    henGuiLuc:
      mode === 'scheduled'
        ? henGuiLuc
        : null
  };
}

// ===============================
// 7. ADMIN: TẠO VÀ GỬI THÔNG BÁO
// ===============================

router.post(
  '/notifications/admin/send',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const mode =
        ['draft', 'scheduled'].includes(req.body.mode)
          ? req.body.mode
          : 'now';

      const input = validateBody(req.body, mode);

      if (input.error) {
        return res.status(400).json({
          success: false,
          message: input.error
        });
      }

      if (input.doiTuong === 'specific') {
        const exists = await User.exists({
          vaiTro: 'customer',
          $or: [
            { maTaiKhoan: input.nguoiNhanCuThe },
            { tenDangNhap: input.nguoiNhanCuThe },
            { email: input.nguoiNhanCuThe }
          ]
        });

        if (!exists) {
          return res.status(404).json({
            success: false,
            message: 'Không tìm thấy khách hàng được chọn'
          });
        }
      }

      const requestId = clean(req.body.requestId);

      if (requestId) {
        const existing =
          await NotificationCampaign.findOne({
            requestId
          });

        if (existing) {
          return res.status(
            existing.trangThai === 'failed' ? 409 : 200
          ).json({
            success: existing.trangThai !== 'failed',

            message:
              existing.trangThai === 'failed'
                ? 'Lần gửi trước gặp lỗi. Hãy dùng nút Gửi ngay tại dòng Gửi lỗi.'
                : 'Yêu cầu này đã được tiếp nhận',

            data: convertCampaign(existing)
          });
        }
      }

      const c = await NotificationCampaign.create({
        ...input,

        trangThai:
          mode === 'scheduled'
            ? 'scheduled'
            : 'draft',

        ...(requestId ? { requestId } : {})
      });

      if (mode === 'now') {
        try {
          const sent = await sendCampaign(c._id);

          return res.status(201).json({
            success: true,

            message:
              `Đã gửi tới ${sent.soNguoiNhan} khách hàng`,

            data: convertCampaign(sent)
          });

        } catch (e) {
          return res.status(500).json({
            success: false,

            message:
              `Đã tạo thông báo nhưng gửi thất bại: ${e.message}. Có thể gửi lại trong danh sách.`,

            data: convertCampaign(
              await NotificationCampaign.findById(c._id)
            )
          });
        }
      }

      return res.status(201).json({
        success: true,

        message:
          mode === 'draft'
            ? 'Đã lưu bản nháp'
            : 'Đã hẹn giờ gửi thành công',

        data: convertCampaign(c)
      });

    } catch (e) {
      if (
        e.code === 11000 &&
        req.body.requestId
      ) {
        const c =
          await NotificationCampaign.findOne({
            requestId: clean(req.body.requestId)
          });

        if (c) {
          return res.status(
            c.trangThai === 'failed' ? 409 : 200
          ).json({
            success: c.trangThai !== 'failed',
            data: convertCampaign(c)
          });
        }
      }

      console.error(e);

      return res.status(500).json({
        success: false,
        message: 'Không tạo được thông báo'
      });
    }
  }
);

// ===============================
// 8. ADMIN: CHỈNH SỬA NHÁP / LỊCH
// ===============================

router.put(
  '/notifications/admin/:id',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      if (!objectIdOK(req.params.id)) {
        return res.status(400).json({
          success: false
        });
      }

      const current =
        await NotificationCampaign.findById(
          req.params.id
        );

      if (!current) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy thông báo'
        });
      }

      if (
        !['draft', 'scheduled'].includes(
          current.trangThai
        )
      ) {
        return res.status(409).json({
          success: false,
          message:
            'Thông báo đã gửi không thể chỉnh sửa'
        });
      }

      const mode =
        req.body.mode === 'scheduled'
          ? 'scheduled'
          : 'draft';

      const input = validateBody(req.body, mode);

      if (input.error) {
        return res.status(400).json({
          success: false,
          message: input.error
        });
      }

      const updated =
        await NotificationCampaign.findOneAndUpdate(
          {
            _id: current._id,
            trangThai: {
              $in: ['draft', 'scheduled']
            }
          },
          {
            $set: {
              ...input,
              trangThai: mode,
              loiGui: ''
            }
          },
          {
            new: true,
            runValidators: true
          }
        );

      if (!updated) {
        return res.status(409).json({
          success: false,
          message:
            'Trạng thái đã thay đổi, vui lòng tải lại'
        });
      }

      return res.json({
        success: true,
        message: 'Đã lưu thay đổi',
        data: convertCampaign(updated)
      });

    } catch (e) {
      return res.status(500).json({
        success: false,
        message: 'Không cập nhật được thông báo'
      });
    }
  }
);

// ===============================
// 9. ADMIN: HỦY LỊCH GỬI
// ===============================

router.post(
  '/notifications/admin/:id/cancel',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      if (!objectIdOK(req.params.id)) {
        return res.status(400).json({
          success: false
        });
      }

      const c =
        await NotificationCampaign.findOneAndUpdate(
          {
            _id: req.params.id,
            trangThai: 'scheduled'
          },
          {
            $set: {
              trangThai: 'draft',
              henGuiLuc: null
            }
          },
          { new: true }
        );

      if (!c) {
        return res.status(409).json({
          success: false,
          message:
            'Thông báo không còn ở trạng thái hẹn giờ'
        });
      }

      return res.json({
        success: true,
        data: convertCampaign(c)
      });

    } catch (e) {
      return res.status(500).json({
        success: false,
        message: 'Không hủy được lịch'
      });
    }
  }
);

// ===============================
// 10. ADMIN: GỬI NGAY
// ===============================

router.post(
  '/notifications/admin/:id/send-now',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      if (!objectIdOK(req.params.id)) {
        return res.status(400).json({
          success: false
        });
      }

      const c = await sendCampaign(req.params.id);

      if (!c) {
        return res.status(409).json({
          success: false,
          message:
            'Thông báo đã được gửi hoặc đang xử lý'
        });
      }

      return res.json({
        success: true,
        message:
          `Đã gửi tới ${c.soNguoiNhan} khách hàng`,
        data: convertCampaign(c)
      });

    } catch (e) {
      return res.status(500).json({
        success: false,
        message: `Không gửi được: ${e.message}`
      });
    }
  }
);

// ===============================
// 11. ADMIN: XÓA ĐỢT THÔNG BÁO
// ===============================

router.delete(
  '/notifications/admin/:id',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      if (!objectIdOK(req.params.id)) {
        return res.status(400).json({
          success: false
        });
      }

      const c = await NotificationCampaign.findOne({
        _id: req.params.id,
        trangThai: { $ne: 'sending' }
      });

      if (!c) {
        return res.status(409).json({
          success: false,
          message:
            'Không tìm thấy hoặc thông báo đang gửi'
        });
      }

      await Notification.deleteMany({
        campaignId: c._id
      });

      await c.deleteOne();

      return res.json({
        success: true,
        message:
          'Đã xóa thông báo và các bản nhận của khách hàng'
      });

    } catch (e) {
      return res.status(500).json({
        success: false,
        message: 'Không xóa được thông báo'
      });
    }
  }
);

// ===============================
// 12. XÓA NHÓM BẢN GHI CŨ
// ===============================

router.post(
  '/notifications/admin/legacy/delete',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const ids = req.body.ids;

      if (
        !Array.isArray(ids) ||
        !ids.length ||
        ids.length > 3000 ||
        !ids.every(objectIdOK)
      ) {
        return res.status(400).json({
          success: false,
          message: 'Danh sách ID không hợp lệ'
        });
      }

      const result = await Notification.deleteMany({
        _id: { $in: ids },
        campaignId: null
      });

      return res.json({
        success: true,
        message:
          `Đã xóa ${result.deletedCount} bản ghi cũ`
      });

    } catch (e) {
      return res.status(500).json({
        success: false,
        message: 'Không xóa được bản ghi cũ'
      });
    }
  }
);

// ===============================
// 13. TỰ ĐỘNG GỬI THEO LỊCH
// ===============================

let schedulerStarted = false;

router.startNotificationScheduler = function () {
  if (schedulerStarted) return;

  schedulerStarted = true;

  const timer = setInterval(async () => {
    try {
      const due = await NotificationCampaign.find({
        trangThai: 'scheduled',
        henGuiLuc: {
          $lte: new Date()
        }
      })
        .select('_id')
        .limit(20)
        .lean();

      for (const item of due) {
        try {
          await sendCampaign(item._id);

        } catch (e) {
          console.error(
            'Gửi thông báo hẹn giờ thất bại:',
            item._id,
            e.message
          );
        }
      }

    } catch (e) {
      console.error(
        'Lỗi worker thông báo:',
        e.message
      );
    }
  }, 15000);

  timer.unref?.();
};

module.exports = router;
