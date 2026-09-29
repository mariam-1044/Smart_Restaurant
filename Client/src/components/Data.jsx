import {FaHome, FaBoxOpen, FaChartLine, FaUtensils, FaLightbulb, FaFileAlt, FaCog, FaShoppingCart, FaUsers, FaChartArea, FaTag, FaUserFriends, FaTrash} from "react-icons/fa";

export const SidebarData = [
    { icon: FaHome,     heading: "Dashboard",       path: "/dashboard", roles: ["admin", "staff"] },
    { icon: FaBoxOpen,  heading: "Inventory",        path: "/inventory", roles: ["admin", "staff"] },
    { icon: FaShoppingCart, heading: "Ordering System", path: "/order",  roles: ["customer", "admin", "staff"] },
    { icon: FaChartLine,heading: "Sales",            path: "/sales",     roles: ["admin", "staff"] },
    { icon: FaUtensils, heading: "Menu",             path: "/admin/menu",   roles: ["admin"] },
    { icon: FaUsers,    heading: "Users",            path: "/admin/users",  roles: ["admin"] },
    { icon: FaChartArea,heading: "Forecast",          path: "/ai/forecast",  roles: ["admin"] },
    { icon: FaTag,      heading: "Pricing",          path: "/ai/pricing",   roles: ["admin"] },
    { icon: FaUserFriends, heading: "Customers",     path: "/customers",    roles: ["admin", "staff"] },
    { icon: FaTrash,    heading: "Waste",            path: "/waste",        roles: ["admin"] },
    { icon: FaUtensils, heading: "Recipe Generator", path: "/recipes",  roles: ["admin", "staff"] },
    { icon: FaLightbulb,heading: "Recommend",         path: "/recommend",roles: ["admin", "staff"] },
    { icon: FaFileAlt,  heading: "Report",            path: "/report",   roles: ["admin"] },
    { icon: FaCog,      heading: "Setting",           path: "/setting",  roles: ["admin", "staff", "customer"] },
];