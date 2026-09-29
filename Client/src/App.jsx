import { BrowserRouter, Routes, Route } from "react-router-dom";
import {AuthProvider} from "./context/AuthContext";
import { ToastProvider } from './components/toast/ToastContext';
import ToastContainer from './components/toast/ToastContainer';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from "./routes/ProtectedRoute";
import OrderingSystem from "./pages/OrderingSystem";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import Dashboard from "./pages/Dashboard";
import Sales from "./pages/Sales";
import Inventory from "./pages/Inventory";
import Recipes from "./pages/Recipes";
import Sidebar from "./components/Sidebar"
import Dashboardlayut from "./layouts/DashboardLayout";
import Recommendation from "./pages/Recommendation";
import Setting from "./pages/Setting";
import Report from "./pages/Report";
import MenuManagement from "./pages/admin/MenuManagement";
import UserManagement from "./pages/admin/UserManagement";
import DemandForecast from "./pages/ai/DemandForecast";
import DynamicPricing from "./pages/ai/DynamicPricing";
import CustomerManagement from "./pages/CustomerManagement";
import WasteManagement from "./pages/WasteManagement";
import InventoryDetail from "./pages/InventoryDetail";
import OrderDetail from "./pages/OrderDetail";

export default function App() {
  return (
    <ToastProvider>
      <ThemeProvider>
      <AuthProvider> 
        <BrowserRouter>
          <Routes>
            {/* Public routes (no login required) */}
            <Route path="/" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected routes (require login) */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>}/>
            <Route path="/order" element={<ProtectedRoute><OrderingSystem /></ProtectedRoute>}/>
            <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>}/>
            <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>}/>
            <Route path="/inventory/:id" element={<ProtectedRoute><InventoryDetail /></ProtectedRoute>}/>
            <Route path="/orders/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>}/>
            <Route path="/recipes" element={<ProtectedRoute><Recipes /></ProtectedRoute>}/>
            <Route path="/report" element={<ProtectedRoute><Report/></ProtectedRoute>}/>
            <Route path="/recommend" element={<ProtectedRoute><Recommendation /></ProtectedRoute>}/>
            <Route path="/setting" element={<ProtectedRoute><Setting /></ProtectedRoute>}/>
            <Route path="/admin/menu" element={<ProtectedRoute roles={["admin"]}><MenuManagement /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute roles={["admin"]}><UserManagement /></ProtectedRoute>} />
            <Route path="/ai/forecast" element={<ProtectedRoute roles={["admin"]}><DemandForecast /></ProtectedRoute>} />
            <Route path="/ai/pricing" element={<ProtectedRoute roles={["admin"]}><DynamicPricing /></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute roles={["admin","staff"]}><CustomerManagement /></ProtectedRoute>} />
            <Route path="/waste" element={<ProtectedRoute roles={["admin"]}><WasteManagement /></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
        <ToastContainer />
      </ThemeProvider>
    </ToastProvider>
  );
}