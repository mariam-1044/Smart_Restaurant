import React from "react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import "../styles/layout.css";

export default function DashboardLayout({
  children,
  inventoryItems = [],
  setFilteredItems,
  onAddItem,
  onExport,
  onExportFiltered,
  hasActiveFilter,
  searchTerm,
  setSearchTerm,
}) {
  return (
    <div className="App">
      <div className="AppGlass">
        <Sidebar />
        <div className="main-layout-content">
          <Navbar
            inventoryItems={inventoryItems}
            setFilteredItems={setFilteredItems}
            onAddItem={onAddItem}
            onExport={onExport}
            onExportFiltered={onExportFiltered}
            hasActiveFilter={hasActiveFilter}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
          />
          <div className="main-content page-fade" key={typeof window !== "undefined" ? window.location.pathname : "page"}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
