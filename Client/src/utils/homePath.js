// The "home" route for a user depends on their current login status/role.
// Admin & staff land on the dashboard; customers land on the ordering page;
// everyone else (logged out) goes to the login page at "/".
export default function homePathForRole(role) {
  if (role === "admin" || role === "staff") return "/dashboard";
  if (role === "customer") return "/order";
  return "/";
}
