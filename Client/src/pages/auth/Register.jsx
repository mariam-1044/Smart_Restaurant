import "../../styles/auth.css";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

export default function Register() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "customer",
  });
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    // Validation
    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
      setErrorMsg("All fields are required.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    if (formData.password.length < 8) {
      setErrorMsg("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/auth/register", {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
      });

      if (response.data.success) {
        // New customers are auto-approved — log them straight in and drop them
        // on the ordering page, where the "tell us your taste" questionnaire
        // appears so their favourites feed recipe generation right away.
        if (formData.role === "customer") {
          try {
            await login({ email: formData.email, password: formData.password });
            navigate("/order");
            return;
          } catch (loginErr) {
            // Auto-login failed (rare) — fall back to the manual login flow.
            console.warn("Auto-login after registration failed:", loginErr?.message);
          }
        }
        setSuccessMsg("Registration successful! Redirecting to login...");
        setTimeout(() => {
          navigate("/"); // Redirect to login page
        }, 2000);
      }
    } catch (error) {
      const message = error.response?.data?.message || "Registration failed. Please try again.";
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <h1 className="site-title">Smart Restaurant</h1>
      <div className="auth-box">
        <h2>Create Account</h2>

        {errorMsg && (
          <p style={{ color: "#ff4d4d", fontSize: "14px", textAlign: "center", marginBottom: "10px" }}>
            {errorMsg}
          </p>
        )}

        {successMsg && (
          <p style={{ color: "#27ae60", fontSize: "14px", textAlign: "center", marginBottom: "10px" }}>
            {successMsg}
          </p>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <input
            type="text"
            name="name"
            placeholder="Full Name"
            value={formData.name}
            onChange={handleChange}
            disabled={loading}
            required
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            disabled={loading}
            required
          />
          <input
            type="password"
            name="password"
            placeholder="Password (min 8 characters)"
            value={formData.password}
            onChange={handleChange}
            disabled={loading}
            required
          />
          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirm Password"
            value={formData.confirmPassword}
            onChange={handleChange}
            disabled={loading}
            required
          />

          <div className="form-group" style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", color: "#333", fontSize: "14px" }}>Select Role</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #ddd",
                fontSize: "14px",
                backgroundColor: "#fff"
              }}
            >
              <option value="customer">Customer</option>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <button type="submit" className="button" disabled={loading}>
            {loading ? "Registering..." : "Register"}
          </button>
        </form>

        <div className="login-footer">
          Already have an account? <Link to="/">Sign In</Link>
        </div>
      </div>
    </div>
  );
}
