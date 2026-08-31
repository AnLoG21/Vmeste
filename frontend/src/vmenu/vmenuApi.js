/** API helpers for Вменю microservice. */

export const VMENU_DRAFT_KEY = "vmeste_vmenu_editor_draft_v1";

export async function vmenuFetch(authFetch, API_URL, path, options = {}) {
  const res = await authFetch(`${API_URL}/vmenu${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Ошибка ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export function loadFeed(authFetch, API_URL) {
  return vmenuFetch(authFetch, API_URL, "/feed/");
}

export function searchRecipes(authFetch, API_URL, params) {
  const q = new URLSearchParams(params);
  return vmenuFetch(authFetch, API_URL, `/search/?${q}`);
}

export function loadBook(authFetch, API_URL) {
  return vmenuFetch(authFetch, API_URL, "/book/");
}

export function loadCategories(authFetch, API_URL) {
  return vmenuFetch(authFetch, API_URL, "/categories/");
}

export function loadCuisines(authFetch, API_URL) {
  return vmenuFetch(authFetch, API_URL, "/cuisines/");
}

export function loadMyProfile(authFetch, API_URL) {
  return vmenuFetch(authFetch, API_URL, "/users/me/");
}

export function loadUserProfile(authFetch, API_URL, userId) {
  return vmenuFetch(authFetch, API_URL, `/users/${userId}/`);
}

export function loadFollows(authFetch, API_URL, kind = "following") {
  return vmenuFetch(authFetch, API_URL, `/follows/?kind=${kind}`);
}

export function searchUsers(authFetch, API_URL, q, { limit = 10, all = false } = {}) {
  const params = new URLSearchParams({ q });
  if (all) params.set("all", "1");
  else params.set("limit", String(limit));
  return vmenuFetch(authFetch, API_URL, `/users/search/?${params}`);
}

export function toggleLike(authFetch, API_URL, recipeId, liked) {
  return vmenuFetch(authFetch, API_URL, `/recipes/${recipeId}/like/`, { method: liked ? "DELETE" : "POST" });
}

export function toggleSave(authFetch, API_URL, recipeId, saved) {
  return vmenuFetch(authFetch, API_URL, `/recipes/${recipeId}/save/`, { method: saved ? "DELETE" : "POST" });
}

export function createRecipe(authFetch, API_URL, formData) {
  return vmenuFetch(authFetch, API_URL, "/recipes/", { method: "POST", body: formData });
}

export function parseRecipeUrl(authFetch, API_URL, url) {
  return vmenuFetch(authFetch, API_URL, "/recipes/parse-url/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

export function updateRecipe(authFetch, API_URL, id, formData) {
  return vmenuFetch(authFetch, API_URL, `/recipes/${id}/`, { method: "PATCH", body: formData });
}

export function followUser(authFetch, API_URL, userId, following) {
  return vmenuFetch(authFetch, API_URL, `/users/${userId}/follow/`, { method: following ? "DELETE" : "POST" });
}

export function postComment(authFetch, API_URL, recipeId, formData) {
  return vmenuFetch(authFetch, API_URL, `/recipes/${recipeId}/comments/`, { method: "POST", body: formData });
}

export function toggleCommentLike(authFetch, API_URL, recipeId, commentId, liked) {
  return vmenuFetch(authFetch, API_URL, `/recipes/${recipeId}/comments/${commentId}/like/`, {
    method: liked ? "DELETE" : "POST",
  });
}

export function loadRecipe(authFetch, API_URL, id, params = {}) {
  const q = new URLSearchParams(params);
  const suffix = q.toString() ? `?${q}` : "";
  return vmenuFetch(authFetch, API_URL, `/recipes/${id}/${suffix}`);
}

export function uploadExtraPhotos(authFetch, API_URL, recipeId, files) {
  const fd = new FormData();
  for (const f of files) fd.append("photos", f);
  return vmenuFetch(authFetch, API_URL, `/recipes/${recipeId}/extra-photos/`, { method: "POST", body: fd });
}

export function deleteExtraPhoto(authFetch, API_URL, recipeId, photoId) {
  return vmenuFetch(authFetch, API_URL, `/recipes/${recipeId}/extra-photos/${photoId}/`, { method: "DELETE" });
}

export function saveRecipeSteps(authFetch, API_URL, recipeId, steps, stepImages = {}) {
  const fd = new FormData();
  fd.append("steps", JSON.stringify(steps.map((s) => ({ text: s.text }))));
  Object.entries(stepImages).forEach(([i, file]) => {
    if (file) fd.append(`step_image_${i}`, file);
  });
  return vmenuFetch(authFetch, API_URL, `/recipes/${recipeId}/steps/`, { method: "PUT", body: fd });
}

export function openUserChat(authFetch, API_URL, userId) {
  return authFetch(`${API_URL}/chat/conversations/create-user-direct/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
}

export function deleteRecipe(authFetch, API_URL, recipeId) {
  return vmenuFetch(authFetch, API_URL, `/recipes/${recipeId}/`, { method: "DELETE" });
}

/** Normalize ingredient from API for editor fields. */
export function normalizeIngredient(ing) {
  const raw = ing.amount;
  const n = Number(raw);
  const hasAmount = raw !== "" && raw != null && Number.isFinite(n) && n !== 0;
  let unit = (ing.unit || "").trim();
  if (!hasAmount) {
    if (!["щепотка", "по вкусу"].includes(unit)) unit = "";
    return { ...ing, amount: "", unit };
  }
  const amountStr = String(raw).replace(/\.?0+$/, "") || String(raw);
  return { ...ing, amount: amountStr, unit: unit || "г" };
}
