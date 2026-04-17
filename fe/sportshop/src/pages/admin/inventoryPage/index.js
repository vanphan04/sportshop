import { memo, useEffect, useState } from "react";
import axios from "axios";
import "./style.scss";

const InventoryPage = () => {
  const [inventory, setInventory] = useState([]);
  const [editingKey, setEditingKey] = useState(null);
  const [editedQuantity, setEditedQuantity] = useState({});
  const [newEntry, setNewEntry] = useState({
    masp: "",
    mamau: "",
    size: "",
    soluong: "",
  });

  const [products, setProducts] = useState([]);
  const [colors, setColors] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [selectedProductType, setSelectedProductType] = useState("");

  useEffect(() => {
    fetchInventory();
    fetchProducts();
    fetchColors();
    fetchProductTypes();
  }, []);

  // ================= FETCH =================
  const fetchInventory = async () => {
    try {
      const res = await axios.get("https://sportshop.fly.dev/api/tonkho");
      setInventory(res.data || []);
    } catch (err) {
      console.error("Lỗi inventory:", err);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await axios.get("https://sportshop.fly.dev/api/sanpham");
      setProducts(res.data || []);
    } catch (err) {
      console.error("Lỗi products:", err);
    }
  };

  const fetchColors = async () => {
    try {
      const res = await axios.get("https://sportshop.fly.dev/api/mausac");
      setColors(res.data || []);
    } catch (err) {
      console.error("Lỗi colors:", err);
    }
  };

  const fetchProductTypes = async () => {
    try {
      const res = await axios.get(
        "https://sportshop.fly.dev/api/loaisanpham"
      );
      setProductTypes(res.data || []);
    } catch (err) {
      console.error("Lỗi loại sản phẩm:", err);
    }
  };

  // ================= FILTER PRODUCTS =================
  const filteredProducts = products.filter((p) => {
    if (!selectedProductType) return true;
    return String(p.maloai) === String(selectedProductType);
  });

  // ================= FILTER INVENTORY (FIX CHÍNH) =================
  const filteredInventory = inventory.filter((item) => {
    if (!selectedProductType) return true;

    // KHÔNG dùng find sai type nữa → convert thẳng
    const product = products.find(
      (p) => String(p.masp) === String(item.masp)
    );

    return (
      product &&
      String(product.maloai) === String(selectedProductType)
    );
  });

  // ================= EDIT =================
  const handleEdit = (variant_id, masp, mamau, size, soluong) => {
    setEditingKey(`${masp}-${mamau}-${size || ""}`);
    setEditedQuantity({ variant_id, masp, mamau, size, soluong });
  };

  const handleSave = async () => {
    const soluong = parseInt(editedQuantity.soluong, 10);

    if (isNaN(soluong) || soluong < 0) {
      alert("Số lượng không hợp lệ");
      return;
    }

    try {
      await axios.put("https://sportshop.fly.dev/api/tonkho", {
        ...editedQuantity,
        soluong,
      });

      setEditingKey(null);
      fetchInventory();
    } catch (err) {
      console.error("Lỗi update:", err);
    }
  };

  // ================= DELETE =================
  const handleDelete = async (variant_id) => {
    if (!window.confirm("Bạn có chắc muốn xóa?")) return;

    try {
      await axios.delete(
        `https://sportshop.fly.dev/api/tonkho/${variant_id}`
      );
      fetchInventory();
    } catch (err) {
      console.error("Lỗi delete:", err);
    }
  };

  // ================= ADD =================
  const handleAdd = async () => {
    const soluong = parseInt(newEntry.soluong, 10);

    if (!newEntry.masp || !newEntry.mamau || isNaN(soluong)) {
      alert("Thiếu dữ liệu");
      return;
    }

    try {
      await axios.post("https://sportshop.fly.dev/api/tonkho", {
        ...newEntry,
        soluong,
      });

      setNewEntry({ masp: "", mamau: "", size: "", soluong: "" });
      fetchInventory();
    } catch (err) {
      alert("Lỗi thêm tồn kho");
    }
  };

  // ================= UI =================
  return (
    <div className="product-page">
      <div className="product-category-ad-page container">
        <h2>Quản lý tồn kho</h2>

        {/* FILTER */}
        <div className="add-category-form">
          <select
            value={selectedProductType}
            onChange={(e) => setSelectedProductType(e.target.value)}
          >
            <option value="">-- Tất cả loại sản phẩm --</option>
            {productTypes.map((type) => (
              <option key={type.maloai} value={type.maloai}>
                {type.tenloai}
              </option>
            ))}
          </select>

          {/* PRODUCTS */}
          <select
            value={newEntry.masp}
            onChange={(e) =>
              setNewEntry({ ...newEntry, masp: e.target.value })
            }
          >
            <option value="">Chọn sản phẩm</option>
            {filteredProducts.map((p) => (
              <option key={p.masp} value={p.masp}>
                {p.tensp}
              </option>
            ))}
          </select>

          {/* COLORS */}
          <select
            value={newEntry.mamau}
            onChange={(e) =>
              setNewEntry({ ...newEntry, mamau: e.target.value })
            }
          >
            <option value="">Chọn màu</option>
            {colors.map((c) => (
              <option key={c.mamau} value={c.mamau}>
                {c.tenmau}
              </option>
            ))}
          </select>

          {/* SIZE */}
          <select
            value={newEntry.size}
            onChange={(e) =>
              setNewEntry({ ...newEntry, size: e.target.value })
            }
          >
            <option value="">Không có size</option>
            <option value="S">S</option>
            <option value="M">M</option>
            <option value="L">L</option>
            <option value="XL">XL</option>
            <option value="XXL">XXL</option>
          </select>

          <input
            type="number"
            min={0}
            placeholder="Số lượng"
            value={newEntry.soluong}
            onChange={(e) =>
              setNewEntry({ ...newEntry, soluong: e.target.value })
            }
          />

          <button onClick={handleAdd}>Thêm</button>
        </div>

        {/* TABLE */}
        <table className="category-table">
          <thead>
            <tr>
              <th>Mã SP</th>
              <th>Tên</th>
              <th>Màu</th>
              <th>Size</th>
              <th>Số lượng</th>
              <th>Hành động</th>
            </tr>
          </thead>

          <tbody>
            {filteredInventory.map(
              ({ variant_id, masp, tensp, tenmau, size, soluong }) => {
                const key = `${masp}-${tenmau}-${size || ""}`;
                const isEditing = key === editingKey;

                return (
                  <tr key={key}>
                    <td>{masp}</td>
                    <td>{tensp}</td>
                    <td>{tenmau}</td>
                    <td>{size || "—"}</td>

                    <td>
                      {isEditing ? (
                        <input
                          type="number"
                          value={editedQuantity.soluong}
                          onChange={(e) =>
                            setEditedQuantity({
                              ...editedQuantity,
                              soluong: e.target.value,
                            })
                          }
                        />
                      ) : (
                        soluong
                      )}
                    </td>

                    <td>
                      {isEditing ? (
                        <button onClick={handleSave}>Lưu</button>
                      ) : (
                        <button
                          onClick={() =>
                            handleEdit(
                              variant_id,
                              masp,
                              tenmau,
                              size,
                              soluong
                            )
                          }
                        >
                          Sửa
                        </button>
                      )}

                      <button onClick={() => handleDelete(variant_id)}>
                        Xóa
                      </button>
                    </td>
                  </tr>
                );
              }
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default memo(InventoryPage);