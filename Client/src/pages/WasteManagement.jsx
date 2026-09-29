import { useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import api from "../api/axios";
import { aiCall } from "../api/aiCall";
import LoadingState from "../components/shared/LoadingState";
import ErrorState from "../components/shared/ErrorState";
import EmptyState from "../components/shared/EmptyState";
import WasteSummaryCards from "../components/waste/WasteSummaryCards";
import WasteByIngredientChart from "../components/waste/WasteByIngredientChart";
import WasteTrendChart from "../components/waste/WasteTrendChart";
import WasteByCategoryChart from "../components/waste/WasteByCategoryChart";
import NearExpiryTable from "../components/waste/NearExpiryTable";
import ConfirmationModal from "../components/shared/ConfirmationModal";
import PageHeader from "../components/shared/PageHeader";
import Card from "../components/shared/Card";
import Skeleton from "../components/shared/Skeleton";
import Badge from "../components/shared/Badge";
import {
  FaLeaf,
  FaChartLine,
  FaChartPie,
  FaChartArea,
  FaClock,
  FaBolt,
  FaUtensils,
} from "react-icons/fa";

export default function WasteManagement() {
  const [pageState, setPageState] = useState("loading");
  const [waste, setWaste] = useState(null);
  const [nearExpiry, setNearExpiry] = useState([]);
  const [nearExpiryError, setNearExpiryError] = useState(false);
  const [recipeFor, setRecipeFor] = useState(null);
  const [recipeState, setRecipeState] = useState("idle");
  const [recipe, setRecipe] = useState(null);

  async function load() {
    setPageState("loading");
    try {
      const [dRes, neRes] = await Promise.allSettled([
        api.get("/dashboard/admin"),
        api.get("/inventory/near-expiry"),
      ]);
      if (dRes.status === "rejected") {
        setPageState("error");
        return;
      }
      const dash = dRes.value.data.data ?? dRes.value.data;
      setWaste(dash.waste ?? dash.wasteAnalytics ?? null);
      if (neRes.status === "rejected") {
        setNearExpiry([]);
        setNearExpiryError(true);
      } else {
        setNearExpiry(neRes.value.data.data ?? neRes.value.data);
        setNearExpiryError(false);
      }
      setPageState("ready");
    } catch {
      setPageState("error");
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function generateRecipe(item) {
    setRecipeFor(item);
    setRecipeState("loading");
    setRecipe(null);
    const res = await aiCall("post", "/v1/ai/recipe", { ingredients: [item.name] });
    if (!res.ok) {
      setRecipeState(res.kind === "ai_unavailable" ? "ai-unavailable" : "error");
      return;
    }
    setRecipe(res.data);
    setRecipeState("ready");
  }

  return (
    <DashboardLayout>
      <div className="waste-page">
        <PageHeader
          kicker="Sustainability"
          title="Waste Management"
          subtitle="Track waste signals, identify trends, and rescue ingredients before they expire."
        />

        {pageState === "loading" && (
          <div className="waste-skeleton">
            <Skeleton.Card />
            <Skeleton.Card />
            <Skeleton.Card />
          </div>
        )}

        {pageState === "error" && (
          <ErrorState message="Failed to load dashboard." onRetry={load} />
        )}

        {pageState === "ready" && (
          <>
            {/* HERO BAND ------------------------------------------------ */}
            <div className="waste-hero">
              <div className="waste-hero-bg" aria-hidden />
              <div className="waste-hero-content">
                <div className="waste-hero-icon">
                  <FaLeaf />
                </div>
                <div className="waste-hero-text">
                  <span className="waste-hero-kicker">Eco Mission</span>
                  <h2 className="waste-hero-title">Reduce. Rescue. Reuse.</h2>
                  <p className="waste-hero-sub">
                    Every ingredient saved is revenue retained — and one step closer
                    to a more sustainable kitchen.
                  </p>
                </div>
                <div className="waste-hero-stats">
                  <div className="waste-hero-stat">
                    <span className="waste-hero-stat-label">Critical items</span>
                    <span className="waste-hero-stat-value">
                      {nearExpiry.filter((i) => (i.daysUntilExpiry ?? 99) <= 1).length}
                    </span>
                  </div>
                  <div className="waste-hero-stat">
                    <span className="waste-hero-stat-label">Expiring soon</span>
                    <span className="waste-hero-stat-value">{nearExpiry.length}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* SUMMARY -------------------------------------------------- */}
            {waste?.summary ? (
              <WasteSummaryCards summary={waste.summary} />
            ) : waste?.wastePercentage !== undefined ? (
              <WasteSummaryCards
                summary={{
                  monthTotalQuantity: waste.totalWasteQuantity ?? 0,
                  monthTotalValue: 0,
                  previousMonthTotalValue: 0,
                  reductionPctVsLastMonth: 0,
                }}
              />
            ) : (
              <EmptyState title="No waste data yet" message="" />
            )}

            {/* CHARTS GRID --------------------------------------------- */}
            <div className="waste-grid">
              <Section
                icon={<FaChartLine />}
                title="By ingredient"
                kicker="Top offenders"
                tone="red"
              >
                {(waste?.byIngredient ?? []).length === 0 ? (
                  <EmptyState title="No data" message="" />
                ) : (
                  <WasteByIngredientChart data={waste.byIngredient} />
                )}
              </Section>

              <Section
                icon={<FaChartPie />}
                title="By category"
                kicker="Distribution"
                tone="gold"
              >
                {(waste?.byCategory ?? []).length === 0 ? (
                  <EmptyState title="No data" message="" />
                ) : (
                  <WasteByCategoryChart data={waste.byCategory} />
                )}
              </Section>

              <Section
                icon={<FaChartArea />}
                title="Trend"
                kicker="Over time"
                tone="green"
              >
                {(waste?.trend ?? []).length === 0 ? (
                  <EmptyState title="No data" message="" />
                ) : (
                  <WasteTrendChart data={waste.trend} />
                )}
              </Section>

              <Section
                icon={<FaClock />}
                title="Near-expiry"
                kicker="Rescue queue"
                tone="warn"
                badge={
                  nearExpiry.length > 0 ? (
                    <Badge tone="warning" glow>
                      {nearExpiry.length} items
                    </Badge>
                  ) : null
                }
              >
                {nearExpiryError ? (
                  <ErrorState
                    message="Failed to load near-expiry items."
                    onRetry={load}
                  />
                ) : nearExpiry.length === 0 ? (
                  <EmptyState
                    title="Nothing expiring within 3 days"
                    message="Great work — keep it up!"
                  />
                ) : (
                  <NearExpiryTable items={nearExpiry} onUseInRecipe={generateRecipe} />
                )}
              </Section>
            </div>
          </>
        )}
      </div>

      <ConfirmationModal
        isOpen={!!recipeFor}
        title={`Recipe from ${recipeFor?.name ?? ""}`}
        body={
          <div>
            {recipeState === "loading" && (
              <LoadingState message="Generating recipe…" />
            )}
            {recipeState === "ai-unavailable" && (
              <ErrorState
                title="AI recipe service unavailable"
                message="Try again later."
                onRetry={() => generateRecipe(recipeFor)}
              />
            )}
            {recipeState === "error" && (
              <ErrorState
                message="Failed to generate recipe."
                onRetry={() => generateRecipe(recipeFor)}
              />
            )}
            {recipeState === "ready" && recipe && (
              <div className="recipe-preview">
                <h4 className="recipe-preview-title">
                  <FaUtensils /> {recipe.name}
                </h4>
                {recipe.description && (
                  <p className="recipe-preview-desc">{recipe.description}</p>
                )}
                <h5 className="recipe-preview-h5">Ingredients</h5>
                <ul className="recipe-preview-list">
                  {(recipe.ingredients ?? []).map((i, idx) => (
                    <li key={idx}>
                      {i.name ?? i}{" "}
                      {i.quantity ? `— ${i.quantity} ${i.unit ?? ""}` : ""}
                    </li>
                  ))}
                </ul>
                <h5 className="recipe-preview-h5">Steps</h5>
                <ol className="recipe-preview-steps">
                  {(recipe.steps ?? []).map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        }
        confirmLabel="Close"
        onConfirm={() => {
          setRecipeFor(null);
          setRecipeState("idle");
          setRecipe(null);
        }}
        onCancel={() => {
          setRecipeFor(null);
          setRecipeState("idle");
          setRecipe(null);
        }}
      />

      <style>{`
        .waste-page { padding: 28px; display: flex; flex-direction: column; gap: 22px; }
        .waste-skeleton { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }

        /* HERO BAND ----------------------------------------------------- */
        .waste-hero {
          position: relative;
          overflow: hidden;
          border-radius: var(--radius-xl);
          border: 1px solid var(--border-color);
          color: #fff;
          isolation: isolate;
          box-shadow: var(--shadow-elev);
        }
        .waste-hero-bg {
          position: absolute; inset: 0; z-index: -1;
          background:
            radial-gradient(700px 320px at 12% 0%, rgba(16,185,129,0.50), transparent 60%),
            radial-gradient(600px 320px at 95% 100%, rgba(155,226,45,0.35), transparent 60%),
            linear-gradient(135deg, #052e1a, #0B0C0F);
        }
        .waste-hero-bg::after {
          content: "";
          position: absolute; inset: 0;
          background-image:
            linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px);
          background-size: 32px 32px;
          mask-image: radial-gradient(circle at 30% 50%, #000, transparent 70%);
          -webkit-mask-image: radial-gradient(circle at 30% 50%, #000, transparent 70%);
        }
        .waste-hero-content {
          padding: 28px 32px;
          display: flex;
          align-items: center;
          gap: 22px;
          flex-wrap: wrap;
        }
        .waste-hero-icon {
          width: 64px; height: 64px;
          border-radius: 18px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(16,185,129,0.22);
          border: 1px solid rgba(16,185,129,0.4);
          color: var(--accent-green);
          font-size: 26px;
          flex-shrink: 0;
          box-shadow: 0 0 24px rgba(16,185,129,0.35);
        }
        .waste-hero-text { flex: 1; min-width: 240px; }
        .waste-hero-kicker {
          display: inline-block;
          font-family: var(--font-heading);
          font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase;
          color: rgba(255,255,255,0.7);
          margin-bottom: 4px;
        }
        .waste-hero-title {
          font-family: var(--font-heading);
          font-size: clamp(22px, 2.6vw, 30px);
          font-weight: 700;
          margin: 0;
          letter-spacing: -0.02em;
          background: linear-gradient(120deg, #fff 0%, #34D399 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .waste-hero-sub {
          color: rgba(255,255,255,0.72);
          margin: 6px 0 0 0;
          font-size: 14px;
          max-width: 56ch;
        }
        .waste-hero-stats {
          display: flex; gap: 10px; flex-wrap: wrap;
        }
        .waste-hero-stat {
          padding: 14px 18px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 14px;
          display: flex; flex-direction: column; gap: 4px;
          min-width: 130px;
        }
        .waste-hero-stat-label {
          font-family: var(--font-heading);
          font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase;
          color: rgba(255,255,255,0.6);
        }
        .waste-hero-stat-value {
          font-family: var(--font-heading);
          font-size: 24px; font-weight: 700;
          letter-spacing: -0.02em;
        }

        /* CHARTS GRID --------------------------------------------------- */
        .waste-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }
        @media (max-width: 1024px) {
          .waste-grid { grid-template-columns: 1fr; }
        }

        /* RECIPE PREVIEW ------------------------------------------------ */
        .recipe-preview { display: flex; flex-direction: column; gap: 10px; }
        .recipe-preview-title {
          font-family: var(--font-heading);
          font-size: 18px; font-weight: 700;
          margin: 0;
          color: var(--text-primary);
          display: inline-flex; align-items: center; gap: 8px;
        }
        .recipe-preview-title :global(svg) { color: var(--accent-gold); }
        .recipe-preview-desc {
          color: var(--text-secondary); margin: 0; font-size: 13px;
        }
        .recipe-preview-h5 {
          font-family: var(--font-heading);
          font-size: 12px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--accent-gold);
          margin: 6px 0 4px 0;
          font-weight: 600;
        }
        .recipe-preview-list, .recipe-preview-steps {
          margin: 0; padding-left: 20px; font-size: 13px;
          color: var(--text-secondary); line-height: 1.6;
        }
      `}</style>
    </DashboardLayout>
  );
}

function Section({ icon, title, kicker, tone = "red", badge, children }) {
  return (
    <>
      <div className={`waste-section waste-section-${tone}`}>
        <div className="waste-section-head">
          <div className="waste-section-id">
            <div className="waste-section-icon">{icon}</div>
            <div>
              <span className="waste-section-kicker">{kicker}</span>
              <h3 className="waste-section-title">{title}</h3>
            </div>
          </div>
          {badge}
        </div>
        <div className="waste-section-body">{children}</div>
      </div>
      <style>{`
        .waste-section {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 22px;
          box-shadow: var(--shadow-soft);
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .waste-section::before {
          content: "";
          position: absolute; left: 0; top: 0; bottom: 0;
          width: 3px;
        }
        .waste-section-red::before { background: var(--accent-red); }
        .waste-section-gold::before { background: var(--accent-gold); }
        .waste-section-green::before { background: var(--accent-green); }
        .waste-section-warn::before { background: #F59E0B; }

        .waste-section-head {
          display: flex; justify-content: space-between; align-items: center;
          gap: 14px; flex-wrap: wrap;
        }
        .waste-section-id { display: flex; align-items: center; gap: 12px; }
        .waste-section-icon {
          width: 38px; height: 38px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px;
          flex-shrink: 0;
        }
        .waste-section-red .waste-section-icon { background: rgba(215,38,56,0.12); color: var(--accent-red); }
        .waste-section-gold .waste-section-icon { background: rgba(155,226,45,0.14); color: var(--accent-gold); }
        .waste-section-green .waste-section-icon { background: rgba(16,185,129,0.12); color: var(--accent-green); }
        .waste-section-warn .waste-section-icon { background: rgba(245,158,11,0.14); color: #F59E0B; }
        .waste-section-kicker {
          display: block;
          font-family: var(--font-heading);
          font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase;
          color: var(--text-muted); font-weight: 600;
        }
        .waste-section-title {
          font-family: var(--font-heading);
          font-size: 16px; font-weight: 700;
          margin: 2px 0 0 0;
          letter-spacing: -0.01em;
          color: var(--text-primary);
        }
      `}</style>
    </>
  );
}
