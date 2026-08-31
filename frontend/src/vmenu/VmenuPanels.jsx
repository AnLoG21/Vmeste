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
  VMENU_DRAFT_KEY,
} from "./vmenuApi.js";
import {
  VmenuBackButton,
  VmenuCloseButton,
  VmenuFieldBlock,
  VmenuMediaUpload,
  VmenuRatingBadge,
  VmenuStatWidget,
  VmenuTextArea,
  VmenuTextInput,
} from "./VmenuComponents.jsx";
import { ALL_UNITS, formatIngredientLine, scaleIngredients } from "./vmenuUnits.js";
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

  useEffect(() => {
    setLiked(Boolean(recipe.liked));
    setSaved(Boolean(recipe.saved));
    setLikeCount(recipe.like_count || 0);
    setSaveCount(recipe.save_count || 0);
  }, [recipe.id, recipe.liked, recipe.saved, recipe.like_count, recipe.save_count]);
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
      <VmenuRatingBadge rating={recipe.avg_rating} />
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
  const [rating, setRating] = useState(5);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [servingsInit, setServingsInit] = useState(false);

  useEffect(() => {
    setServingsInit(false);
    setCarouselIdx(0);
  }, [recipeId]);

  useEffect(() => {
    setLiked(Boolean(recipe?.liked));
    setSaved(Boolean(recipe?.saved));
  }, [recipe?.liked, recipe?.saved]);

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

  async function submitComment(e) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("text", commentText);
    fd.append("rating", String(rating));
    if (replyTo?.username) fd.append("reply_to_username", replyTo.username);
    if (replyTo?.id) fd.append("parent_id", String(replyTo.id));
    await postComment(authFetch, API_URL, recipe.id, fd);
    setCommentText("");
    setReplyTo(null);
    await load();
  }

  return (
    <div className="vmenu-tab vmenu-detail">
      <div className="vmenu-detail-top">
        <VmenuBackButton onClick={onBack} />
      </div>
      <div className="vmenu-detail-hero">
        <VmenuRatingBadge rating={recipe.avg_rating} />
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
      </div>
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
          <li key={ing.id || i}>{formatIngredientLine(ing)}</li>
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
      <h3>Комментарии</h3>
      <ul className="vmenu-comments-list">
        {(recipe.comments || []).map((c) => (
          <li key={c.id} className="vmenu-comment-item">
            <div className="vmenu-comment-head">
              <strong>{c.user?.display_name}</strong>
              {c.rating ? <span className="vmenu-comment-rating">★ {c.rating}</span> : null}
              <button type="button" className="vmenu-comment-reply" onClick={() => setReplyTo({ id: c.id, username: c.user?.username })}>
                Ответить
              </button>
            </div>
            {c.reply_to_user ? <span className="muted small">@{c.reply_to_user.username} </span> : null}
            <p>{c.text}</p>
          </li>
        ))}
      </ul>
      <form className="vmenu-comment-compose" onSubmit={submitComment}>
        <Stars value={rating} onChange={setRating} />
        {replyTo ? (
          <p className="muted small">
            Ответ @{replyTo.username}{" "}
            <button type="button" className="ghost-btn" onClick={() => setReplyTo(null)}>
              ×
            </button>
          </p>
        ) : null}
        <div className="vmenu-comment-input-row">
          <VmenuTextArea value={commentText} onChange={setCommentText} rows={3} placeholder="Комментарий… @username для упоминания" />
          <button type="submit" className="vmenu-send-btn" aria-label="Отправить">
            ➤
          </button>
        </div>
      </form>
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
      <form className="vmenu-search-toolbar" onSubmit={runSearch}>
        <input className="vmenu-search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Название, ингредиент…" />
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
        <button type="submit" className="primary-btn vmenu-search-btn">
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

export function VmenuBookTab({ authFetch, API_URL, onCreate, onOpenRecipe, onEditRecipe }) {
  const [items, setItems] = useState([]);
  const [openCats, setOpenCats] = useState({});

  useEffect(() => {
    void loadBook(authFetch, API_URL).then((d) => setItems(d.items || []));
  }, [authFetch, API_URL]);

  const grouped = items.reduce((acc, r) => {
    const key = r.category?.name || "Без категории";
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  return (
    <div className="vmenu-tab">
      <div className="vmenu-tab-head-row">
        <h2>Книга рецептов</h2>
        <button type="button" className="primary-btn" onClick={onCreate}>
          + Создать
        </button>
      </div>
      <div className="vmenu-book-tree">
        {Object.entries(grouped).map(([cat, recipes]) => (
          <div key={cat} className="vmenu-book-cat">
            <button
              type="button"
              className="vmenu-book-cat-head"
              onClick={() => setOpenCats((p) => ({ ...p, [cat]: !p[cat] }))}
            >
              <span>{openCats[cat] ? "▾" : "▸"}</span>
              <span>{cat}</span>
              <span className="muted">({recipes.length})</span>
            </button>
            {openCats[cat] !== false ? (
              <ul className="vmenu-book-recipes">
                {recipes.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => onOpenRecipe?.(r.id)}>
                      {r.title}
                    </button>
                    <button type="button" className="ghost-btn" onClick={() => onEditRecipe?.(r.id)}>
                      ✎
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
      {!items.length ? <p className="muted">Сохраняйте рецепты или создавайте свои.</p> : null}
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
      <div className="vmenu-profile-head">
        {data.profile?.avatar_url ? (
          <img className="vmenu-profile-avatar" src={data.profile.avatar_url} alt="" />
        ) : (
          <span className="vmenu-profile-avatar vmenu-avatar-fallback">{data.profile?.display_name?.[0] || "?"}</span>
        )}
        <div>
          <h2>{data.profile?.display_name || me?.username}</h2>
          <button type="button" className="ghost-btn" onClick={onOpenSettings}>
            ⚙ Настройки
          </button>
        </div>
      </div>
      <p className="muted">{data.profile?.bio || "Расскажите о себе в настройках."}</p>
      <div className="vmenu-stats-row">
        <VmenuStatWidget icon="👥" value={data.followers_count} label="подписчиков" onClick={() => onOpenUser?.(me?.id)} />
        <VmenuStatWidget icon="➕" value={data.following_count} label="подписок" />
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
      <VmenuBackButton onClick={onBack} />
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

export function VmenuRecipeEditor({
  authFetch,
  API_URL,
  recipeId,
  initialDraft,
  registerDraftSaver,
  onDone,
  onCancel,
}) {
  const [title, setTitle] = useState(initialDraft?.title || "");
  const [description, setDescription] = useState(initialDraft?.description || "");
  const [sourceUrl, setSourceUrl] = useState(initialDraft?.sourceUrl || "");
  const [categoryId, setCategoryId] = useState(initialDraft?.categoryId || "");
  const [servings, setServings] = useState(initialDraft?.servings || 4);
  const [categories, setCategories] = useState([]);
  const [cover, setCover] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [extraPhotos, setExtraPhotos] = useState([]);
  const [extraError, setExtraError] = useState("");
  const [video, setVideo] = useState(null);
  const [ingredients, setIngredients] = useState(initialDraft?.ingredients || [{ name: "", amount: "", unit: "г" }]);
  const [steps, setSteps] = useState(initialDraft?.steps || [{ text: "" }]);
  const [stepImages, setStepImages] = useState({});
  const [status, setStatus] = useState("");
  const [id, setId] = useState(recipeId || initialDraft?.id || null);

  useEffect(() => {
    void loadCategories(authFetch, API_URL).then(setCategories);
    if (recipeId) {
      void vmenuFetch(authFetch, API_URL, `/recipes/${recipeId}/`).then((r) => {
        setTitle(r.title || "");
        setDescription(r.description || "");
        setSourceUrl(r.source_url || "");
        setCategoryId(r.category?.id || "");
        setServings(r.servings || 4);
        setCoverPreview(r.cover_url || "");
        setIngredients(r.ingredients?.length ? r.ingredients : [{ name: "", amount: "", unit: "г" }]);
        setSteps(r.steps?.length ? r.steps : [{ text: "" }]);
      });
    }
  }, [recipeId]);

  async function saveDraft(silent = false) {
    if (!title.trim() && !description.trim()) return;
    const payload = { id, title, description, sourceUrl, categoryId, servings, ingredients, steps };
    sessionStorage.setItem(VMENU_DRAFT_KEY, JSON.stringify(payload));
    if (!silent) setStatus("Черновик сохранён");
    else setStatus("");
    const fd = new FormData();
    fd.append("title", title || "Черновик");
    fd.append("description", description);
    fd.append("servings", String(servings));
    if (categoryId) fd.append("category_id", categoryId);
    if (cover) fd.append("cover_image", cover);
    if (video) fd.append("video", video);
    fd.append("book_only", "1");
    let recipe = id;
    try {
      if (!id) {
        const created = await createRecipe(authFetch, API_URL, fd);
        recipe = created.id;
        setId(recipe);
      } else {
        await updateRecipe(authFetch, API_URL, id, fd);
      }
      await vmenuFetch(authFetch, API_URL, `/recipes/${recipe}/ingredients/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients }),
      });
      await saveRecipeSteps(authFetch, API_URL, recipe, steps, stepImages);
      sessionStorage.setItem(VMENU_DRAFT_KEY, JSON.stringify({ ...payload, id: recipe }));
    } catch {
      if (!silent) setStatus("Не удалось сохранить черновик");
    }
  }

  useEffect(() => {
    registerDraftSaver?.(saveDraft);
  }, [title, description, ingredients, steps, id, cover, video, servings, categoryId]);

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
      if (r.cover_url) setCoverPreview(r.cover_url);
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
    sessionStorage.removeItem(VMENU_DRAFT_KEY);
    setStatus("");
    onDone?.();
  }

  return (
    <div className="vmenu-tab vmenu-editor">
      <div className="vmenu-tab-head-row">
        <h2>{id ? "Редактирование" : "Новый рецепт"}</h2>
        <VmenuCloseButton onClick={onCancel} />
      </div>
      <VmenuFieldBlock label="Ссылка на рецепт (опционально)">
        <div className="row-2">
          <VmenuTextInput value={sourceUrl} onChange={setSourceUrl} placeholder="https://…" />
          <button type="button" className="ghost-btn" onClick={parseUrl}>
            Импорт
          </button>
        </div>
      </VmenuFieldBlock>
      <VmenuFieldBlock label="Название">
        <VmenuTextInput value={title} onChange={setTitle} />
      </VmenuFieldBlock>
      <VmenuFieldBlock label="Категория">
        <select className="vmenu-textinput" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">—</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </VmenuFieldBlock>
      <VmenuFieldBlock label="Описание">
        <VmenuTextArea value={description} onChange={setDescription} rows={4} />
      </VmenuFieldBlock>
      <VmenuFieldBlock label="Порций по рецепту">
        <VmenuTextInput type="number" value={String(servings)} onChange={(v) => setServings(Number(v) || 1)} />
      </VmenuFieldBlock>
      <VmenuMediaUpload
        label="Главное фото"
        accept="image/*"
        max={1}
        files={cover ? [cover] : []}
        previews={coverPreview && !cover ? [coverPreview] : []}
        onChange={(files) => {
          setCover(files[0] || null);
          if (files[0]) setCoverPreview(URL.createObjectURL(files[0]));
        }}
      />
      <VmenuMediaUpload
        label="Доп. фото (до 4)"
        accept="image/*"
        multiple
        max={4}
        files={extraPhotos}
        error={extraError}
        onChange={(files, err) => {
          setExtraError(err || "");
          setExtraPhotos(files);
        }}
        onRemove={(i) => setExtraPhotos((p) => p.filter((_, idx) => idx !== i))}
      />
      <VmenuMediaUpload
        label="Видео (опционально)"
        accept="video/*"
        max={1}
        files={video ? [video] : []}
        onChange={(files) => setVideo(files[0] || null)}
      />
      <h3>Ингредиенты</h3>
      {ingredients.map((ing, i) => (
        <div key={i} className="vmenu-ing-row">
          <input placeholder="Название" value={ing.name} onChange={(e) => {
            const next = [...ingredients]; next[i] = { ...ing, name: e.target.value }; setIngredients(next);
          }} />
          <input placeholder="Кол-во" value={ing.amount} onChange={(e) => {
            const next = [...ingredients]; next[i] = { ...ing, amount: e.target.value }; setIngredients(next);
          }} />
          <select value={ing.unit} onChange={(e) => {
            const next = [...ingredients]; next[i] = { ...ing, unit: e.target.value }; setIngredients(next);
          }}>
            {ALL_UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      ))}
      <button type="button" className="ghost-btn" onClick={() => setIngredients([...ingredients, { name: "", amount: "", unit: "г" }])}>
        + Ингредиент
      </button>
      <h3>Шаги</h3>
      {steps.map((st, i) => (
        <div key={i} className="vmenu-step-edit">
          <VmenuFieldBlock label={`Шаг ${i + 1}`}>
            <VmenuTextArea
              value={st.text}
              onChange={(v) => {
                const next = [...steps];
                next[i] = { ...st, text: v };
                setSteps(next);
              }}
              rows={5}
            />
          </VmenuFieldBlock>
          <VmenuMediaUpload
            label="Фото шага"
            accept="image/*"
            max={1}
            files={stepImages[i] ? [stepImages[i]] : []}
            onChange={(files) => setStepImages((prev) => ({ ...prev, [i]: files[0] || null }))}
          />
        </div>
      ))}
      <button type="button" className="ghost-btn" onClick={() => setSteps([...steps, { text: "" }])}>
        + Шаг
      </button>
      {status ? <p className="status">{status}</p> : null}
      <div className="vmenu-editor-actions">
        <button type="button" className="ghost-btn" onClick={() => saveDraft(false)}>
          Сохранить черновик
        </button>
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
  const [avatar, setAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url || "");

  function toggleInterest(catId) {
    setInterests((prev) => (prev.includes(catId) ? prev.filter((x) => x !== catId) : [...prev, catId].slice(0, 10)));
  }

  return (
    <div className="vmenu-tab vmenu-settings">
      <div className="vmenu-tab-head-row">
        <h2>Настройки Вменю</h2>
        <VmenuCloseButton onClick={onClose} />
      </div>
      <VmenuMediaUpload
        label="Аватар"
        accept="image/*"
        max={1}
        files={avatar ? [avatar] : []}
        previews={avatarPreview && !avatar ? [avatarPreview] : []}
        onChange={(files) => {
          setAvatar(files[0] || null);
          if (files[0]) setAvatarPreview(URL.createObjectURL(files[0]));
        }}
      />
      <VmenuFieldBlock label="О себе">
        <VmenuTextArea value={bio} onChange={setBio} rows={4} />
      </VmenuFieldBlock>
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
        onClick={() => onSave({ bio, allow_messages: allowMessages, interest_tags: interests, avatar })}
      >
        Сохранить
      </button>
    </div>
  );
}