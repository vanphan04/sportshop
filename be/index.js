const express = require("express");
const cors = require("cors");
const db = require("./connectDB/db"); // dùng Pool (pg)
const path = require("path");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

// folder chứa ảnh
app.use("/images", express.static(path.join(__dirname, "public/images")));

// login
const bcrypt = require("bcrypt");

app.post("/api/admin/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await db.query(
      "SELECT * FROM nhanvien WHERE username = $1",
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Tài khoản không tồn tại" });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: "Sai mật khẩu" });
    }

    res.json({
      message: "Đăng nhập thành công",
      userId: user.id,
      hoten: user.hoten,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// User Login
app.post("/api/user/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await db.query(
      "SELECT * FROM khachhang WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Email không tồn tại" });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: "Sai mật khẩu" });
    }

    res.json({
      message: "Đăng nhập thành công",
      makh: user.makh,
      tenkh: user.tenkh,
      email: user.email,
      sdt: user.sdt,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
});


// ================= SIGNUP =================
app.post("/api/user/signup", async (req, res) => {
  const { tenkh, email, sdt, password } = req.body;

  try {
    if (!tenkh || !email || !password) {
      return res.status(400).json({ error: "Thiếu thông tin" });
    }

    const phone = sdt ? String(sdt).trim() : "";

    // 🔥 1. check email tồn tại
    const checkEmail = await db.query(
      "SELECT * FROM khachhang WHERE email = $1",
      [email]
    );

    if (checkEmail.rows.length > 0) {
      return res.status(409).json({ error: "Email đã tồn tại" });
    }

    // 🔥 2. check SĐT tồn tại (MỚI THÊM)
    if (phone) {
      const checkPhone = await db.query(
        "SELECT * FROM khachhang WHERE sdt = $1",
        [phone]
      );

      if (checkPhone.rows.length > 0) {
        return res.status(409).json({ error: "Số điện thoại đã tồn tại" });
      }
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // insert user
    await db.query(
      `INSERT INTO khachhang (tenkh, email, sdt, password)
       VALUES ($1, $2, $3, $4)`,
      [tenkh, email, phone, hashedPassword]
    );

    res.json({ message: "OK" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

//Lấy tất cả sản phẩm
app.get("/api/sanpham", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        sp.*,
        v.id AS variant_id,
        v.mamau,
        v.size,
        v.stock,
        v.price
      FROM sanpham sp
      LEFT JOIN sanpham_variant v ON sp.masp = v.masp
      ORDER BY sp.masp
    `);

    // gom variants theo sản phẩm
    const productsMap = {};

    result.rows.forEach((row) => {
      if (!productsMap[row.masp]) {
        productsMap[row.masp] = {
          masp: row.masp,
          tensp: row.tensp,
          mota: row.mota,
          gia: row.gia,
          hinhanh: row.hinhanh,
          madm: row.madm,
          variants: [],
        };
      }

      if (row.variant_id) {
        productsMap[row.masp].variants.push({
          variant_id: row.variant_id,
          mamau: row.mamau,
          size: row.size,
          stock: row.stock,
          price: row.price,
        });
      }
    });

    res.json(Object.values(productsMap));

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

//Lấy danh sách loại sản phẩm
app.get("/api/loaisanpham", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM loaisanpham");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

//Thêm loại sản phẩm
app.post("/api/loaisanpham", async (req, res) => {
  const { tenloai } = req.body;

  if (!tenloai) {
    return res.status(400).json({ error: "Tên loại không được để trống" });
  }

  try {
    // kiểm tra trùng
    const check = await db.query(
      "SELECT * FROM loaisanpham WHERE tenloai = $1",
      [tenloai]
    );

    if (check.rows.length > 0) {
      return res.status(409).json({ error: "Tên loại sản phẩm đã tồn tại" });
    }

    // insert
    await db.query(
      "INSERT INTO loaisanpham (tenloai) VALUES ($1)",
      [tenloai]
    );

    res.json({ message: "Thêm loại sản phẩm thành công" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

//Sửa loại sản phẩm
app.put("/api/loaisanpham/:maloai", async (req, res) => {
  const { maloai } = req.params;
  const { tenloai } = req.body;

  if (!tenloai) {
    return res.status(400).json({ error: "Tên loại không được để trống" });
  }

  try {
    // check trùng (trừ chính nó)
    const check = await db.query(
      "SELECT * FROM loaisanpham WHERE tenloai = $1 AND maloai != $2",
      [tenloai, maloai]
    );

    if (check.rows.length > 0) {
      return res.status(409).json({ error: "Tên loại sản phẩm đã tồn tại" });
    }

    // update + RETURNING để biết có tồn tại hay không
    const result = await db.query(
      "UPDATE loaisanpham SET tenloai = $1 WHERE maloai = $2 RETURNING *",
      [tenloai, maloai]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy loại sản phẩm" });
    }

    res.json({ message: "Cập nhật loại sản phẩm thành công" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

//Xóa loại sản phẩm nếu không còn sản phẩm liên kết
app.delete("/api/loaisanpham/:maloai", async (req, res) => {
  const { maloai } = req.params;

  try {
    // kiểm tra còn sản phẩm không
    const check = await db.query(
      "SELECT COUNT(*) FROM sanpham WHERE maloai = $1",
      [maloai]
    );

    const total = parseInt(check.rows[0].count);

    if (total > 0) {
      return res.status(400).json({
        error: "Không thể xóa loại sản phẩm vì vẫn còn sản phẩm liên quan",
      });
    }

    // delete
    const result = await db.query(
      "DELETE FROM loaisanpham WHERE maloai = $1 RETURNING *",
      [maloai]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Không tìm thấy loại sản phẩm để xóa" });
    }

    res.json({ message: "Xóa loại sản phẩm thành công" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Lấy danh sách màu sắc
app.get("/api/mausac", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM mausac");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
//mâmu
app.get("/api/mausac/:mamau", async (req, res) => {
  const { mamau } = req.params;

  try {
    const result = await db.query(
      "SELECT tenmau FROM mausac WHERE mamau = $1",
      [mamau]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy màu sắc" });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
// API lấy toàn bộ sản phẩm kèm màu sắc
app.get("/api/sanpham-full", async (req, res) => {
  const sql = `
    SELECT 
      sp.*, 
      v.id AS variant_id, 
      v.mamau, 
      v.size, 
      v.stock, 
      v.price AS variant_price, 
      ms.tenmau
    FROM sanpham sp
    LEFT JOIN sanpham_variant v ON sp.masp = v.masp
    LEFT JOIN mausac ms ON v.mamau = ms.mamau
    ORDER BY sp.masp
  `;

  try {
    const result = await db.query(sql);

    const map = new Map();

    result.rows.forEach((row) => {
      if (!map.has(row.masp)) {
        map.set(row.masp, {
          masp: row.masp,
          tensp: row.tensp,
          hinhanh: row.hinhanh,
          gia: row.gia,
          loai: row.loai,
          madm: row.madm,
          variants: [],
        });
      }

      if (row.variant_id) {
        map.get(row.masp).variants.push({
          variant_id: row.variant_id,
          mamau: row.mamau,
          size: row.size,
          stock: row.stock,
          price: row.variant_price,
          tenmau: row.tenmau,
        });
      }
    });

    const products = Array.from(map.values());
    res.json(products);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Thêm màu sắc
app.post("/api/mausac", async (req, res) => {
  const { tenmau } = req.body;

  if (!tenmau) {
    return res.status(400).json({ error: "Tên màu sắc là bắt buộc" });
  }

  try {
    // kiểm tra trùng
    const check = await db.query(
      "SELECT * FROM mausac WHERE tenmau = $1",
      [tenmau]
    );

    if (check.rows.length > 0) {
      return res.status(409).json({ error: "Tên màu sắc đã tồn tại" });
    }

    // insert
    await db.query(
      "INSERT INTO mausac (tenmau) VALUES ($1)",
      [tenmau]
    );

    res.json({ message: "Thêm màu sắc thành công" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Cập nhật màu sắc
app.put("/api/mausac/:mamau", async (req, res) => {
  const { mamau } = req.params;
  const { tenmau } = req.body;

  if (!tenmau) {
    return res.status(400).json({ error: "Tên màu sắc là bắt buộc" });
  }

  try {
    // check trùng (trừ chính nó)
    const check = await db.query(
      "SELECT * FROM mausac WHERE tenmau = $1 AND mamau != $2",
      [tenmau, mamau]
    );

    if (check.rows.length > 0) {
      return res.status(409).json({ error: "Tên màu sắc đã tồn tại" });
    }

    // update + RETURNING
    const result = await db.query(
      "UPDATE mausac SET tenmau = $1 WHERE mamau = $2 RETURNING *",
      [tenmau, mamau]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy màu sắc" });
    }

    res.json({ message: "Cập nhật thành công" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Xóa màu sắc
app.delete("/api/mausac/:mamau", async (req, res) => {
  const { mamau } = req.params;

  try {
    const result = await db.query(
      "DELETE FROM mausac WHERE mamau = $1 RETURNING *",
      [mamau]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy màu sắc" });
    }

    res.json({ message: "Xóa màu sắc thành công." });

  } catch (err) {
    if (err.code === "23503") {
      return res.status(400).json({
        error: "Không thể xóa vì còn sản phẩm đang sử dụng màu này.",
      });
    }

    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

//Lấy danh sách danh mục
app.get("/api/danhmuc", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM danhmuc");
    res.json(result.rows);
  } catch (err) {
    console.error("Lỗi truy vấn danh mục:", err);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

// Thêm danh mục
app.post("/api/danhmuc", (req, res) => {
  const { tendm } = req.body;
  if (!tendm)
    return res.status(400).json({ error: "Tên danh mục không được để trống" });

  // Kiểm tra tên đã tồn tại
  db.query("SELECT * FROM danhmuc WHERE tendm = ?", [tendm], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length > 0) {
      return res.status(409).json({ error: "Tên danh mục đã tồn tại" });
    }

    // Nếu không trùng thì thêm mới
    db.query(
      "INSERT INTO danhmuc (tendm) VALUES (?)",
      [tendm],
      (err, result) => {
        if (err) return res.status(500).json({ error: "Lỗi thêm danh mục" });
        res.json({ message: "Thêm danh mục thành công" });
      },
    );
  });
});

// Sửa danh mục
app.put("/api/danhmuc/:madm", async (req, res) => {
  const { madm } = req.params;
  const { tendm } = req.body;

  if (!tendm) {
    return res.status(400).json({ error: "Tên danh mục không được để trống" });
  }

  try {
    const result = await db.query(
      "UPDATE danhmuc SET tendm = $1 WHERE madm = $2 RETURNING *",
      [tendm, madm]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy danh mục" });
    }

    res.json({ message: "Cập nhật danh mục thành công" });

  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Tên danh mục đã tồn tại" });
    }

    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// Xóa danh mục nếu không còn sản phẩm liên kết
app.delete("/api/danhmuc/:madm", (req, res) => {
  const { madm } = req.params;

  db.query(
    "SELECT COUNT(*) AS total FROM sanpham WHERE madm = ?",
    [madm],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });

      if (result[0].total > 0) {
        return res.status(400).json({
          error: "Không thể xóa danh mục vì vẫn còn sản phẩm liên quan",
        });
      }

      db.query("DELETE FROM danhmuc WHERE madm = ?", [madm], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        if (result.affectedRows === 0) {
          return res
            .status(404)
            .json({ error: "Không tìm thấy danh mục để xóa" });
        }

        res.json({ message: "Xóa danh mục thành công" });
      });
    },
  );
});

//Lấy sản phẩm theo mã loại
app.get("/api/sanpham/loai/:maloai", async (req, res) => {
  const { maloai } = req.params;

  try {
    const result = await db.query(
      "SELECT * FROM sanpham WHERE maloai = $1",
      [maloai]
    );

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
});
// GET /api/sanpham/:id/mausac
app.get("/api/sanpham/:id/mausac", async (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT 
      v.id AS variant_id,
      v.mamau,
      v.size,
      v.stock,
      v.price,
      ms.tenmau
    FROM sanpham_variant v
    LEFT JOIN mausac ms ON v.mamau = ms.mamau
    WHERE v.masp = $1
  `;

  try {
    const result = await db.query(sql, [id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// GET /api/sanpham/:id/stock
app.get("/api/sanpham/:id/stock", async (req, res) => {
  const { id } = req.params;
  const { mamau, variant_id } = req.query;

  try {
    let result;

    if (variant_id) {
      result = await db.query(
        "SELECT COALESCE(stock, 0) AS soluong FROM sanpham_variant WHERE id = $1",
        [variant_id]
      );
    } else {
      result = await db.query(
        `
        SELECT COALESCE(SUM(stock), 0) AS soluong
        FROM sanpham_variant
        WHERE masp = $1 AND mamau = $2
        `,
        [id, mamau]
      );
    }

    res.json({
      soluong: parseInt(result.rows[0]?.soluong || 0),
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

//Tìm kiếm sản phẩm
app.get("/api/sanpham/search", async (req, res) => {
  try {
    const keyword = req.query.keyword || "";

    const keywords = keyword.trim().split(" ");

    const conditions = keywords
      .map((_, i) => `(sp.tensp ILIKE $${i + 1} OR lsp.tenloai ILIKE $${i + 1})`)
      .join(" AND ");

    const values = keywords.map((k) => `%${k}%`);

    const sql = `
      SELECT sp.*
      FROM sanpham sp
      JOIN loaisanpham lsp ON sp.maloai = lsp.maloai
      WHERE ${conditions}
    `;

    const result = await db.query(sql, values);

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

//Lấy chi tiết sản phẩm
app.get("/api/sanpham/:id", async (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT 
      sp.masp,
      sp.tensp,
      sp.hinhanh,
      sp.gia,
      sp.mota,
      v.id AS variant_id,
      v.mamau,
      v.size,
      v.stock,
      COALESCE(v.price, sp.gia) AS price
    FROM sanpham sp
    LEFT JOIN sanpham_variant v ON sp.masp = v.masp
    WHERE sp.masp = $1
  `;

  try {
    const result = await db.query(sql, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Not found" });
    }

    const rows = result.rows;

    const product = {
      masp: rows[0].masp,
      tensp: rows[0].tensp,
      hinhanh: rows[0].hinhanh,
      gia: rows[0].gia,
      mota: rows[0].mota,
      variants: rows
        .filter((v) => v.variant_id) // tránh null khi không có variant
        .map((v) => ({
          variant_id: v.variant_id,
          mamau: v.mamau,
          size: v.size,
          stock: v.stock,
          price: v.price,
        })),
    };

    res.json(product);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

//sss

//Lấy sản phẩm theo mã danh mục
app.get("/api/sanpham/danhmuc/:madm", async (req, res) => {
  const { madm } = req.params;

  try {
    const result = await db.query(
      "SELECT * FROM sanpham WHERE madm = $1",
      [madm]
    );

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

//Thêm giỏ hàng
app.post("/api/giohang", async (req, res) => {
  const { masp, makh, quantity, variant_id, mamau } = req.body;

  try {
    // 🔥 lấy variant
    const variantRes = await db.query(
      `
      SELECT 
        v.id,
        v.stock,
        COALESCE(v.price, sp.gia) AS price,
        v.mamau,
        v.size
      FROM sanpham_variant v
      JOIN sanpham sp ON sp.masp = v.masp
      WHERE v.masp = $1
      ${variant_id ? "AND v.id = $2" : ""}
      ${!variant_id && mamau ? "AND v.mamau = $2" : ""}
      `,
      variant_id ? [masp, variant_id] : mamau ? [masp, mamau] : [masp]
    );

    if (variantRes.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy biến thể" });
    }

    const variant = variantRes.rows[0];

    // ❌ check tồn kho trước
    if (quantity > variant.stock) {
      return res.status(400).json({ error: "Không đủ hàng" });
    }

    // 🔥 UPSERT (KHÔNG BAO GIỜ BỊ DUPLICATE)
    await db.query(
      `
      INSERT INTO giohang (price, masp, makh, mamau, size, quantity)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (makh, masp, mamau, size)
      DO UPDATE 
      SET quantity = giohang.quantity + EXCLUDED.quantity
      `,
      [
        variant.price,
        masp,
        makh,
        variant.mamau,
        variant.size,
        quantity,
      ]
    );

    res.json({ message: "OK thêm/cập nhật giỏ hàng" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// Lấy danh sách đơn hàng
// Lấy danh sách tất cả đơn hàng
app.get("/api/hoadon", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT hd.*, kh.tenkh 
      FROM hoadon hd 
      JOIN khachhang kh ON hd.makh = kh.makh 
      ORDER BY hd.ngayxuat DESC
    `);

    res.json(result.rows);

  } catch (err) {
    console.error("Lỗi khi lấy đơn hàng:", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});
// Cập nhật trạng thái đơn hàng
app.put("/api/hoadon/:id", async (req, res) => {
  const { id } = req.params;
  const { trangthai } = req.body;

  const validStatus = ["pending", "confirmed", "shipping", "completed", "cancelled"];

  if (!trangthai) {
    return res.status(400).json({ error: "Thiếu trạng thái mới." });
  }

  if (!validStatus.includes(trangthai)) {
    return res.status(400).json({ error: "Trạng thái không hợp lệ" });
  }

  try {
    const result = await db.query(
      "UPDATE hoadon SET trangthai = $1 WHERE mahd = $2",
      [trangthai, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Không tìm thấy hóa đơn" });
    }

    res.json({ success: true, message: "Cập nhật trạng thái thành công." });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
});
//Quản lý tồn kho
app.get("/api/tonkho", async (req, res) => {
  const { maloai } = req.query;

  try {
    let query = `
      SELECT 
        v.id AS variant_id,
        sp.masp,
        sp.tensp,
        sp.gia AS price,
        sp.maloai,
        v.mamau,
        ms.tenmau,
        ms.hex_code,
        ms.image,
        v.size,
        v.stock AS soluong
      FROM sanpham_variant v
      JOIN sanpham sp ON v.masp = sp.masp
      LEFT JOIN mausac ms ON v.mamau = ms.mamau
    `;

    const values = [];

    if (maloai) {
      query += ` WHERE sp.maloai = $1`;
      values.push(maloai);
    }

    const result = await db.query(query, values);
    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
});
// thêm vào kho
app.post("/api/tonkho", async (req, res) => {
  const { masp, mamau, size = null, soluong, price } = req.body;

  if (!masp || !mamau || soluong == null) {
    return res.status(400).json({ error: "Thiếu dữ liệu gửi lên" });
  }

  try {
    // 🔥 1. lấy giá nếu không truyền
    let productPrice = price;

    if (productPrice == null) {
      const priceRes = await db.query(
        "SELECT gia FROM sanpham WHERE masp = $1",
        [masp]
      );

      if (priceRes.rows.length === 0) {
        return res.status(404).json({ error: "Không tìm thấy sản phẩm" });
      }

      productPrice = priceRes.rows[0].gia || 0;
    }

    // 🔥 2. insert + chống duplicate
    const result = await db.query(
      `
      INSERT INTO sanpham_variant (masp, mamau, size, price, stock)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
      `,
      [masp, mamau, size, productPrice, soluong]
    );

    res.json({
      message: "Đã thêm tồn kho thành công",
      id: result.rows[0].id,
    });

  } catch (err) {
    // 🔥 PostgreSQL duplicate
    if (err.code === "23505") {
      return res.status(409).json({
        error:
          "Biến thể này đã tồn tại. Hãy cập nhật thay vì thêm mới.",
      });
    }

    console.error("Lỗi thêm kho:", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

//sửa kho
app.put("/api/tonkho", async (req, res) => {
  const { variant_id, masp, mamau, size = null, soluong, price } = req.body;

  if (soluong == null) {
    return res.status(400).json({ error: "Thiếu số lượng" });
  }

  try {
    let result;

    // 🔥 Ưu tiên update theo variant_id (chuẩn nhất)
    if (variant_id) {
      result = await db.query(
        `
        UPDATE sanpham_variant
        SET stock = $1, price = $2
        WHERE id = $3
        `,
        [soluong, price ?? 0, variant_id]
      );
    } else {
      // ⚠️ fallback theo masp + mamau + size
      if (!masp || !mamau) {
        return res.status(400).json({ error: "Thiếu thông tin variant" });
      }

      result = await db.query(
        `
        UPDATE sanpham_variant
        SET stock = $1, price = $2
        WHERE masp = $3 
          AND mamau = $4 
          AND size IS NOT DISTINCT FROM $5
        `,
        [soluong, price ?? 0, masp, mamau, size]
      );
    }

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Không tìm thấy variant" });
    }

    res.json({ message: "Cập nhật tồn kho thành công" });

  } catch (err) {
    console.error("Lỗi cập nhật kho:", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});
//xóa kho
app.delete("/api/tonkho/:variant_id", async (req, res) => {
  const { variant_id } = req.params;

  try {
    // 🔥 check ràng buộc
    const orderCheck = await db.query(
      "SELECT 1 FROM hoadon_chitiet WHERE variant_id = $1 LIMIT 1",
      [variant_id]
    );

    if (orderCheck.rows.length > 0) {
      return res.status(400).json({
        error: "Không thể xóa vì đã tồn tại trong hóa đơn",
      });
    }

    const result = await db.query(
      "DELETE FROM sanpham_variant WHERE id = $1",
      [variant_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "Không tìm thấy dòng tồn kho cần xóa",
      });
    }

    res.json({ message: "Xóa thành công" });

  } catch (err) {
    console.error("Lỗi khi xóa tồn kho:", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// Hỗ trợ xóa tồn kho bằng masp và mamau cho UI hiện tại
app.delete("/api/tonkho/:masp/:mamau", async (req, res) => {
  const { masp, mamau } = req.params;
  const { size = null } = req.query; // 👈 nhận thêm size

  try {
    // 🔥 check tồn tại
    const check = await db.query(
      `
      SELECT id FROM sanpham_variant
      WHERE masp = $1 
        AND mamau = $2 
        AND size IS NOT DISTINCT FROM $3
        AND is_deleted = FALSE
      `,
      [masp, mamau, size]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({
        error: "Không tìm thấy variant",
      });
    }

    // ❗ check đã dùng trong hóa đơn chưa
    const used = await db.query(
      `
      SELECT 1 FROM hoadon_chitiet
      WHERE variant_id = $1
      LIMIT 1
      `,
      [check.rows[0].id]
    );

    if (used.rows.length > 0) {
      return res.status(400).json({
        error: "Không thể xóa vì đã có trong hóa đơn",
      });
    }

    // 🔥 soft delete
    await db.query(
      `
      UPDATE sanpham_variant
      SET is_deleted = TRUE
      WHERE id = $1
      `,
      [check.rows[0].id]
    );

    res.json({
      message: "Đã xóa (soft delete)",
    });

  } catch (err) {
    console.error("Lỗi delete variant:", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});
//hóa đơn theo sdt
app.get("/api/hoadon/sdt/:sdt", async (req, res) => {
  const { sdt } = req.params;


  try {
    const result = await db.query(
      `
      SELECT hd.mahd, hd.ngayxuat, hd.tongtien, hd.trangthai, kh.sdt, kh.tenkh
      FROM hoadon hd
      LEFT JOIN khachhang kh ON hd.makh = kh.makh
      WHERE kh.sdt = $1
      ORDER BY hd.mahd DESC
      `,
      [sdt]
    );


    res.json(result.rows);
  } catch (err) {
    console.error("❌ Lỗi lấy hóa đơn:");
    console.error("Message:", err.message);
    console.error("Detail:", err.detail);
    console.error("Stack:", err.stack);

    res.status(500).json({ error: "Lỗi server" });
  }
});
// Lấy chi tiết đơn hàng
app.get("/api/hoadon/:id/chitiet", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query(
      `
      SELECT 
        hd.mahd,
        hd.ngayxuat,
        hd.tongtien,
        hd.trangthai,
        hd.pttt,
        hd.thanhtoan,
        kh.tenkh,
        kh.diachi,
        kh.sdt,

        json_agg(
          json_build_object(
            'tensp', sp.tensp,
            'size', v.size,
            'mausac', ms.tenmau,
            'hex_code', ms.hex_code,
            'image', ms.image,

            -- 🔥 FIX QUAN TRỌNG
            'gia', ct.price,
            'soluong', ct.quantity

          )
        ) AS items

      FROM hoadon hd
      LEFT JOIN khachhang kh ON hd.makh = kh.makh
      LEFT JOIN chitiethoadon ct ON hd.mahd = ct.mahd
      LEFT JOIN sanpham_variant v ON ct.variant_id = v.id
      LEFT JOIN sanpham sp ON v.masp = sp.masp
      LEFT JOIN mausac ms ON v.mamau = ms.mamau

      WHERE hd.mahd = $1
      GROUP BY hd.mahd, kh.tenkh, kh.diachi, kh.sdt
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy hóa đơn" });
    }

    const data = result.rows[0];

    res.json({
      info: {
        mahd: data.mahd,
        ngayxuat: data.ngayxuat,
        tongtien: data.tongtien,
        trangthai: data.trangthai,
        pttt: data.pttt,
        thanhtoan: data.thanhtoan,
        tenkh: data.tenkh,
        diachi: data.diachi,
        sdt: data.sdt,
      },
      items: data.items || [],
    });

  } catch (err) {
    console.error("Lỗi lấy chi tiết hóa đơn:", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

//Thanh toán
const pool = require("./connectDB/db"); // pool pg

app.post("/api/checkout", async (req, res) => {
  try {
    const {
      items,
      pttt,
      tongtien,
      makh
    } = req.body;

    // 1. tạo hóa đơn (ĐÚNG THEO TABLE CỦA BẠN)
    const hoadonResult = await pool.query(
      `INSERT INTO hoadon 
      (makh, tongtien, pttt, trangthai, thanhtoan)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING mahd`,
      [makh, tongtien, pttt, 'Chờ xử lý', 'Chưa thanh toán']
    );

    const mahd = hoadonResult.rows[0].mahd;

    // 2. xử lý từng sản phẩm
    for (const item of items) {
      const { masp, variant_id, mamau, size, quantity } = item;

      const rows = await pool.query(
        `SELECT sp.gia, v.stock
         FROM sanpham sp
         JOIN sanpham_variant v ON sp.masp = v.masp
         WHERE sp.masp = $1 AND v.id = $2`,
        [masp, variant_id]
      );

      if (rows.rows.length === 0) {
        throw new Error("Không tìm thấy sản phẩm variant");
      }

      const gia = rows.rows[0].gia;
      const stock = rows.rows[0].stock;

      if (stock < quantity) {
        throw new Error(`Sản phẩm ID ${masp} không đủ hàng`);
      }

      await pool.query(
        `INSERT INTO chitiethoadon
        (mahd, masp, variant_id, mamau, size, quantity, price)
        VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [mahd, masp, variant_id, mamau, size, quantity, gia]
      );

      await pool.query(
        `UPDATE sanpham_variant
         SET stock = stock - $1
         WHERE id = $2`,
        [quantity, variant_id]
      );
    }

    res.json({
      message: "Đặt hàng thành công!",
      mahd
    });

  } catch (error) {
    console.error("🔥 CHECKOUT ERROR:", error);
    res.status(500).json({
      message: "Lỗi checkout",
      error: error.message
    });
  }
});

///////////////////////Momo thanh toán
app.post("/api/momo/checkout", async (req, res) => {
  const {
    tenkh,
    email,
    sdt,
    diachi,
    ghichu,
    items,
    pttt,
    tongtien,
    makh: makhFromFE, // 👈 lấy từ FE
  } = req.body;

  if (
    !tenkh ||
    !email ||
    !sdt ||
    !diachi ||
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return res.status(400).json({
      message: "Thiếu thông tin hoặc giỏ hàng trống",
    });
  }

  const connection = db.promise();

  try {
    // ================= TRANSACTION =================
    await connection.beginTransaction();

    // ================= CHECK STOCK =================
    for (const item of items) {
      const { variant_id, masp, mamau, quantity } = item;

      let query =
        "SELECT id, stock FROM sanpham_variant WHERE masp = ?";
      const params = [masp];

      if (variant_id) {
        query += " AND id = ?";
        params.push(variant_id);
      } else if (mamau) {
        query += " AND mamau = ?";
        params.push(mamau);
      }

      const [rows] = await connection.query(query, params);

      if (!rows.length || rows[0].stock < quantity) {
        throw new Error(
          `Sản phẩm không đủ hàng. Còn lại: ${
            rows.length ? rows[0].stock : 0
          }`
        );
      }
    }

    // ================= KHÁCH HÀNG =================
    let makh = makhFromFE;

    if (!makh) {
      const [khResult] = await connection.query(
        "INSERT INTO khachhang (tenkh, sdt, email, diachi) VALUES (?, ?, ?, ?)",
        [tenkh, sdt, email, diachi]
      );
      makh = khResult.insertId;
    }

    // ================= HÓA ĐƠN =================
    const [hdResult] = await connection.query(
      `INSERT INTO hoadon 
      (ngayxuat, tongtien, trangthai, thanhtoan, makh, pttt, ghichu) 
      VALUES (NOW(), ?, 'Đang chuẩn bị', 'Chờ thanh toán', ?, ?, ?)`,
      [tongtien, makh, pttt || "MoMo", ghichu || ""]
    );

    const mahd = hdResult.insertId;

    // ================= CHI TIẾT + TRỪ KHO =================
    for (const item of items) {
      const { masp, variant_id, mamau, size, quantity, gia } = item;

      let query =
        "SELECT id, stock, price, size, mamau FROM sanpham_variant WHERE masp = ?";
      const params = [masp];

      if (variant_id) {
        query += " AND id = ?";
        params.push(variant_id);
      } else if (mamau) {
        query += " AND mamau = ?";
        params.push(mamau);
      }

      const [variantRows] = await connection.query(query, params);

      if (!variantRows.length) {
        throw new Error("Không tìm thấy biến thể sản phẩm");
      }

      const variant = variantRows[0];
      const priceToUse = gia || variant.price || 0;

      // Insert chi tiết hóa đơn
      await connection.query(
        `INSERT INTO chitiethoadon
        (mahd, masp, variant_id, mamau, size, quantity, price)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          mahd,
          masp,
          variant.id,
          variant.mamau,
          variant.size,
          quantity,
          priceToUse,
        ]
      );

      // Trừ kho
      await connection.query(
        "UPDATE sanpham_variant SET stock = stock - ? WHERE id = ?",
        [quantity, variant.id]
      );
    }

    // ================= MOMO =================
    const crypto = require("crypto");
    const axios = require("axios");

    const accessKey = "F8BBA842ECF85";
    const secretKey = "K951B6PE1waDMi640xX08PD3vg6EkVlz";
    const partnerCode = "MOMO";

    const redirectUrl = `http://localhost:3000/momo-success?mahd=${mahd}`;
    const ipnUrl = "https://webhook.site/your-url";

    const orderId = partnerCode + new Date().getTime();
    const requestId = orderId;
    const orderInfo = `Thanh toán đơn hàng #${mahd}`;
    const requestType = "payWithMethod";
    const extraData = "";

    const rawSignature =
      `accessKey=${accessKey}&amount=${tongtien}&extraData=${extraData}&ipnUrl=${ipnUrl}` +
      `&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}` +
      `&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

    const signature = crypto
      .createHmac("sha256", secretKey)
      .update(rawSignature)
      .digest("hex");

    const requestBody = {
      partnerCode,
      partnerName: "Test",
      storeId: "MomoTestStore",
      requestId,
      amount: tongtien,
      orderId,
      orderInfo,
      redirectUrl,
      ipnUrl,
      lang: "vi",
      requestType,
      autoCapture: true,
      extraData,
      orderGroupId: "",
      signature,
    };

    const momoRes = await axios.post(
      "https://test-payment.momo.vn/v2/gateway/api/create",
      requestBody,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    // ================= COMMIT =================
    await connection.commit();

    return res.json({
      message: "Tạo đơn hàng thành công",
      payUrl: momoRes.data.payUrl,
      mahd,
    });
  } catch (error) {
    console.error("🔥 MOMO CHECKOUT ERROR:", error);

    await connection.rollback();

    return res.status(500).json({
      message: error.message || "Lỗi server",
    });
  }
});
app.post("/api/momo/ipn", async (req, res) => {
  const conn = await db.promise().getConnection();

  try {
    const { orderId, resultCode } = req.body;

    const mahd = orderId.split("_")[1];

    await conn.beginTransaction();

    if (resultCode === 0) {
      // ✅ thanh toán thành công

      const [items] = await conn.query(
        `SELECT variant_id, quantity 
         FROM chitiethoadon WHERE mahd = ?`,
        [mahd]
      );

      for (const item of items) {
        // 🔥 LOCK + trừ kho
        const [stockRow] = await conn.query(
          `SELECT stock FROM sanpham_variant 
           WHERE id = ? FOR UPDATE`,
          [item.variant_id]
        );

        if (stockRow[0].stock < item.quantity) {
          throw new Error("Hết hàng khi thanh toán");
        }

        await conn.query(
          `UPDATE sanpham_variant
           SET stock = stock - ?
           WHERE id = ?`,
          [item.quantity, item.variant_id]
        );
      }

      // update trạng thái
      await conn.query(
        `UPDATE hoadon 
         SET trangthai = 'CONFIRMED', thanhtoan = 'PAID'
         WHERE mahd = ?`,
        [mahd]
      );

    } else {
      // ❌ thanh toán fail
      await conn.query(
        `UPDATE hoadon 
         SET trangthai = 'CANCELLED', thanhtoan = 'FAILED'
         WHERE mahd = ?`,
        [mahd]
      );
    }

    await conn.commit();

    res.json({ message: "OK" });

  } catch (err) {
    await conn.rollback();
    console.error("IPN ERROR:", err);
    res.status(500).json({ error: "IPN lỗi" });
  } finally {
    conn.release();
  }
});
//thêm sản phẩm
app.post("/api/sanpham", async (req, res) => {
  const { tensp, hinhanh, gia, mota, maloai, madm } = req.body;

  // ================= VALIDATE =================
  if (!tensp || !hinhanh || !gia || !mota || !maloai || !madm) {
    return res.status(400).json({
      error: "Vui lòng nhập đầy đủ thông tin sản phẩm",
    });
  }

  if (isNaN(gia) || Number(gia) <= 0) {
    return res.status(400).json({
      error: "Giá sản phẩm phải là số lớn hơn 0",
    });
  }

  try {
    // ================= CHECK TRÙNG =================
    const exist = await pool.query(
      "SELECT masp FROM sanpham WHERE tensp = $1 LIMIT 1",
      [tensp.trim()]
    );

    if (exist.rows.length > 0) {
      return res.status(409).json({
        error: "Tên sản phẩm đã tồn tại",
      });
    }

    // ================= INSERT =================
    const result = await pool.query(
      `INSERT INTO sanpham (tensp, hinhanh, gia, mota, maloai, madm)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING masp`,
      [
        tensp.trim(),
        hinhanh.trim(),
        Number(gia),
        mota.trim(),
        maloai,
        madm,
      ]
    );

    return res.status(201).json({
      message: "Thêm sản phẩm thành công",
      masp: result.rows[0].masp,
    });

  } catch (err) {
    console.error("🔥 PostgreSQL error:", err);

    return res.status(500).json({
      error: "Lỗi server khi thêm sản phẩm",
    });
  }
});

// PUT: Cập nhật sản phẩm
app.get("/api/sanpham/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT 
        sp.masp,
        sp.tensp,
        sp.gia,
        sp.hinhanh,
        sp.mota,
        sp.maloai,
        sp.madm,
        l.tenloai,
        dm.tendm
      FROM sanpham sp
      LEFT JOIN loai l ON sp.maloai = l.maloai
      LEFT JOIN danhmuc dm ON sp.madm = dm.madm
      WHERE sp.masp = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Không tìm thấy sản phẩm",
      });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error("Lỗi lấy sản phẩm:", err);
    res.status(500).json({
      error: "Lỗi server",
    });
  }
});

// API xóa sản phẩm nếu không còn tồn tại trong kho
app.delete("/api/sanpham/:masp", async (req, res) => {
  const { masp } = req.params;

  try {
    // ================= CHECK KHO =================
    const inventory = await pool.query(
      `SELECT 1 
       FROM sanpham_variant 
       WHERE masp = $1 
       LIMIT 1`,
      [masp]
    );

    if (inventory.rows.length > 0) {
      return res.status(400).json({
        error: "Không thể xóa. Sản phẩm còn tồn tại trong kho.",
      });
    }

    // ================= DELETE =================
    const result = await pool.query(
      `DELETE FROM sanpham WHERE masp = $1`,
      [masp]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "Không tìm thấy sản phẩm",
      });
    }

    return res.status(200).json({
      message: "Xóa sản phẩm thành công",
    });

  } catch (err) {
    console.error("🔥 PostgreSQL delete error:", err);

    return res.status(500).json({
      error: "Lỗi khi xóa sản phẩm",
    });
  }
});

// Cập nhật thông tin khách hàng
app.put("/api/khachhang/update/:sdt", async (req, res) => {
  const { sdt } = req.params;
  const { tenkh, email, diachi } = req.body;

  // ================= VALIDATE =================
  if (!tenkh || !email) {
    return res.status(400).json({
      message: "Tên và email là bắt buộc",
    });
  }

  try {
    // ================= UPDATE =================
    const result = await pool.query(
      `UPDATE khachhang
       SET tenkh = $1,
           email = $2,
           diachi = $3
       WHERE sdt = $4
       RETURNING makh`,
      [tenkh.trim(), email.trim(), diachi || null, sdt]
    );

    // ================= NOT FOUND =================
    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Không tìm thấy khách hàng",
      });
    }

    return res.status(200).json({
      message: "Cập nhật thành công",
      makh: result.rows[0].makh,
    });

  } catch (err) {
    console.error("🔥 PostgreSQL update khachhang error:", err);

    return res.status(500).json({
      message: "Lỗi server",
    });
  }
});

// ================= SERVER =================
const PORT = 3001;

app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
