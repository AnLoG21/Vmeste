/**
 * Authenticated fetch with JWT refresh. Factory keeps a stable function reference in React.
 */
export function createAuthFetch(getAccessToken, refreshAccessToken) {
  return async function authFetch(url, options = {}) {
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
    const doRequest = async (tokenValue) => {
      const headers = {
        Authorization: `Bearer ${tokenValue}`,
        ...(options.headers || {}),
      };
      if (!isFormData && options.body != null && options.body !== "" && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }
      return fetch(url, { ...options, headers });
    };

    let response = await doRequest(getAccessToken());
    if (response.status !== 401) return response;
    const newToken = await refreshAccessToken();
    if (!newToken) return response;
    response = await doRequest(newToken);
    return response;
  };
}
