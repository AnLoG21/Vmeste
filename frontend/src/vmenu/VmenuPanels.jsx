import { useEffect, useState } from "react";
import {
  createRecipe,
  followUser,
  loadBook,
  loadCategories,
  loadFeed,
  loadFollows,
  loadMyProfile,
  loadRecipe,
  loadUserProfile,
  openUserChat,
  parseRecipeUrl,
  postComment,
  saveRecipeSteps,
  searchRecipes,
  searchUsers,
  toggleLike,
  toggleSave,
  updateRecipe,
  uploadExtraPhotos,
  vmenuFetch,
} from "./vmenuApi.js";
import { ALL_UNITS, formatAmount, scaleIngredients } from "./vmenuUnits.js";
import VmenuLogo from "./VmenuLogo.jsx";

function Stars({ value, onChange }) {
  return (
    <span className="vmenu-stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" className={n <= value ? "on" : ""} onClick={() => onChange?.(n)}>
          ★
        </button>
      ))}
    </span>
  );
}

function PhotoCarousel({ urls, onOpen }) {
  const all = (urls || []).filter(Boolean);
  const [idx, setIdx] = useState(0);
  if (!all.length) return null;
  const src = all[idx % all.length];
  return (
    <div className="vmenu-carousel" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen?.()}>
      <img className="vmenu-card-cover" src={src} alt="" loading="lazy" />
      {all.length > 1 ? (
        <div className="vmenu-carousel-dots">
          {all.map((_, i) => (
            <button
              key={i}
              type="button"
              className={i === idx ? "on" : ""}
              aria-label={`Фото ${i + 1}`}
              onClick={(e) => {
                e.stopPropagation();
                setIdx(i);
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function VmenuRecipeCard({ recipe, authFetch, API_URL, onOpenUser, onOpenRecipe, onRefresh }) {
  const [liked, setLiked] = useState(Boolean(recipe.liked));
  const [saved, setSaved] = useState(Boolean(recipe.saved));
  const [likeCount, setLikeCount] = useState(recipe.like_count || 0);
  const [saveCount, setSaveCount] = useState(recipe.save_count || 0);
  const [commentOpen, setCommentOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [commentText, setCommentText] = useState("");

  async function onLike() {
    const data = await toggleLike(authFetch, API_URL, recipe.id, liked);
    setLiked(data.liked);
    setLikeCount(data.like_count);
  }

  async function onSave() {
    const data = await toggleSave(authFetch, API_URL, recipe.id, saved);
    setSaved(data.saved);
    setSaveCount(data.save_count);
  }

  async function submitComment(e) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("text", commentText);
    fd.append("rating", String(rating));
    await postComment(authFetch, API_URL, recipe.id, fd);
    setCommentOpen(false);
    setCommentText("");
    onRefresh?.();
  }

  const photos = [recipe.cover_url, ...(recipe.extra_photo_urls || [])].filter(Boolean);

  return (
    <article className="vmenu-card">
      <div className="vmenu-card-views">{recipe.view_count || 0} просмотров</div>
      {photos.length ? (
        <PhotoCarousel urls={photos} onOpen={() => onOpenRecipe?.(recipe.id)} />
      ) : (
        <div
          className="vmenu-card-cover vmenu-card-cover--empty"
          role="button"
          tabIndex={0}
          onClick={() => onOpenRecipe?.(recipe.id)}
          onKeyDown={(e) => e.key === "Enter" && onOpenRecipe?.(recipe.id)}
        />
      )}
      <div className="vmenu-card-body">
        <button type="button" className="vmenu-card-author" onClick={() => onOpenUser?.(recipe.author?.id)}>
          {recipe.author?.avatar_url ? (
            <img src={recipe.author.avatar_url} alt="" />
          ) : (
            <span className="vmenu-avatar-fallback">{recipe.author?.display_name?.[0] || "?"}</span>
          )}
          <span>{recipe.author?.display_name}</span>
        </button>
        <button type="button" className="vmenu-card-title-btn" onClick={() => onOpenRecipe?.(recipe.id)}>
          <h3>{recipe.title}</h3>
        </button>
        {recipe.description ? <p className="muted">{recipe.description}</p> : null}
        {recipe.category ? <span className="vmenu-chip">{recipe.category.name}</span> : null}
        <div className="vmenu-card-actions">
          <button type="button" className={liked ? "active" : ""} onClick={onLike}>
            ♥ {likeCount}
          </button>
          <button type="button" className={saved ? "active" : ""} onClick={onSave} title="В книгу рецептов">
            ↪ {saveCount}
          </button>
          <button type="button" onClick={() => setCommentOpen((v) => !v)}>
            💬 {recipe.comment_count || 0}
          </button>
          {recipe.avg_rating > 0 ? <span className="vmenu-rating">★ {Number(recipe.avg_rating).toFixed(1)}</span> : null}
        </div>
        {commentOpen ? (
          <form className="vmenu-comment-form" onSubmit={submitComment}>
            <Stars value={rating} onChange={setRating} />
            <textarea
              rows={2}
              placeholder="Комментарий к рецепту…"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
            <button type="submit" className="primary-btn">
              Отправить
            </button>
          </form>
        ) : null}
      </div>
    </article>
  );
}

export function VmenuRecipeDetail({ recipeId, authFetch, API_URL, onBack, onOpenUser }) {
  const [recipe, setRecipe] = useState(null);
  const [servings, setServings] = useState(4);
  const [unitMode, setUnitMode] = useState("");
  const [status, setStatus] = useState("Загрузка…");
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [servingsInit, setServingsInit] = useState(false);

  useEffect(() => {
    setServingsInit(false);
    setCarouselIdx(0);
  }, [recipeId]);

  async function load() {
    setStatus("Загрузка…");
    try {
      const params = { servings: String(servings) };
      if (unitMode) params.unit = unitMode;
      const data = await loadRecipe(authFetch, API_URL, recipeId, params);
      setRecipe(data);
      setLiked(Boolean(data.liked));
      setSaved(Boolean(data.saved));
      if (!servingsInit) {
        setServings(data.servings || 4);
        setServingsInit(true);
      }
      setStatus("");
    } catch (e) {
      setStatus(e.message);
    }
  }

  useEffect(() => {
    void load();
  }, [recipeId, servings, unitMode]);

  if (!recipe && status) return <p className="status">{status}</p>;
  if (!recipe) return null;

  const photos = [recipe.cover_url, ...(recipe.extra_photo_urls || [])].filter(Boolean);
  const ingredients = recipe.scaled_ingredients?.length
    ? recipe.scaled_ingredients
    : scaleIngredients(recipe.ingredients, recipe.servings, servings, unitMode || null);

  async function onLike() {
    const data = await toggleLike(authFetch, API_URL, recipe.id, liked);
    setLiked(data.liked);
    setRecipe((r) => ({ ...r, like_count: data.like_count }));
  }

  async function onSave() {
    const data = await toggleSave(authFetch, API_URL, recipe.id, saved);
    setSaved(data.saved);
    setRecipe((r) => ({ ...r, save_count: data.save_count }));
  }

  return (
    <div className="vmenu-tab vmenu-detail">
      <button type="button" className="ghost-btn" onClick={onBack}>
        ← Назад
      </button>
      {photos.length ? (
        <div className="vmenu-detail-gallery">
          <img src={photos[carouselIdx % photos.length]} alt="" />
          {photos.length > 1 ? (
            <div className="vmenu-carousel-dots">
              {photos.map((_, i) => (
                <button key={i} type="button" className={i === carouselIdx ? "on" : ""} onClick={() => setCarouselIdx(i)} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {recipe.video_url ? (
        <video className="vmenu-detail-video" src={recipe.video_url} controls playsInline />
      ) : null}
      <button type="button" className="vmenu-card-author" onClick={() => onOpenUser?.(recipe.author?.id)}>
        {recipe.author?.avatar_url ? <img src={recipe.author.avatar_url} alt="" /> : null}
        <span>{recipe.author?.display_name}</span>
      </button>
      <h2>{recipe.title}</h2>
      {recipe.category ? <span className="vmenu-chip">{recipe.category.name}</span> : null}
      {recipe.description ? <p>{recipe.description}</p> : null}
      {recipe.source_url ? (
        <a href={recipe.source_url} target="_blank" rel="noreferrer" className="vmenu-source-link">
          Источник
        </a>
      ) : null}
      <div className="vmenu-card-actions">
        <button type="button" className={liked ? "active" : ""} onClick={onLike}>
          ♥ {recipe.like_count || 0}
        </button>
        <button type="button" className={saved ? "active" : ""} onClick={onSave}>
          ↪ {recipe.save_count || 0}
        </button>
        <span className="muted">{recipe.view_count || 0} просмотров</span>
      </div>
      <div className="vmenu-portions">
        <label>
          Порции: {servings}
          <input
            type="range"
            min={1}
            max={20}
            value={servings}
            onChange={(e) => setServings(Number(e.target.value))}
          />
        </label>
        <label>
          Единицы
          <select value={unitMode} onChange={(e) => setUnitMode(e.target.value)}>
            <option value="">Как в рецепте</option>
            {ALL_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
      </div>
      <h3>Ингредиенты</h3>
      <ul className="vmenu-ing-list">
        {ingredients.map((ing, i) => (
          <li key={ing.id || i}>
            <strong>{ing.name}</strong> — {formatAmount(ing.amount)} {ing.unit}
          </li>
        ))}
      </ul>
      <h3>Приготовление</h3>
      <ol className="vmenu-steps-list">
        {recipe.steps?.map((st, i) => (
          <li key={st.id || i}>
            {st.image_url ? <img src={st.image_url} alt="" className="vmenu-step-img" /> : null}
            <p>{st.text}</p>
          </li>
        ))}
      </ol>
      {recipe.comments?.length ? (
        <>
          <h3>Отзывы</h3>
          <ul className="vmenu-comments">
            {recipe.comments.map((c) => (
              <li key={c.id}>
                <strong>{c.user?.display_name}</strong>
                {c.rating ? <span> ★ {c.rating}</span> : null}
                <p>{c.text}</p>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

export function VmenuFeedTab({ authFetch, API_URL, onOpenUser, onOpenRecipe }) {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("");

  async function load() {
    setStatus("Загрузка…");
    try {
      const data = await loadFeed(authFetch, API_URL);
      setItems(data.items || []);
      setStatus("");
    } catch (e) {
      setStatus(e.message);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="vmenu-tab">
      <header className="vmenu-tab-head">
        <VmenuLogo size={32} />
        <h2>Вменю</h2>
      </header>
      {status ? <p className="status">{status}</p> : null}
      {!items.length && !status ? <p className="muted">Подпишитесь на авторов — их рецепты появятся здесь первыми.</p> : null}
      <div className="vmenu-feed">
        {items.map((r) => (
          <VmenuRecipeCard
            key={r.id}
            recipe={r}
            authFetch={authFetch}
            API_URL={API_URL}
            onOpenUser={onOpenUser}
            onOpenRecipe={onOpenRecipe}
            onRefresh={load}
          />
        ))}
      </div>
    </div>
  );
}

export function VmenuSearchTab({ authFetch, API_URL, onOpenUser, onOpenRecipe }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("rating");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);

  useEffect(() => {
    void loadCategories(authFetch, API_URL).then((d) => setCategories(d || []));
  }, [authFetch, API_URL]);

  async function runSearch(e) {
    e?.preventDefault();
    const data = await searchRecipes(authFetch, API_URL, { q, sort, category });
    setItems(data.items || []);
  }

  return (
    <div className="vmenu-tab">
      <h2>Поиск рецептов</h2>
      <form className="vmenu-search-form" onSubmit={runSearch}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Название, ингредиент…" />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Все категории</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="rating">По рейтингу</option>
          <option value="popular">По популярности</option>
          <option value="new">Сначала новые</option>
        </select>
        <button type="submit" className="primary-btn">
          Найти
        </button>
      </form>
      <div className="vmenu-feed">
        {items.map((r) => (
          <VmenuRecipeCard
            key={r.id}
            recipe={r}
            authFetch={authFetch}
            API_URL={API_URL}
            onOpenUser={onOpenUser}
            onOpenRecipe={onOpenRecipe}
          />
        ))}
      </div>
    </div>
  );
}

export function VmenuBookTab({ authFetch, API_URL, onCreate, onOpenRecipe }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    void loadBook(authFetch, API_URL).then((d) => setItems(d.items || []));
  }, [authFetch, API_URL]);

  return (
    <div className="vmenu-tab">
      <div className="vmenu-tab-head-row">
        <h2>Книга рецептов</h2>
        <button type="button" className="primary-btn" onClick={onCreate}>
          + Создать
        </button>
      </div>
      <div className="vmenu-feed">
        {items.map((r) => (
          <VmenuRecipeCard
            key={r.id}
            recipe={r}
            authFetch={authFetch}
            API_URL={API_URL}
            onOpenRecipe={onOpenRecipe}
          />
        ))}
      </div>
    </div>
  );
}

export function VmenuProfileTab({ authFetch, API_URL, me, onOpenUser, onCreate, onOpenSettings, onOpenRecipe }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    void loadMyProfile(authFetch, API_URL).then(setData);
  }, [authFetch, API_URL]);

  if (!data) return <p className="status">Загрузка…</p>;

  return (
    <div className="vmenu-tab">
      <div className="vmenu-tab-head-row">
        <h2>{data.profile?.display_name || me?.username}</h2>
        <button type="button" className="ghost-btn" onClick={onOpenSettings}>
          ⚙
        </button>
      </div>
      <p className="muted">{data.profile?.bio || "Расскажите о себе в настройках."}</p>
      <div className="vmenu-stats">
        <span>{data.followers_count} подписчиков</span>
        <span>{data.following_count} подписок</span>
      </div>
      <div className="vmenu-follower-row">
        {data.recent_followers?.map((u) => (
          <button key={u.id} type="button" className="vmenu-mini-avatar" onClick={() => onOpenUser(u.id)} title={u.display_name}>
            {u.avatar_url ? <img src={u.avatar_url} alt="" /> : u.display_name?.[0]}
          </button>
        ))}
      </div>
      <button type="button" className="primary-btn vmenu-publish-btn" onClick={onCreate}>
        + Опубликовать рецепт
      </button>
      <div className="vmenu-feed">
        {data.recipes?.map((r) => (
          <VmenuRecipeCard
            key={r.id}
            recipe={r}
            authFetch={authFetch}
            API_URL={API_URL}
            onOpenUser={onOpenUser}
            onOpenRecipe={onOpenRecipe}
          />
        ))}
      </div>
    </div>
  );
}

export function VmenuFollowsTab({ authFetch, API_URL, onOpenUser }) {
  const [kind, setKind] = useState("following");
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [searchHits, setSearchHits] = useState([]);

  useEffect(() => {
    void loadFollows(authFetch, API_URL, kind).then((d) => setItems(d.items || []));
  }, [authFetch, API_URL, kind]);

  async function runUserSearch(e) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    const d = await searchUsers(authFetch, API_URL, q.trim());
    setSearchHits(d.items || []);
  }

  return (
    <div className="vmenu-tab">
      <h2>Подписки</h2>
      <form className="vmenu-search-form" onSubmit={runUserSearch}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по имени или логину" />
        <button type="button" className="primary-btn" onClick={runUserSearch}>
          +
        </button>
      </form>
      {searchHits.length ? (
        <ul className="vmenu-user-list">
          {searchHits.map((u) => (
            <li key={u.id}>
              <button type="button" onClick={() => onOpenUser(u.id)}>
                {u.display_name} @{u.username}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="vmenu-tabs-inline">
        <button type="button" className={kind === "following" ? "active" : ""} onClick={() => setKind("following")}>
          Подписки
        </button>
        <button type="button" className={kind === "followers" ? "active" : ""} onClick={() => setKind("followers")}>
          Подписчики
        </button>
      </div>
      <ul className="vmenu-user-list">
        {items.map((u) => (
          <li key={u.id}>
            <button type="button" onClick={() => onOpenUser(u.id)}>
              {u.display_name} @{u.username}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VmenuUserView({ userId, authFetch, API_URL, onBack, onOpenChat, onOpenRecipe }) {
  const [data, setData] = useState(null);
  const [confirmUnfollow, setConfirmUnfollow] = useState(false);

  useEffect(() => {
    void loadUserProfile(authFetch, API_URL, userId).then(setData);
  }, [userId, authFetch, API_URL]);

  if (!data) return <p className="status">Загрузка…</p>;
  const u = data.user;

  async function toggleFollow() {
    if (data.is_following && !confirmUnfollow) {
      setConfirmUnfollow(true);
      return;
    }
    await followUser(authFetch, API_URL, userId, data.is_following);
    setConfirmUnfollow(false);
    const fresh = await loadUserProfile(authFetch, API_URL, userId);
    setData(fresh);
  }

  async function startChat() {
    const res = await openUserChat(authFetch, API_URL, userId);
    if (!res.ok) return;
    const conv = await res.json();
    onOpenChat?.(conv.id);
  }

  return (
    <div className="vmenu-tab">
      <button type="button" className="ghost-btn" onClick={onBack}>
        ← Назад
      </button>
      <h2>{u.display_name}</h2>
      <p className="muted">@{u.username}</p>
      <div className="vmenu-profile-actions">
        <button type="button" className={data.is_following ? "ghost-btn" : "primary-btn"} onClick={toggleFollow}>
          {data.is_following ? (confirmUnfollow ? "Отписаться?" : "Вы подписаны") : "Подписаться"}
        </button>
        {confirmUnfollow ? (
          <button type="button" className="ghost-btn" onClick={() => setConfirmUnfollow(false)}>
            Отменить
          </button>
        ) : null}
        {data.can_message ? (
          <button type="button" className="ghost-btn" onClick={startChat}>
            💬 Написать
          </button>
        ) : null}
      </div>
      <div className="vmenu-feed">
        {data.recipes?.map((r) => (
          <VmenuRecipeCard
            key={r.id}
            recipe={r}
            authFetch={authFetch}
            API_URL={API_URL}
            onOpenRecipe={onOpenRecipe}
          />
        ))}
      </div>
    </div>
  );
}

export function VmenuRecipeEditor({ authFetch, API_URL, recipeId, onDone, onCancel }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [servings, setServings] = useState(4);
  const [categories, setCategories] = useState([]);
  const [cover, setCover] = useState(null);
  const [extraPhotos, setExtraPhotos] = useState([]);
  const [video, setVideo] = useState(null);
  const [ingredients, setIngredients] = useState([{ name: "", amount: "", unit: "г" }]);
  const [steps, setSteps] = useState([{ text: "" }]);
  const [stepImages, setStepImages] = useState({});
  const [status, setStatus] = useState("");
  const [id, setId] = useState(recipeId || null);

  useEffect(() => {
    void loadCategories(authFetch, API_URL).then(setCategories);
    if (recipeId) {
      void vmenuFetch(authFetch, API_URL, `/recipes/${recipeId}/`).then((r) => {
        setTitle(r.title || "");
        setDescription(r.description || "");
        setSourceUrl(r.source_url || "");
        setCategoryId(r.category?.id || "");
        setServings(r.servings || 4);
        setIngredients(r.ingredients?.length ? r.ingredients : [{ name: "", amount: "", unit: "г" }]);
        setSteps(r.steps?.length ? r.steps : [{ text: "" }]);
      });
    }
  }, [recipeId]);

  async function parseUrl() {
    setStatus("Импорт…");
    try {
      const r = await parseRecipeUrl(authFetch, API_URL, sourceUrl);
      setId(r.id);
      setTitle(r.title || "");
      setDescription(r.description || "");
      setServings(r.servings || 4);
      if (r.ingredients?.length) setIngredients(r.ingredients);
      if (r.steps?.length) setSteps(r.steps);
      setStatus("");
    } catch (e) {
      setStatus(e.message);
    }
  }

  async function save(publish) {
    setStatus("Сохраняем…");
    const fd = new FormData();
    fd.append("title", title);
    fd.append("description", description);
    fd.append("servings", String(servings));
    if (categoryId) fd.append("category_id", categoryId);
    if (cover) fd.append("cover_image", cover);
    if (video) fd.append("video", video);
    if (publish) fd.append("publish", "1");
    else if (!publish && id) fd.append("book_only", "1");
    let recipe = id;
    if (!id) {
      const created = await createRecipe(authFetch, API_URL, fd);
      recipe = created.id;
      setId(recipe);
    } else {
      await updateRecipe(authFetch, API_URL, id, fd);
    }
    if (extraPhotos.length) {
      await uploadExtraPhotos(authFetch, API_URL, recipe, extraPhotos.slice(0, 4));
    }
    await vmenuFetch(authFetch, API_URL, `/recipes/${recipe}/ingredients/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ingredients }),
    });
    await saveRecipeSteps(authFetch, API_URL, recipe, steps, stepImages);
    setStatus("");
    onDone?.();
  }

  return (
    <div className="vmenu-tab vmenu-editor">
      <div className="vmenu-tab-head-row">
        <h2>{id ? "Редактирование" : "Новый рецепт"}</h2>
        <button type="button" className="ghost-btn" onClick={onCancel}>
          Закрыть
        </button>
      </div>
      <label className="field-label">
        Ссылка на рецепт (опционально)
        <div className="row-2">
          <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…" />
          <button type="button" className="ghost-btn" onClick={parseUrl}>
            Импорт
          </button>
        </div>
      </label>
      <label className="field-label">
        Название
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="field-label">
        Категория
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">—</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field-label">
        Описание
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label className="field-label">
        Порций по рецепту
        <input type="number" min={1} max={99} value={servings} onChange={(e) => setServings(Number(e.target.value) || 1)} />
      </label>
      <label className="field-label">
        Главное фото
        <input type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] || null)} />
      </label>
      <label className="field-label">
        Доп. фото (до 4)
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setExtraPhotos(Array.from(e.target.files || []).slice(0, 4))}
        />
      </label>
      <label className="field-label">
        Видео (опционально)
        <input type="file" accept="video/*" onChange={(e) => setVideo(e.target.files?.[0] || null)} />
      </label>
      <h3>Ингредиенты</h3>
      {ingredients.map((ing, i) => (
        <div key={i} className="vmenu-ing-row">
          <input
            placeholder="Название"
            value={ing.name}
            onChange={(e) => {
              const next = [...ingredients];
              next[i] = { ...ing, name: e.target.value };
              setIngredients(next);
            }}
          />
          <input
            placeholder="Кол-во"
            value={ing.amount}
            onChange={(e) => {
              const next = [...ingredients];
              next[i] = { ...ing, amount: e.target.value };
              setIngredients(next);
            }}
          />
          <select
            value={ing.unit}
            onChange={(e) => {
              const next = [...ingredients];
              next[i] = { ...ing, unit: e.target.value };
              setIngredients(next);
            }}
          >
            {["г", "кг", "мл", "л", "ч.л.", "ст.л.", "шт."].map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      ))}
      <button
        type="button"
        className="ghost-btn"
        onClick={() => setIngredients([...ingredients, { name: "", amount: "", unit: "г" }])}
      >
        + Ингредиент
      </button>
      <h3>Шаги</h3>
      {steps.map((st, i) => (
        <div key={i} className="vmenu-step-edit">
          <label className="field-label">
            Шаг {i + 1}
            <textarea
              rows={2}
              value={st.text}
              onChange={(e) => {
                const next = [...steps];
                next[i] = { ...st, text: e.target.value };
                setSteps(next);
              }}
            />
          </label>
          <label className="field-label">
            Фото шага
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setStepImages((prev) => ({ ...prev, [i]: e.target.files?.[0] || null }))}
            />
          </label>
        </div>
      ))}
      <button type="button" className="ghost-btn" onClick={() => setSteps([...steps, { text: "" }])}>
        + Шаг
      </button>
      {status ? <p className="status">{status}</p> : null}
      <div className="vmenu-editor-actions">
        <button type="button" className="ghost-btn" onClick={() => save(false)}>
          В книгу без публикации
        </button>
        <button type="button" className="primary-btn" onClick={() => save(true)}>
          Опубликовать
        </button>
      </div>
    </div>
  );
}

export function VmenuSettings({ profile, categories = [], onSave, onClose }) {
  const [bio, setBio] = useState(profile?.bio || "");
  const [allowMessages, setAllowMessages] = useState(profile?.allow_messages || "followers");
  const [interests, setInterests] = useState(profile?.interest_tags || []);

  function toggleInterest(catId) {
    setInterests((prev) => (prev.includes(catId) ? prev.filter((x) => x !== catId) : [...prev, catId].slice(0, 10)));
  }

  return (
    <div className="vmenu-tab vmenu-settings">
      <div className="vmenu-tab-head-row">
        <h2>Настройки Вменю</h2>
        <button type="button" className="ghost-btn" onClick={onClose}>
          Закрыть
        </button>
      </div>
      <h3>Общие</h3>
      <label className="field-label">
        О себе
        <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
      </label>
      <h3>Конфиденциальность</h3>
      <label className="field-label">
        Кто может писать в чат
        <select value={allowMessages} onChange={(e) => setAllowMessages(e.target.value)}>
          <option value="everyone">Все</option>
          <option value="followers">Только подписчики</option>
          <option value="nobody">Никто</option>
        </select>
      </label>
      <h3>Интересы для ленты</h3>
      <p className="muted small">Выберите категории — рецепты из них будут чаще попадать в рекомендации.</p>
      <div className="vmenu-interest-chips">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`vmenu-chip ${interests.includes(c.id) ? "on" : ""}`}
            onClick={() => toggleInterest(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="primary-btn"
        onClick={() => onSave({ bio, allow_messages: allowMessages, interest_tags: interests })}
      >
        Сохранить
      </button>
    </div>
  );
}