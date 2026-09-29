import "../../styles/auth.css";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState(""); 
  const { login, loading } = useAuth(); 
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(""); 
    try {
      const user = await login({ email, password });
      
      // Route based on user role
      if (user?.role === "admin" || user?.role === "staff") {
        navigate("/dashboard");
      } else if (user?.role === "customer") {
        navigate("/order");
      } else {
        navigate("/dashboard");
      }
      
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Invalid email or password. Please try again.";
      setErrorMsg(errorMessage);
      console.error("Login failed:", error);
    }
  };

  return (
    <div className="auth-container">
      <h1 className="site-title">Smart Restaurant</h1>
      
      <div className="auth-box">
        <form className="login-form" onSubmit={handleSubmit}>
          <h2 className="login-title">Login</h2>
          
          {errorMsg && <p style={{ color: '#ff4d4d', fontSize: '14px', textAlign: 'center', marginBottom: '15px' }}>{errorMsg}</p>}

          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}     
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />

          <button type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="login-footer">
          Don't have an account? <Link to="/register">Sign Up</Link>
        </div>
      </div>
    </div>
  );
}
