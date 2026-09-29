
# Claude Implementation Plan: Frontend Architecture Refactor & Geatsu UI Redesign

## Context & Objective
You are Claude, acting as a Staff-Level Frontend Engineer. Your mission is to implement a comprehensive two-part update for the Smart Restaurant Ecosystem's frontend:
1. **Architectural Refactor & Issue Resolution**: Fix all known frontend stubs (PDF/CSV exports, dark mode), remove bloated logic from UI components, and establish a professional React architecture (Custom Hooks, API layers, Shared Components).
2. **UI/UX Redesign**: Transform the application into the "Geatsu" brand—a premium, futuristic "Neo Tokyo Minimal" smart dining experience.

This document serves as your step-by-step execution plan. Please follow the phases in order and implement the changes directly in the codebase.

## Tech Stack Constraints
- **Stack:** React 19, Vite, React Router v7, TailwindCSS v4
- **Critical Rule:** Do not break existing backend integrations. All `axios` calls must continue reaching the correct endpoints.

---

## Phase 1: Establish the "Geatsu" Design System & Shared Components
**Goal:** Centralize the UI so pages don't have duplicated Tailwind classes.

1. **Global CSS & Tokens (`Client/src/styles/index.css`)**:
   - Apply the Geatsu Color System using CSS variables:
     `--bg-primary: #0F0F10;`
     `--bg-secondary: #16181D;`
     `--card-bg: rgba(255,255,255,0.04);`
     `--text-primary: #F5F5F2;`
     `--text-secondary: #A1A1AA;`
     `--accent-red: #D72638;`
     `--accent-gold: #C9A227;`
     `--border-color: rgba(255,255,255,0.08);`
   - Import `Outfit` and `Inter` fonts from Google Fonts. 
   - Set the body background to `--bg-primary` and text to `--text-primary`.

2. **Create Core Reusable Components (`Client/src/components/shared/`)**:
   - **`Button.jsx`**: Create variants (`primary` using `--accent-red` with glow, `secondary`, `danger`). Use `framer-motion` for `whileHover={{ scale: 1.02 }}`.
   - **`Card.jsx`**: Implement Geatsu glassmorphism (`bg-[var(--card-bg)] border-[var(--border-color)] backdrop-blur-sm rounded-2xl`).
   - **`Input.jsx`**: Dark inputs with `--accent-gold` focus rings.
   - **`Badge.jsx`**: Glowing status badges (e.g., active = green text + dark green bg + glow).
   - **`PageHeader.jsx`**: Cinematic typography for page titles.
   - **`Skeleton.jsx`**: Premium pulsating dark loaders (to replace generic spinners).

---

## Phase 2: Architectural Refactor & Logic Extraction
**Goal:** Slim down massive components (e.g., `Recipes.jsx`, `Inventory.jsx`, `OrderingSystem.jsx`) by separating concerns.

1. **API Layer (`Client/src/api/`)**:
   - Centralize all `axios` calls here (create files like `inventoryApi.js`, `menuApi.js`, `aiApi.js`). 
   - Ensure there are no direct `axios.get` calls inside React components.
2. **Custom Hooks (`Client/src/hooks/`)**:
   - Extract data fetching and state logic into custom hooks.
   - Create `useInventory.js`, `useOrders.js`, and `useRecipes.js`.
   - *Example task*: Move the recipe generation logic out of `Recipes.jsx` into `useRecipes.js`.
3. **Decouple POS from Admin Logic**:
   - Audit `OrderingSystem.jsx`. Strip out any hidden Admin menu-management logic and move it entirely into `Client/src/pages/admin/MenuManagement.jsx` (create if it doesn't exist).
   - Ensure `OrderingSystem.jsx` is strictly a Point-of-Sale (POS) interface.

---

## Phase 3: Resolve Stubs & Known Frontend Issues
**Goal:** Fix broken/stubbed features highlighted in previous project audits.

1. **PDF Export Feature (`Report.jsx` or similar)**:
   - Install `html2canvas` and `jspdf` if missing.
   - Replace any `alert("Exporting...")` stubs with real logic to capture the report div and trigger a PDF download.
2. **CSV Inventory Export (`Inventory.jsx`)**:
   - Wire the "Export CSV" button to correctly fetch from the `/api/inventory/export` endpoint using `responseType: 'blob'` and trigger an anchor tag download.
3. **Functional Dark Mode**:
   - Wire the Dark Mode toggle in `Setting.jsx` to inject a `data-theme="dark"` attribute into the `<html>` root. Ensure it interacts cleanly with the new Geatsu theme tokens.
4. **Settings Profile Update**:
   - Ensure `Setting.jsx` successfully submits to `PATCH /auth/update-profile` and shows a premium Toast notification upon success.

---

## Phase 4: Page Iterations & Redesign Application
**Goal:** Apply the Geatsu components and logic hooks to all pages. Please execute these systematically, replacing old HTML/Tailwind with the new `shared` components.

1. **Navigation (`Navbar.jsx` & `Sidebar.jsx`)**:
   - **Navbar**: Sticky, transparent, `backdrop-blur-md`, subtle bottom border.
   - **Sidebar**: Neo Tokyo control panel styling. Use Framer Motion for smooth collapse/expand animations.
2. **Dashboard (`Dashboard.jsx`)**:
   - Refactor into a "Smart Restaurant Control Center". 
   - Use dark mode variants for Recharts (remove white backgrounds, use transparent grids).
3. **Ordering System (`OrderingSystem.jsx`)**:
   - Update to use large cinematic food imagery, elegant pricing fonts, and category pill filters with active glow states.
4. **AI & Waste Pages (`Recipes.jsx`, `WasteManagement.jsx`, `DemandForecast.jsx`)**:
   - Implement the new `Skeleton.jsx` loaders while AI models are "thinking". 
   - Apply Geatsu `Card` components for displaying insights.

---

## Phase 5: Final Polish
1. **Framer Motion Wrappers**: Wrap the main `<Outlet />` or page containers in a subtle `framer-motion` fade-in animation (`initial={{ opacity: 0, y: 10 }}`).
2. **Responsive Audit**: Ensure grid layouts on the POS and Dashboard collapse cleanly on mobile, behaving like a premium native application.

**Claude, please acknowledge this plan and confirm when you are ready to begin Phase 1.**
