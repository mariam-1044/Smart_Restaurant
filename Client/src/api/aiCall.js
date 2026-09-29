import api from "./axios";

export async function aiCall(method, url, body) {
  try {
    const res = await api.request({ method, url, data: body });
    if (res.data && res.data.success === false) {
      return { ok: false, kind: 'ai_unavailable', message: res.data.message || 'Service unavailable' };
    }
    return { ok: true, data: res.data.data ?? res.data };
  } catch (err) {
    const status = err?.response?.status;
    if (!status || status >= 500) {
      return { ok: false, kind: 'ai_unavailable', message: 'Service unavailable' };
    }
    if (status === 422) {
      const code = err?.response?.data?.error?.code || err?.response?.data?.code || '';
      return { ok: false, kind: 'cold_start', message: err?.response?.data?.error?.message || err?.response?.data?.message || 'Insufficient history for forecast.', status };
    }
    return { ok: false, kind: 'error', message: err?.response?.data?.message || err.message, status };
  }
}