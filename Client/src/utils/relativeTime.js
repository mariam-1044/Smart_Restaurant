export function relativeTime(input) {
  if (!input) return "";
  const then = new Date(input).getTime();
  const diff = Math.max(0, Date.now() - then);
  const sec  = Math.round(diff / 1000);
  if (sec < 5)        return "just now";
  if (sec < 60)       return `${sec} second${sec === 1 ? "" : "s"} ago`;
  const min = Math.round(sec / 60);
  if (min < 60)       return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr  = Math.round(min / 60);
  if (hr < 24)        return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.round(hr / 24);
  if (day < 30)       return `${day} day${day === 1 ? "" : "s"} ago`;
  return new Date(input).toLocaleDateString();
}