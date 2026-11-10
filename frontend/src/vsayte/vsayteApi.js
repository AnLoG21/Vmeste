/** API helpers for Всайте */

export async function vsayteFetch(authFetch, API_URL, path, options = {}) {
  const url = `${API_URL}/vsayte/${path.replace(/^\//, "")}`;
  const res = await authFetch(url, options);
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = new Error((data && data.detail) || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export function vsayteEntitlement(authFetch, API_URL) {
  return vsayteFetch(authFetch, API_URL, "entitlement/");
}

export function vsayteListSites(authFetch, API_URL) {
  return vsayteFetch(authFetch, API_URL, "sites/");
}

export function vsayteGetSite(authFetch, API_URL, id) {
  return vsayteFetch(authFetch, API_URL, `sites/${id}/`);
}

export function vsayteCreateSite(authFetch, API_URL, body) {
  return vsayteFetch(authFetch, API_URL, "sites/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function vsayteUpdateSite(authFetch, API_URL, id, body) {
  return vsayteFetch(authFetch, API_URL, `sites/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function vsayteDeleteSite(authFetch, API_URL, id) {
  return vsayteFetch(authFetch, API_URL, `sites/${id}/`, { method: "DELETE" });
}

export function vsayteCloneSite(authFetch, API_URL, id) {
  return vsayteFetch(authFetch, API_URL, `sites/${id}/clone/`, { method: "POST" });
}

export function vsaytePublish(authFetch, API_URL, id) {
  return vsayteFetch(authFetch, API_URL, `sites/${id}/publish/`, { method: "POST" });
}

export function vsayteUnpublish(authFetch, API_URL, id) {
  return vsayteFetch(authFetch, API_URL, `sites/${id}/unpublish/`, { method: "POST" });
}

export async function vsayteUploadAsset(authFetch, API_URL, id, file) {
  const fd = new FormData();
  fd.append("file", file);
  return vsayteFetch(authFetch, API_URL, `sites/${id}/assets/`, { method: "POST", body: fd });
}

export function vsayteCheckDomain(authFetch, API_URL, domain) {
  return vsayteFetch(authFetch, API_URL, "domains/check/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain }),
  });
}

export function vsaytePurchaseDomain(authFetch, API_URL, siteId, domain) {
  return vsayteFetch(authFetch, API_URL, `sites/${siteId}/domains/purchase/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain }),
  });
}

export function vsayteAttachDomain(authFetch, API_URL, siteId, domain) {
  return vsayteFetch(authFetch, API_URL, `sites/${siteId}/domains/attach/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain }),
  });
}

export function vsayteListLeads(authFetch, API_URL, siteId) {
  return vsayteFetch(authFetch, API_URL, `sites/${siteId}/leads/`);
}

export function vsayteMarkLeadRead(authFetch, API_URL, siteId, leadId) {
  return vsayteFetch(authFetch, API_URL, `sites/${siteId}/leads/${leadId}/read/`, {
    method: "POST",
  });
}
