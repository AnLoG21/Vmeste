/** Auth + Вменю API mocks for E2E. */

const ME = {
  id: 511,
  username: "e2e-vmenu",
  role: "client",
  first_name: "Меню",
  last_name: "Тест",
  email: "e2e-vmenu@example.com",
  profile_complete: true,
  needs_credentials_setup: false,
  email_verified: true,
  has_usable_password: true,
};

export const VMENU_RECIPE = {
  id: 9001,
  title: "Борщ E2E",
  description: "Классический",
  author: {
    id: 512,
    username: "chef-e2e",
    first_name: "Шеф",
    last_name: "Тест",
    display_name: "Шеф Тест",
  },
  category: null,
  cuisine: null,
  cover_url: "",
  extra_photo_urls: [],
  view_count: 10,
  like_count: 2,
  save_count: 1,
  comment_count: 0,
  avg_rating: "0.00",
  published_at: new Date().toISOString(),
  liked: false,
  saved: false,
  servings: 4,
  ingredients: [{ id: 1, name: "Свёкла", amount: "2", unit: "шт", sort_order: 0 }],
  steps: [{ id: 1, text: "Сварить", sort_order: 0 }],
  comments: [],
  status: "published",
};

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ feedItems?: object[], recipeDetail?: object|null }} [options]
 */
export async function installVmenuMocks(page, { feedItems = null, recipeDetail = null } = {}) {
  const items = Array.isArray(feedItems) ? feedItems.map((r) => ({ ...r })) : [{ ...VMENU_RECIPE }];
  let detail = recipeDetail ? { ...recipeDetail } : { ...VMENU_RECIPE };
  let createdSeq = 9100;

  await page.addInitScript(() => {
    window.__VMESTE_E2E__ = true;
    localStorage.setItem("vmeste_access", "e2e-access-token");
    localStorage.setItem("vmeste_refresh", "e2e-refresh-token");
    localStorage.setItem("vmeste_cookie_consent_v1", "necessary");
  });

  await page.route("**/api/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const method = req.method();

    const json = (data, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });

    if (path.endsWith("/auth/token/refresh") && method === "POST") {
      return json({ access: "e2e-access-token" });
    }
    if (path.endsWith("/users/me") && method === "GET") {
      return json(ME);
    }
    if (path.includes("/subscriptions/") && method === "GET") {
      return json([]);
    }
    if (path.includes("/notifications/") && method === "GET") {
      return json([]);
    }
    if (path.endsWith("/vmenu/feed") && method === "GET") {
      return json({ items });
    }
    if (path.endsWith("/vmenu/categories") && method === "GET") {
      return json([]);
    }
    if (path.endsWith("/vmenu/cuisines") && method === "GET") {
      return json([]);
    }
    if (path.endsWith("/vmenu/book") && method === "GET") {
      return json({ items: [] });
    }
    if (path.endsWith("/vmenu/users/me") && method === "GET") {
      return json({
        id: ME.id,
        username: ME.username,
        first_name: ME.first_name,
        bio: "",
        interest_tags: [],
        followers_count: 0,
        following_count: 0,
      });
    }
    if (path.endsWith("/vmenu/chats/contacts") && method === "GET") {
      return json({ items: [] });
    }
    if (path.endsWith("/vmenu/recipes") && method === "POST") {
      createdSeq += 1;
      let title = "Новый рецепт";
      try {
        const raw = req.postData() || "";
        if (raw.includes("title")) {
          const m = /name="title"[\s\S]*?\r?\n\r?\n([^\r\n]+)/.exec(raw);
          if (m) title = m[1].trim();
          else {
            const j = JSON.parse(raw);
            if (j.title) title = String(j.title);
          }
        }
      } catch {
        /* ignore */
      }
      detail = {
        ...VMENU_RECIPE,
        id: createdSeq,
        title,
        status: "draft",
        author: {
          id: ME.id,
          username: ME.username,
          first_name: ME.first_name,
          last_name: ME.last_name,
          display_name: `${ME.first_name} ${ME.last_name}`,
        },
      };
      return json(detail, 201);
    }
    const recipeMatch = path.match(/\/vmenu\/recipes\/(\d+)$/);
    if (recipeMatch && method === "GET") {
      const id = Number(recipeMatch[1]);
      if (Number(detail.id) === id || items.some((i) => Number(i.id) === id)) {
        const base = Number(detail.id) === id ? detail : items.find((i) => Number(i.id) === id);
        return json({ ...VMENU_RECIPE, ...base, id });
      }
      return json({ detail: "Рецепт не найден." }, 404);
    }
    if (path.includes("/vmenu/") && method === "GET") {
      return json({ items: [] });
    }
    if (method === "GET") {
      return json([]);
    }
    if (method === "POST" || method === "PATCH" || method === "PUT") {
      return json({ ok: true });
    }

    return json({ detail: `unmocked ${method} ${path}` }, 404);
  });
}
