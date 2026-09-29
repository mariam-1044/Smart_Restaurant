import { useEffect, useRef, useState, useCallback } from "react";
import { list, unreadCount, markRead as apiMarkRead, markAllRead as apiMarkAllRead } from "../api/notifications";

const POLL_MS = 30_000;

export default function useNotifications() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);
  const [pageState, setPageState] = useState("loading");
  const [listState, setListState] = useState("idle");
  const intervalRef = useRef(null);
  const inFlightRef = useRef(false);

  const refreshCount = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const c = await unreadCount();
      setCount(c);
      setPageState("ready");
    } catch {
      setPageState("api-error");
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  const refreshList = useCallback(async () => {
    setListState("loading");
    try {
      const { items } = await list({ limit: 20 });
      setItems(items);
      setListState("ready");
    } catch {
      setListState("error");
    }
  }, []);

  const armPolling = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(refreshCount, POLL_MS);
  }, [refreshCount]);

  const disarmPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    refreshCount();
    armPolling();
    const onVisibility = () => {
      if (document.hidden) disarmPolling();
      else { refreshCount(); armPolling(); }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      disarmPolling();
    };
  }, [refreshCount, armPolling, disarmPolling]);

  const open = useCallback(() => { if (listState === "idle") refreshList(); }, [listState, refreshList]);
  const close = useCallback(() => {}, []);

  const markReadOptimistic = useCallback(async (id) => {
    setItems(prev => {
      const target = prev.find(i => i._id === id);
      if (target && !target.read) setCount(c => Math.max(0, c - 1));
      return prev.map(i => i._id === id ? { ...i, read: true, readAt: new Date().toISOString() } : i);
    });
    try { await apiMarkRead(id); } catch { await refreshCount(); await refreshList(); }
  }, [refreshCount, refreshList]);

  const markAllReadOptimistic = useCallback(async () => {
    setItems(prev => prev.map(i => i.read ? i : { ...i, read: true, readAt: new Date().toISOString() }));
    setCount(0);
    try { await apiMarkAllRead(); } catch { await refreshCount(); await refreshList(); }
  }, [refreshCount, refreshList]);

  return { count, items, pageState, listState, open, close, refresh: () => { refreshCount(); refreshList(); }, markReadOptimistic, markAllReadOptimistic };
}