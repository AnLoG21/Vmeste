/** API helpers for Вменю microservice. */

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

export function loadMyProfile(authFetch, API_URL) {
  return vmenuFetch(authFetch, API_URL, "/users/me/");
}

export function loadUserProfile(authFetch, API_URL, userId) {
  return vmenuFetch(authFetch, API_URL, `/users/${userId}/`);
}

export function loadFollows(authFetch, API_URL, kind = "following") {
  return vmenuFetch(authFetch, API_URL, `/follows/?kind=${kind}`);
}

export function searchUsers(authFetch, API_URL, q) {
  return vmenuFetch(authFetch, API_URL, `/users/search/?q=${encodeURIComponent(q)}`);
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

export function openUserChat(authFetch, API_URL, userId) {
  return authFetch(`${API_URL}/chat/conversations/create-user-direct/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
}
