import { memo, useEffect, useState } from "react";
import axios from "axios";
import { format } from "utils/format";
import Breadcrumb from "../theme/breadcrumb";
import "./style.scss";
import { ClipLoader } from "react-spinners";

const CheckoutPage = () => {
  const [cart, setCart] = useState([]);
  const [form, setForm] = useState({
    tenkh: "",
    sdt: "",
    email: "",
    diachi: "",
    ghichu: "",
  });
  const [pttt, setPttt] = useState("Tiền mặt");
  const [loading, setLoading] = useState(false);

  // ================= LOAD CART + USER =================
  useEffect(() => {
    const storedCart = JSON.parse(localStorage.getItem("cart")) || [];
    setCart(storedCart);

    const user = JSON.parse(localStorage.getItem("user"));
    if (user) {
      setForm({
        tenkh: user.tenkh || "",
        sdt: user.sdt || "",
        email: user.email || "",
        diachi: user.diachi || "",
        ghichu: "",
      });
    }
  }, []);

  // ================= TÍNH TIỀN =================
  const total = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const shippingFee = total < 300000 ? 30000 : 0;
  const totalAmount = total + shippingFee;

  // ================= INPUT =================
  const handleInput = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleChange = (e) => {
    setPttt(e.target.value);
  };

  // ================= VALIDATE =================
  const validate = () => {
    if (cart.length === 0) {
      alert("Giỏ hàng đang trống!");
      return false;
    }

    if (!form.tenkh || !form.sdt || !form.email || !form.diachi) {
      alert("Vui lòng nhập đầy đủ thông tin!");
      return false;
    }

    const phoneRegex = /^(0[0-9]{9})$/;
    if (!phoneRegex.test(form.sdt)) {
      alert("SĐT không hợp lệ!");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      alert("Email không hợp lệ!");
      return false;
    }

    for (const item of cart) {
      if (!item.variantId) {
        alert(`Chọn biến thể cho "${item.name}"`);
        return false;
      }
    }

    return true;
  };

  // ================= SUBMIT =================
  const handleSubmit = async () => {
    if (loading) return;
    if (!validate()) return;

    setLoading(true);

    try {
      const user = JSON.parse(localStorage.getItem("user"));

      const cartForBackend = cart.map((item) => ({
        masp: item.id,
        variant_id: item.variantId,
        mamau: item.color,
        size: item.size,
        quantity: item.quantity,
        gia: item.price,
      }));

      const apiUrl =
        pttt === "MoMo"
          ? "https://sportshop.fly.dev/api/momo/checkout"
          : "https://sportshop.fly.dev/api/checkout";

      const res = await axios.post(apiUrl, {
        ...form,
        makh: user?.makh,
        items: cartForBackend,
        pttt,
        tongtien: totalAmount,
      });

      // ================= MOMO =================
      if (pttt === "MoMo" && res.data.payUrl) {
        window.location.href = res.data.payUrl;
        return;
      }

      // ================= SUCCESS =================
      alert("Đặt hàng thành công!");
      localStorage.removeItem("cart");
      window.location.href = `/order-success?mahd=${res.data.mahd}`;
    } catch (err) {
      const msg = err.response?.data?.message || "Lỗi khi đặt hàng!";
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Breadcrumb name="Thanh toán" />

      <div className="container">
        <div className="row">
          {/* LEFT */}
          <div className="col-lg-6">
            <div className="checkout__input">
              <label>Họ và tên:</label>
              <input
                name="tenkh"
                value={form.tenkh}
                onChange={handleInput}
              />
            </div>

            <div className="checkout__input">
              <label>Địa chỉ:</label>
              <input
                name="diachi"
                value={form.diachi}
                onChange={handleInput}
              />
            </div>

            <div className="checkout__input__group">
              <div className="checkout__input">
                <label>SĐT:</label>
                <input
                  name="sdt"
                  value={form.sdt}
                  onChange={handleInput}
                />
              </div>

              <div className="checkout__input">
                <label>Email:</label>
                <input
                  name="email"
                  value={form.email}
                  onChange={handleInput}
                />
              </div>
            </div>

            <div className="checkout__input">
              <label>Thanh toán:</label>

              <div className="checkout-pttt">
                <label>
                  <input
                    type="radio"
                    value="Tiền mặt"
                    checked={pttt === "Tiền mặt"}
                    onChange={handleChange}
                  />
                  Tiền mặt
                </label>

                <label>
                  <input
                    type="radio"
                    value="MoMo"
                    checked={pttt === "MoMo"}
                    onChange={handleChange}
                  />
                  MoMo
                </label>
              </div>
            </div>

            <div className="checkout__input">
              <label>Ghi chú:</label>
              <textarea
                name="ghichu"
                value={form.ghichu}
                onChange={handleInput}
                rows={4}
              />
            </div>
          </div>

          {/* RIGHT */}
          <div className="col-lg-6">
            <div className="checkout__order">
              <h3>Đơn hàng</h3>

              <ul>
                {cart.map((item) => (
                  <li key={`${item.id}-${item.variantId}`}>
                    <span>
                      {item.name} - {item.colorName} - {item.size}
                    </span>
                    <b>
                      {format(item.price)} x {item.quantity}
                    </b>
                  </li>
                ))}

                <li>
                  <span>Tạm tính</span>
                  <b>{format(total)}</b>
                </li>

                <li>
                  <span>Ship</span>
                  <b>{format(shippingFee)}</b>
                </li>

                <li>
                  <h3>Tổng</h3>
                  <b>{format(totalAmount)}</b>
                </li>
              </ul>

              <button
                className="button-submit"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ClipLoader size={20} color="#fff" />
                ) : (
                  "Thanh toán"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default memo(CheckoutPage);