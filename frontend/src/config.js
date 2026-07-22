const DEFAULT_API =
  import.meta.env.MODE === "mobile" || import.meta.env.PROD
    ? "https://vsevmeste.space/api"
    : "http://localhost:8000/api";

const raw = import.meta.env.VITE_API_URL || DEFAULT_API;

export const API_URL = raw.replace(/\/+$/, "").replace(/\/api\/api$/, "/api");
export const BASE_URL = API_URL.replace(/\/api$/, "");
export const AUTH_URL = `${API_URL}/auth/token/`;
export const REFRESH_URL = `${API_URL}/auth/token/refresh/`;
