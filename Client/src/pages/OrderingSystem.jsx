import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/orderingSystem.css";
import { FaUserCircle, FaSearch, FaSignOutAlt, FaHeart } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import useOrders from "../hooks/useOrders";
import { listMenu } from "../api/menuApi";
import { listPeerEndorsements } from "../api/aiApi";
import api from "../api/axios";
import homePathForRole from "../utils/homePath";
import PreferencesQuestionnaire from "../components/PreferencesQuestionnaire";

const CATEGORIES = ["Pizza", "Grills", "Drinks", "Desserts", "Sides", "Main", "Burgers", "Pasta"];

const OrderingSystem = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dishes, setDishes] = useState([]);
  const [selectedTab, setSelectedTab] = useState("Pizza");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [userData, setUserData] = useState({ name: "", tableNumber: "", phone: "" });
  const [submittedName, setSubmittedName] = useState("");
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [peerRecipes, setPeerRecipes] = useState([]);
  const [recommended, setRecommended] = useState([]);

  const {
    basket,
    grandTotal,
    submitting,
    error,
    addToBasket,
    changeCount,
    submitOrder,
  } = useOrders();

  useEffect(() => {
    fetchDishes();
    if (user && user.role === "customer") {
      setUserData({ name: user.name || "", tableNumber: "", phone: "" });
      checkPreferences();
      fetchPeerRecipes();
      fetchRecommendations();
    }
  }, [user]);

  const checkPreferences = async () => {
    try {
      const r = await api.get("/v1/preferences/me");
      if (r.data.success && !r.data.data) setShowQuestionnaire(true);
    } catch {
      /* ignore */
    }
  };

  const fetchPeerRecipes = async () => {
    try {
      const data = await listPeerEndorsements(8);
      setPeerRecipes(data || []);
    } catch {
      /* ignore */
    }
  };

  const fetchRecommendations = async () => {
    if (!user?._id) return;
    try {
      const r = await api.get(`/v1/recommendations/${user._id}`);
      setRecommended(r.data?.recommendations || []);
    } catch {
      /* ignore */
    }
  };

  const fetchDishes = async () => {
    try {
      const data = await listMenu();
      setDishes(data);
    } catch (err) {
      console.error("Error fetching dishes:", err);
    }
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    const result = await submitOrder({
      name: userData.name,
      phone: userData.phone,
      tableNumber: userData.tableNumber,
    });
    if (result.ok) {
      setSubmittedName(userData.name);
      setIsModalOpen(false);
      setShowSuccess(true);
      setUserData({ name: user?.name || "", tableNumber: "", phone: "" });
    }
  };

  const filteredItems = dishes.filter(
    (f) =>
      (f.category === selectedTab || !selectedTab) &&
      f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const hasPeerBanner = peerRecipes.length > 0;

  return (
    <div className={`main-layout ${hasPeerBanner ? "has-peer-banner" : ""}`}>
      <aside className="side-navigation">
        <div
          className="brand-box"
          role="button"
          tabIndex={0}
          title="Go to home"
          style={{ cursor: "pointer" }}
          onClick={() => navigate(homePathForRole(user?.role))}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") navigate(homePathForRole(user?.role));
          }}
        >
          Gusteau <span>·</span>
        </div>
        <div className="menu-categories">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`cat-link ${selectedTab === cat ? "active" : ""}`}
              onClick={() => setSelectedTab(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </aside>

      <div className="right-side-container">
        <nav className="top-navbar">
          <div className="nav-search">
            <FaSearch className="nav-search-glyph" />
            <input
              type="text"
              placeholder="Search food…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="nav-title">Smart Restaurant — POS</div>
          <div className="user-profile">
            <span>Welcome, <strong>{user?.name || "Guest"}</strong></span>
            <FaUserCircle className="profile-icon" />
            {user?.role === "customer" && (
              <button
                type="button"
                className="nav-likes-btn"
                title="Edit my likes"
                onClick={() => setShowQuestionnaire(true)}
              >
                <FaHeart /> <span>My likes</span>
              </button>
            )}
            <button
              type="button"
              className="nav-logout-btn"
              title="Log out"
              onClick={() => {
                logout();
                navigate("/");
              }}
            >
              <FaSignOutAlt /> <span>Logout</span>
            </button>
          </div>
        </nav>

        <div className="content-body">
          <main className="items-display">
            {user?.role === "customer" && recommended.length > 0 && (
              <div className="reco-strip">
                <div className="reco-strip-title">★ Recommended for you</div>
                <div className="reco-strip-row">
                  {recommended.map((rec) => {
                    const dish = dishes.find((d) => d._id === rec.dishId);
                    return (
                      <button
                        type="button"
                        key={rec.dishId}
                        className="reco-card"
                        title={dish ? `Add ${dish.name} to basket` : rec.reason}
                        disabled={!dish}
                        onClick={() => dish && addToBasket(dish)}
                      >
                        <div className="reco-card-name">{rec.name || dish?.name || "Dish"}</div>
                        <div className="reco-card-reason">{rec.reason}</div>
                        {dish && <div className="reco-card-price">EGP {Number(dish.price).toFixed(2)}</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="items-display-head">
              <h3>{selectedTab} Menu</h3>
              <span className="items-display-count">{filteredItems.length} items</span>
            </div>
            <div className="items-grid">
              {filteredItems.map((food) => (
                <div key={food._id} className="food-item-card">
                  <div className="food-item-image-wrap">
                    <img
                      src={food.imageUrl || "/default-dish.svg"}
                      alt={food.name}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = "/default-dish.svg";
                      }}
                    />
                  </div>
                  <div className="food-item-info">
                    <h4>{food.name}</h4>
                    <p className="food-item-desc">{food.description}</p>
                    <div className="price-action">
                      <span className="price">EGP {Number(food.price).toFixed(2)}</span>
                      <button onClick={() => addToBasket(food)} aria-label="Add to basket">
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredItems.length === 0 && (
                <div className="items-empty">No dishes match your search in {selectedTab}.</div>
              )}
            </div>
          </main>

          <section className="checkout-panel">
            <div className="cart-header">
              Your Order
              {basket.length > 0 && (
                <span className="cart-count">{basket.reduce((s, i) => s + i.count, 0)} items</span>
              )}
            </div>
            <div className="cart-items-list">
              {basket.length === 0 ? (
                <p className="empty-msg">Your basket is empty</p>
              ) : (
                basket.map((item) => (
                  <div key={item._id} className="cart-item-row">
                    <div className="item-meta">
                      <span className="item-name">{item.name}</span>
                      <span className="item-price">EGP {(item.price * item.count).toFixed(2)}</span>
                    </div>
                    <div className="item-controls">
                      <button onClick={() => changeCount(item._id, -1)}>-</button>
                      <span>{item.count}</span>
                      <button onClick={() => changeCount(item._id, 1)}>+</button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="cart-summary">
              <div className="total-line">
                <span>Total</span>
                <strong>EGP {grandTotal.toFixed(2)}</strong>
              </div>
              <button
                className="btn-confirm-order"
                disabled={basket.length === 0 || submitting}
                onClick={() => setIsModalOpen(true)}
              >
                {submitting ? "Processing…" : "Checkout"}
              </button>
            </div>
          </section>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Customer Information</h3>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            {error && <div className="order-error">{error}</div>}
            <form onSubmit={handleFinalSubmit} className="customer-details-form">
              <div className="input-group">
                <label htmlFor="checkout-name">Full Name</label>
                <input
                  id="checkout-name"
                  type="text"
                  required
                  value={userData.name}
                  onChange={(e) => setUserData({ ...userData, name: e.target.value })}
                />
              </div>
              <div className="input-group">
                <label htmlFor="checkout-table">Table Number</label>
                <input
                  id="checkout-table"
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 12"
                  value={userData.tableNumber}
                  onChange={(e) => setUserData({ ...userData, tableNumber: e.target.value })}
                />
              </div>
              <div className="input-group">
                <label htmlFor="checkout-phone">Phone Number</label>
                <input
                  id="checkout-phone"
                  type="tel"
                  required
                  value={userData.phone}
                  onChange={(e) => setUserData({ ...userData, phone: e.target.value })}
                />
              </div>
              <button type="submit" className="submit-order-btn" disabled={submitting}>
                {submitting ? "Confirming…" : "Confirm Order"}
              </button>
            </form>
          </div>
        </div>
      )}

      {showSuccess && (
        <div className="modal-overlay">
          <div className="success-card">
            <div className="success-icon">✓</div>
            <h2>Order Confirmed</h2>
            <p>
              Thank you <strong>{submittedName}</strong>, your order has been received.
            </p>
            <button className="done-btn" onClick={() => setShowSuccess(false)}>
              Back to Menu
            </button>
          </div>
        </div>
      )}

      {showQuestionnaire && (
        <PreferencesQuestionnaire
          onClose={() => setShowQuestionnaire(false)}
          onSaved={() => {
            setShowQuestionnaire(false);
            fetchPeerRecipes();
            fetchRecommendations();
          }}
        />
      )}

      {peerRecipes.length > 0 && (
        <div className="peer-recipes-banner">
          <div className="peer-recipes-title">✦ Loved by other diners</div>
          <div className="peer-recipes-row">
            {peerRecipes.map((r) => (
              <div
                key={r.dishId}
                className="peer-recipe-card"
                onClick={() => {
                  const dish = dishes.find((d) => d._id === r.dishId);
                  if (dish) addToBasket(dish);
                }}
              >
                <div className="peer-recipe-name">{r.name}</div>
                <div className="peer-recipe-meta">
                  <span className="peer-rating">{"★".repeat(r.rating)}</span>
                  <span className="peer-handle">{r.endorser}</span>
                </div>
                <div className="peer-recipe-price">EGP {Number(r.price).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .nav-likes-btn, .nav-logout-btn {
          display: inline-flex; align-items: center; gap: 6px;
          margin-left: 10px; padding: 7px 12px;
          border-radius: 10px; border: 1px solid var(--border-color, #e5e5e5);
          background: transparent; color: var(--text-secondary, #555);
          font-size: 13px; font-weight: 600; cursor: pointer;
          transition: all 160ms ease;
        }
        .nav-likes-btn:hover { border-color: var(--accent-gold, #C9A227); color: var(--accent-gold, #C9A227); }
        .nav-logout-btn:hover { border-color: var(--accent-red, #d72638); color: var(--accent-red, #d72638); }

        .reco-strip {
          margin-bottom: 22px; padding: 16px;
          border: 1px solid color-mix(in srgb, var(--accent-gold, #C9A227) 30%, transparent);
          border-radius: var(--radius-lg, 14px);
          background: rgba(155,226,45,0.06);
        }
        .reco-strip-title {
          font-family: var(--font-heading); font-weight: 700; font-size: 13px;
          letter-spacing: 0.06em; text-transform: uppercase;
          color: var(--accent-gold, #C9A227); margin-bottom: 12px;
        }
        .reco-strip-row { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 4px; }
        .reco-card {
          flex: 0 0 auto; width: 190px; text-align: left;
          padding: 12px 14px; border-radius: 12px; cursor: pointer;
          border: 1px solid var(--border-color, #e5e5e5);
          background: var(--bg-card, #fff); color: var(--text-primary, #111);
          transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
        }
        .reco-card:hover:not(:disabled) { transform: translateY(-2px); border-color: var(--accent-gold, #C9A227); box-shadow: 0 6px 18px rgba(0,0,0,0.12); }
        .reco-card:disabled { opacity: 0.55; cursor: default; }
        .reco-card-name { font-weight: 700; font-size: 14px; margin-bottom: 4px; }
        .reco-card-reason { font-size: 12px; color: var(--text-muted, #777); line-height: 1.35; margin-bottom: 8px; }
        .reco-card-price { font-size: 13px; font-weight: 700; color: var(--accent-gold, #C9A227); }

        .items-display-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 18px; }
        .items-display-count {
          font-family: var(--font-heading);
          font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase;
          color: var(--text-muted);
        }
        .items-empty {
          grid-column: 1 / -1;
          padding: 40px;
          text-align: center;
          color: var(--text-muted);
          border: 1px dashed var(--border-color);
          border-radius: var(--radius-lg);
        }
        .food-item-image-wrap { position: relative; overflow: hidden; }
        .food-item-image-wrap::after {
          content: ""; position: absolute; inset: 0;
          background: linear-gradient(180deg, rgba(0,0,0,0) 60%, rgba(0,0,0,0.35) 100%);
          pointer-events: none;
        }
        .food-item-desc { font-size: 12px; color: var(--text-muted); margin: 0 0 10px 0; min-height: 32px; line-height: 1.4; }

        .nav-search { position: relative; display: flex; align-items: center; }
        .nav-search-glyph { position: absolute; left: 14px; color: var(--text-muted); font-size: 12px; pointer-events: none; }
        .nav-search input { padding: 9px 14px 9px 36px !important; min-width: 240px; }
        .user-profile { display: flex; align-items: center; gap: 10px; justify-self: end; }
        .user-profile .profile-icon { color: var(--accent-gold) !important; font-size: 26px; }

        .cart-count {
          float: right;
          font-size: 11px;
          color: var(--accent-gold);
          font-family: var(--font-heading);
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .total-line { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; font-family: var(--font-heading); font-size: 16px; }
        .total-line strong { font-size: 22px; color: var(--accent-gold); letter-spacing: -0.01em; }
        .empty-msg { color: var(--text-muted); font-size: 13px; text-align: center; padding: 16px; }

        .order-error {
          background: var(--status-danger-bg); color: var(--status-danger-fg);
          padding: 10px 12px; border-radius: 10px; margin-bottom: 12px; font-size: 13px;
          border: 1px solid rgba(215,38,56,0.32);
        }

        /* The peer-recipes banner is fixed to the bottom of the viewport. It must
           never sit on top of the 340px checkout panel (which holds the Checkout
           button), otherwise customers cannot complete their order. We stop the
           banner short of the checkout panel and pad the scroll areas so nothing
           is hidden behind it. */
        .peer-recipes-banner {
          position: fixed; bottom: 18px; left: 18px; right: 358px;
          background: var(--bg-secondary, #fff);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg, 12px);
          padding: 14px 18px;
          box-shadow: var(--shadow-elev, 0 8px 24px rgba(0,0,0,0.18));
          backdrop-filter: blur(14px);
          z-index: 50;
        }
        .has-peer-banner .items-display { padding-bottom: 168px; }
        .has-peer-banner .cart-items-list { padding-bottom: 24px; }
        @media (max-width: 900px) {
          .peer-recipes-banner { right: 18px; }
          .has-peer-banner .checkout-panel { padding-bottom: 150px; }
        }
        .peer-recipes-title { font-family: var(--font-heading); font-weight: 700; color: var(--accent-gold); margin-bottom: 10px; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; }
        .peer-recipes-row { display: flex; gap: 10px; overflow-x: auto; }
        .peer-recipe-card {
          flex: 0 0 220px;
          padding: 12px 14px;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          cursor: pointer;
          background: var(--bg-card);
          transition: all 220ms var(--ease-out-expo);
        }
        .peer-recipe-card:hover { border-color: var(--accent-gold); transform: translateY(-2px); }
        .peer-recipe-name { font-weight: 600; font-size: 13px; color: var(--text-primary); line-height: 1.3; }
        .peer-recipe-meta { display: flex; justify-content: space-between; align-items: center; margin: 6px 0; font-size: 11px; }
        .peer-rating { color: var(--accent-gold); }
        .peer-handle { color: var(--text-muted); }
        .peer-recipe-price { font-size: 13px; color: var(--accent-red); font-weight: 700; font-family: var(--font-heading); }
      `}</style>
    </div>
  );
};

export default OrderingSystem;
