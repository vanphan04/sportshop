import axios from "axios";
import { memo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ROUTERS } from "utils/router";
import "./style.scss";

const UserSignupPage = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value, // giữ nguyên CSS + structure
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // validate giữ nguyên UX
      if (!formData.name || !formData.email || !formData.password) {
        alert("Vui lòng nhập đầy đủ thông tin!");
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        alert("Mật khẩu không khớp!");
        return;
      }

      if (formData.password.length < 6) {
        alert("Mật khẩu phải >= 6 ký tự!");
        return;
      }

      // 🔥 CHỈ FIX SĐT (KHÔNG ĐỤNG UI)
      const phone = formData.phone ? String(formData.phone).trim() : "";

      const phoneRegex = /^0\d{9}$/;

      if (phone && !phoneRegex.test(phone)) {
        alert("SĐT phải bắt đầu bằng 0 và đủ 10 số!");
        return;
      }

      await axios.post("https://sportshop.fly.dev/api/user/signup", {
        tenkh: formData.name,
        email: formData.email,
        sdt: phone, // 🔥 FIX QUAN TRỌNG
        password: formData.password,
      });

      alert("Đăng ký thành công!");
      navigate(ROUTERS.USER.LOGIN);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Lỗi hệ thống!");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signup-page">
      <div className="signup-container">
        <div className="signup-box">
          <h2 className="signup-title">ĐĂNG KÝ TÀI KHOẢN</h2>

          <form className="signup-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Họ tên</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            {/* 🔥 CHỈ ĐỔI LOGIC, KHÔNG ĐỤNG CSS */}
            <div className="form-group">
              <label>Số điện thoại</label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Mật khẩu</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Xác nhận mật khẩu</label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
              />
            </div>

            <button className="btn-signup" disabled={isLoading}>
              {isLoading ? "Đang đăng ký..." : "ĐĂNG KÝ"}
            </button>
          </form>

          <p className="signup-footer">
            Đã có tài khoản? <Link to={ROUTERS.USER.LOGIN}>Đăng nhập</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default memo(UserSignupPage);
