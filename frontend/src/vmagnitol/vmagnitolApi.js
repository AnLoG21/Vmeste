async function parse(res) {
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

export function listBrands(authFetch, API_URL) {
  return authFetch(`${API_URL}/vmagnitol/brands/`).then(parse);
}

export function createBrand(authFetch, API_URL, body) {
  return authFetch(`${API_URL}/vmagnitol/brands/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(parse);
}

export function createModel(authFetch, API_URL, brandId, body) {
  return authFetch(`${API_URL}/vmagnitol/brands/${brandId}/models/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(parse);
}

export function getModel(authFetch, API_URL, id) {
  return authFetch(`${API_URL}/vmagnitol/models/${id}/`).then(parse);
}

export function createGuide(authFetch, API_URL, modelId, body) {
  return authFetch(`${API_URL}/vmagnitol/models/${modelId}/guides/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(parse);
}

export function getGuide(authFetch, API_URL, id) {
  return authFetch(`${API_URL}/vmagnitol/guides/${id}/`).then(parse);
}

export function updateGuide(authFetch, API_URL, id, body) {
  return authFetch(`${API_URL}/vmagnitol/guides/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(parse);
}

export function createStep(authFetch, API_URL, guideId, body) {
  return authFetch(`${API_URL}/vmagnitol/guides/${guideId}/steps/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(parse);
}

export function updateStep(authFetch, API_URL, id, body) {
  return authFetch(`${API_URL}/vmagnitol/steps/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(parse);
}

export function deleteStep(authFetch, API_URL, id) {
  return authFetch(`${API_URL}/vmagnitol/steps/${id}/`, { method: "DELETE" }).then((res) => {
    if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
  });
}

export async function uploadFile(authFetch, API_URL, guideId, file, { title = "", stepId = null } = {}) {
  const fd = new FormData();
  fd.append("file", file);
  if (title) fd.append("title", title);
  if (stepId) fd.append("step", String(stepId));
  return authFetch(`${API_URL}/vmagnitol/guides/${guideId}/files/`, {
    method: "POST",
    body: fd,
  }).then(parse);
}

export function deleteFile(authFetch, API_URL, id) {
  return authFetch(`${API_URL}/vmagnitol/files/${id}/`, { method: "DELETE" }).then((res) => {
    if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
  });
}
