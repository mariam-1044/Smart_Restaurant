import { useCallback, useState } from "react";
import { createOrder } from "../api/ordersApi";

/**
 * useOrders — basket + checkout state for the POS surface.
 * Pure POS concerns; admin menu CRUD lives elsewhere.
 */
export default function useOrders() {
  const [basket, setBasket] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const addToBasket = useCallback((dish) => {
    setBasket((current) => {
      const existing = current.find((i) => i._id === dish._id);
      if (existing) {
        return current.map((i) =>
          i._id === dish._id ? { ...i, count: i.count + 1 } : i
        );
      }
      return [...current, { ...dish, count: 1 }];
    });
  }, []);

  const changeCount = useCallback((id, delta) => {
    setBasket((current) =>
      current
        .map((i) => (i._id === id ? { ...i, count: Math.max(0, i.count + delta) } : i))
        .filter((i) => i.count > 0)
    );
  }, []);

  const clearBasket = useCallback(() => setBasket([]), []);

  const grandTotal = basket.reduce((acc, i) => acc + i.price * i.count, 0);

  const submitOrder = useCallback(
    async (customerInfo) => {
      setSubmitting(true);
      setError("");
      try {
        const payload = {
          items: basket.map((i) => ({ dish: i._id, quantity: i.count })),
          customerInfo,
          source: "Online",
          paymentMethod: "Cash",
        };
        const data = await createOrder(payload);
        clearBasket();
        return { ok: true, data };
      } catch (err) {
        const message =
          err.response?.data?.message || "Error creating order. Please try again.";
        setError(message);
        return { ok: false, error: message };
      } finally {
        setSubmitting(false);
      }
    },
    [basket, clearBasket]
  );

  return {
    basket,
    grandTotal,
    submitting,
    error,
    setError,
    addToBasket,
    changeCount,
    clearBasket,
    submitOrder,
  };
}
