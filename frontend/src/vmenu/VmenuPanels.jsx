import { useEffect, useState } from "react";
import {
  createRecipe,
  deleteRecipe,
  deleteExtraPhoto,
  followUser,
  loadBook,
  loadCategories,
  loadCuisines,
  loadFeed,
  loadFollows,
  loadMyProfile,
  loadRecipe,
  loadUserProfile,
  normalizeIngredient,
  openUserChat,
  parseRecipeUrl,
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
  VmenuConfirmModal,
  VmenuFieldBlock,
  VmenuMediaUpload,
  VmenuRatingBadge,
  VmenuStatWidget,
  VmenuTextArea,
  VmenuTextInput,
  VmenuTrashButton,
} from "./VmenuComponents.jsx";
import { ALL_UNITS, compatibleUnits, formatAmount, scaleIngredients } from "./vmenuUnits.js";
import VmenuLogo from "./VmenuLogo.jsx";
import { VmenuPostMenu } from "./VmenuPostMenu.jsx";
import { VmenuComments } from "./VmenuComments.jsx";

function VmenuRecipeMetaChips({ recipe }) {
  return (
    <div className="vmenu-meta-chips">
      {recipe.category ? <span className="vmenu-chip">{recipe.category.name}</span> : null}
      {recipe.cuisine ? <span className="vmenu-chip vmenu-chip--cuisine">{recipe.cuisine.name}</span> : null}
    </div>
  );
}

function groupBookItems(items) {
  const tree = {};
  for (const r of items) {
    const cat = r.category?.name || "Без категории";
    const cuisine = r.cuisine?.name || "Без кухни";
    if (!tree[cat]) tree[cat] = {};
    if (!tree[cat][cuisine]) tree[cat][cuisine] = [];
    tree[cat][cuisine].push(r);
  }
  return tree;
}

function VmenuUserRow({ user, onOpenUser, onToggleFollow, showFollow = true }) {
  return (
    <li className="vmenu-user-row">
      <button type="button" className="vmenu-user-row-main" onClick={() => onOpenUser?.(user.id)}>
        {user.avatar_url ? (
          <img className="vmenu-user-row-avatar" src={user.avatar_url} alt="" />
        ) : (
          <span className="vmenu-user-row-avatar vmenu-avatar-fallback">{user.display_name?.[0] || "?"}</span>
        )}
        <span className="vmenu-user-row-body">
          <strong>{user.display_name}</strong>
          <span className="muted small">@{user.username}</span>
        </span>
      </button>
      {showFollow ? (
        <button
          type="button"
          className={`vmenu-follow-toggle ${user.is_following ? "on" : ""}`}
          aria-label={user.is_following ? "Отписаться" : "Подписаться"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFollow?.(user);
          }}
        >
          {user.is_following ? "↩" : "➜"}
        </button>
      ) : null}
    </li>
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

export function VmenuRecipeCard({ recipe, authFetch, API_URL, me, onOpenUser, onOpenRecipe, onRefresh, onDeleted }) {
  const [liked, setLiked] = useState(Boolean(recipe.liked));
  const [saved, setSaved] = useState(Boolean(recipe.saved));
  const [likeCount, setLikeCount] = useState(recipe.like_count || 0);
  const [saveCount, setSaveCount] = useState(recipe.save_count || 0);

  useEffect(() => {
    setLiked(Boolean(recipe.liked));
    setSaved(Boolean(recipe.saved));
    setLikeCount(recipe.like_count || 0);
    setSaveCount(recipe.save_count || 0);
    setCommentCount(recipe.comment_count || 0);
    setAvgRating(recipe.avg_rating || 0);
  }, [recipe.id, recipe.liked, recipe.saved, recipe.like_count, recipe.save_count, recipe.comment_count, recipe.avg_rating]);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(recipe.comment_count || 0);
  const [avgRating, setAvgRating] = useState(recipe.avg_rating || 0);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

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

  const photos = [recipe.cover_url, ...(recipe.extra_photo_urls || [])].filter(Boolean);
  const isOwner = Number(recipe.author?.id) === Number(me?.id);

  async function handleDelete() {
    await deleteRecipe(authFetch, API_URL, recipe.id);
    setDeleteConfirm(false);
    onDeleted?.(recipe.id);
    onRefresh?.();
  }

  return (
    <article className="vmenu-card">
      <VmenuConfirmModal
        open={deleteConfirm}
        title="Удалить рецепт?"
        message="Рецепт будет удалён без возможности восстановления."
        confirmLabel="Удалить"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteConfirm(false)}
      />
      <VmenuRatingBadge rating={avgRating} />
      <VmenuPostMenu onDelete={() => setDeleteConfirm(true)} disabled={!isOwner} />
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
        <VmenuRecipeMetaChips recipe={recipe} />
        <div className="vmenu-card-actions">
          <button type="button" className={liked ? "active" : ""} onClick={onLike}>
            ♥ {likeCount}
          </button>
          <button type="button" className={saved ? "active" : ""} onClick={onSave} title="В книгу рецептов">
            ↪ {saveCount}
          </button>
          <button type="button" className={commentOpen ? "active" : ""} onClick={() => setCommentOpen((v) => !v)}>
            💬 {commentCount}
          </button>
          {avgRating > 0 ? <span className="vmenu-rating">★ {Number(avgRating).toFixed(1)}</span> : null}
        </div>
        {commentOpen ? (
          <VmenuComments
            recipeId={recipe.id}
            authFetch={authFetch}
            API_URL={API_URL}
            me={me}
            onOpenUser={onOpenUser}
            compact
            onCommentCountChange={(count, rating) => {
              setCommentCount(count);
              if (rating != null) setAvgRating(rating);
              onRefresh?.();
            }}
          />
        ) : null}
      </div>
    </article>
  );
}

export function VmenuRecipeDetail({ recipeId, authFetch, API_URL, me, onBack, onOpenUser, onDeleted }) {
  const [recipe, setRecipe] = useState(null);
  const [servings, setServings] = useState(4);
  const [status, setStatus] = useState("Загрузка…");
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [servingsInit, setServingsInit] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [ingUnitPick, setIngUnitPick] = useState({});

  useEffect(() => {
    setServingsInit(false);
    setCarouselIdx(0);
    setIngUnitPick({});
  }, [recipeId]);

  useEffect(() => {
    setLiked(Boolean(recipe?.liked));
    setSaved(Boolean(recipe?.saved));
  }, [recipe?.liked, recipe?.saved]);

  async function load() {
    setStatus("Загрузка…");
    try {
      const params = { servings: String(servings) };
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
  }, [recipeId, servings]);

  if (!recipe && status) return <p className="status">{status}</p>;
  if (!recipe) return null;

  const photos = [recipe.cover_url, ...(recipe.extra_photo_urls || [])].filter(Boolean);
  const baseIngredients = recipe.scaled_ingredients?.length ? recipe.scaled_ingredients : recipe.ingredients || [];
  const ingredients = baseIngredients.map((ing, i) => {
    const key = ing.id ?? i;
    const scaled = scaleIngredients([ing], recipe.servings, servings, null)[0];
    const picked = ingUnitPick[key];
    if (!picked || picked === (scaled.unit || "")) return scaled;
    const converted = scaleIngredients([ing], recipe.servings, servings, picked)[0];
    return converted;
  });

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

  const isOwner = Number(recipe?.author?.id) === Number(me?.id);

  async function handleDelete() {
    await deleteRecipe(authFetch, API_URL, recipe.id);
    setDeleteConfirm(false);
    onDeleted?.(recipe.id);
    onBack?.();
  }

  return (
    <div className="vmenu-tab vmenu-detail">
      <VmenuConfirmModal
        open={deleteConfirm}
        title="Удалить рецепт?"
        message="Рецепт будет удалён без возможности восстановления."
        confirmLabel="Удалить"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteConfirm(false)}
      />
      <div className="vmenu-detail-top">
        <VmenuBackButton onClick={onBack} />
        <VmenuPostMenu onDelete={() => setDeleteConfirm(true)} disabled={!isOwner} />
      </div>
      <div className="vmenu-detail-hero">
        {photos.length ? (
          <div className="vmenu-detail-gallery">
            <VmenuRatingBadge rating={recipe.avg_rating} />
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
      <div className="vmenu-detail-title-row">
        <h2>{recipe.title}</h2>
        {!photos.length ? <VmenuRatingBadge rating={recipe.avg_rating} inline /> : null}
      </div>
      <VmenuRecipeMetaChips recipe={recipe} />
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
      </div>
      <h3>Ингредиенты</h3>
      <ul className="vmenu-ing-list vmenu-ing-list--detail">
        {ingredients.map((ing, i) => {
          const key = ing.id ?? i;
          const baseIng = recipe.ingredients?.find((x) => x.id === ing.id) || recipe.ingredients?.[i] || ing;
          const unitOptions = [...new Set([baseIng.unit, ...compatibleUnits(baseIng.unit || "г")].filter(Boolean))];
          const currentUnit = ingUnitPick[key] ?? ing.unit ?? baseIng.unit ?? "";
          return (
            <li key={key} className="vmenu-ing-detail-row">
              <span className="vmenu-ing-detail-name">{ing.name}</span>
              <span className="vmenu-ing-detail-amount">
                {ing.amount === "" || ing.amount == null
                  ? ""
                  : formatAmount(ing.amount)}
              </span>
              <select
                className="vmenu-ing-detail-unit"
                value={currentUnit}
                onChange={(e) => setIngUnitPick((p) => ({ ...p, [key]: e.target.value }))}
                aria-label={`Единица для ${ing.name}`}
              >
                {unitOptions.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
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
      <VmenuComments
        recipeId={recipe.id}
        authFetch={authFetch}
        API_URL={API_URL}
        me={me}
        onOpenUser={onOpenUser}
        onCommentCountChange={(count, rating) => {
          setRecipe((r) => ({ ...r, comment_count: count, avg_rating: rating ?? r.avg_rating }));
        }}
      />
    </div>
  );
}

export function VmenuFeedTab({ authFetch, API_URL, me, onOpenUser, onOpenRecipe }) {
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

  function onDeleted(id) {
    setItems((prev) => prev.filter((r) => r.id !== id));
  }

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
            me={me}
            authFetch={authFetch}
            API_URL={API_URL}
            onOpenUser={onOpenUser}
            onOpenRecipe={onOpenRecipe}
            onRefresh={load}
            onDeleted={onDeleted}
          />
        ))}
      </div>
    </div>
  );
}

export function VmenuSearchTab({ authFetch, API_URL, me, onOpenUser, onOpenRecipe }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("rating");
  const [category, setCategory] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [categories, setCategories] = useState([]);
  const [cuisines, setCuisines] = useState([]);
  const [items, setItems] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestOpen, setSuggestOpen] = useState(false);

  useEffect(() => {
    void loadCategories(authFetch, API_URL).then((d) => setCategories(d || []));
    void loadCuisines(authFetch, API_URL).then((d) => setCuisines(d || []));
  }, [authFetch, API_URL]);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setSuggestOpen(false);
      return;
    }
    const timer = setTimeout(() => {
      void searchRecipes(authFetch, API_URL, { q: query, sort, category, cuisine, limit: 8 }).then((data) => {
        setSuggestions(data.items || []);
        setSuggestOpen(true);
      });
    }, 280);
    return () => clearTimeout(timer);
  }, [q, sort, category, cuisine, authFetch, API_URL]);

  async function runSearch(e) {
    e?.preventDefault();
    setSuggestOpen(false);
    const data = await searchRecipes(authFetch, API_URL, { q, sort, category, cuisine });
    setItems(data.items || []);
  }

  function pickSuggestion(recipe) {
    setSuggestOpen(false);
    onOpenRecipe?.(recipe.id);
  }

  return (
    <div className="vmenu-tab">
      <h2>Поиск рецептов</h2>
      <form className="vmenu-search-toolbar" onSubmit={runSearch}>
        <div className="vmenu-search-filters">
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Категория">
            <option value="">Все категории</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={cuisine} onChange={(e) => setCuisine(e.target.value)} aria-label="Кухня">
            <option value="">Все кухни</option>
            {cuisines.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Сортировка">
            <option value="rating">По рейтингу</option>
            <option value="popular">По популярности</option>
            <option value="new">Сначала новые</option>
          </select>
        </div>
        <div className="vmenu-search-query-row">
          <div className="vmenu-search-input-wrap">
            <input
              className="vmenu-search-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => suggestions.length && setSuggestOpen(true)}
              onBlur={() => window.setTimeout(() => setSuggestOpen(false), 180)}
              placeholder="Название, ингредиент…"
            />
            {suggestOpen && suggestions.length ? (
              <ul className="vmenu-search-suggest">
                {suggestions.map((r) => (
                  <li key={r.id}>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pickSuggestion(r)}>
                      {r.cover_url ? (
                        <img className="vmenu-search-suggest-thumb" src={r.cover_url} alt="" />
                      ) : (
                        <span className="vmenu-search-suggest-thumb vmenu-search-suggest-thumb--empty">🍽</span>
                      )}
                      <span className="vmenu-search-suggest-body">
                        <strong>{r.title}</strong>
                        {r.author?.display_name ? <span className="muted small">{r.author.display_name}</span> : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <button type="submit" className="vmenu-search-icon-btn" aria-label="Найти">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                fill="currentColor"
                d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
              />
            </svg>
          </button>
        </div>
      </form>
      <div className="vmenu-feed">
        {items.map((r) => (
          <VmenuRecipeCard
            key={r.id}
            recipe={r}
            me={me}
            authFetch={authFetch}
            API_URL={API_URL}
            onOpenUser={onOpenUser}
            onOpenRecipe={onOpenRecipe}
            onDeleted={(id) => setItems((prev) => prev.filter((x) => x.id !== id))}
          />
        ))}
      </div>
    </div>
  );
}

export function VmenuBookTab({ authFetch, API_URL, me, onCreate, onOpenRecipe, onEditRecipe }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openCats, setOpenCats] = useState({});
  const [openCuisines, setOpenCuisines] = useState({});
  const [removeTarget, setRemoveTarget] = useState(null);

  async function reload() {
    setLoading(true);
    try {
      const d = await loadBook(authFetch, API_URL);
      setItems(d.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [authFetch, API_URL]);

  async function confirmRemove() {
    if (!removeTarget) return;
    const r = removeTarget;
    const isOwner = Number(r.author?.id) === Number(me?.id);
    if (isOwner) await deleteRecipe(authFetch, API_URL, r.id);
    else await toggleSave(authFetch, API_URL, r.id, true);
    setRemoveTarget(null);
    await reload();
  }

  const grouped = groupBookItems(items);

  return (
    <div className="vmenu-tab vmenu-tab--book">
      <VmenuConfirmModal
        open={Boolean(removeTarget)}
        title={removeTarget && Number(removeTarget.author?.id) === Number(me?.id) ? "Удалить рецепт?" : "Убрать из книги?"}
        message={
          removeTarget && Number(removeTarget.author?.id) === Number(me?.id)
            ? "Рецепт будет удалён без возможности восстановления."
            : "Рецепт исчезнет из вашей книги, но останется у автора."
        }
        confirmLabel={removeTarget && Number(removeTarget.author?.id) === Number(me?.id) ? "Удалить" : "Убрать"}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setRemoveTarget(null)}
      />
      <div className="vmenu-tab-head-row">
        <h2>Книга рецептов</h2>
        <button type="button" className="primary-btn" onClick={onCreate}>
          + Создать
        </button>
      </div>
      {loading ? <p className="muted">Загрузка…</p> : null}
      <div className="vmenu-book-tree">
        {Object.entries(grouped).map(([cat, cuisines]) => (
          <div key={cat} className="vmenu-book-cat">
            <button
              type="button"
              className="vmenu-book-cat-head"
              onClick={() => setOpenCats((p) => ({ ...p, [cat]: !p[cat] }))}
            >
              <span>{openCats[cat] ? "▾" : "▸"}</span>
              <span>{cat}</span>
              <span className="muted">({Object.values(cuisines).flat().length})</span>
            </button>
            {openCats[cat] !== false ? (
              <div className="vmenu-book-subtree">
                {Object.entries(cuisines).map(([cuisineName, recipes]) => {
                  const subKey = `${cat}::${cuisineName}`;
                  return (
                    <div key={subKey} className="vmenu-book-subcat">
                      <button
                        type="button"
                        className="vmenu-book-subcat-head"
                        onClick={() => setOpenCuisines((p) => ({ ...p, [subKey]: !p[subKey] }))}
                      >
                        <span>{openCuisines[subKey] === false ? "▸" : "▾"}</span>
                        <span>{cuisineName}</span>
                        <span className="muted">({recipes.length})</span>
                      </button>
                      {openCuisines[subKey] !== false ? (
                        <ul className="vmenu-book-recipes">
                          {recipes.map((r) => {
                            const isOwner = Number(r.author?.id) === Number(me?.id);
                            return (
                              <li key={r.id} className="vmenu-book-row">
                                <button type="button" className="vmenu-book-row-main" onClick={() => onOpenRecipe?.(r.id)}>
                                  {r.cover_url ? (
                                    <img className="vmenu-book-thumb" src={r.cover_url} alt="" />
                                  ) : (
                                    <span className="vmenu-book-thumb vmenu-book-thumb--empty" />
                                  )}
                                  <span className="vmenu-book-row-title">
                                    <span className="vmenu-book-row-title-text">{r.title}</span>
                                    {r.status === "draft" ? <span className="vmenu-draft-badge">Черновик</span> : null}
                                  </span>
                                </button>
                                {isOwner ? (
                                  <button
                                    type="button"
                                    className="vmenu-book-icon-btn"
                                    aria-label="Редактировать"
                                    onClick={() => onEditRecipe?.(r.id)}
                                  >
                                    ✎
                                  </button>
                                ) : null}
                                <VmenuPostMenu
                                  onDelete={() => setRemoveTarget(r)}
                                  deleteLabel={isOwner ? "Удалить" : "Убрать из книги"}
                                />
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {!loading && !items.length ? <p className="muted">Сохраняйте рецепты или создавайте свои.</p> : null}
    </div>
  );
}

export function VmenuProfileTab({ authFetch, API_URL, me, onOpenUser, onOpenFollows, onCreate, onOpenSettings, onOpenRecipe }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    void loadMyProfile(authFetch, API_URL).then(setData);
  }, [authFetch, API_URL]);

  if (!data) return <p className="status">Загрузка…</p>;

  return (
    <div className="vmenu-tab vmenu-profile-tab">
      <div className="vmenu-profile-top">
        <div className="vmenu-profile-head">
          {data.profile?.avatar_url ? (
            <img className="vmenu-profile-avatar" src={data.profile.avatar_url} alt="" />
          ) : (
            <span className="vmenu-profile-avatar vmenu-avatar-fallback">{data.profile?.display_name?.[0] || "?"}</span>
          )}
          <div>
            <h2>{data.profile?.display_name || me?.username}</h2>
          </div>
        </div>
        <button type="button" className="vmenu-settings-icon-btn" onClick={onOpenSettings} aria-label="Настройки">
          ⚙
        </button>
      </div>
      <p className="muted">{data.profile?.bio || "Расскажите о себе в настройках."}</p>
      <div className="vmenu-stats-row">
        <VmenuStatWidget
          icon="👥"
          value={data.followers_count}
          label="подписчиков"
          avatars={data.recent_followers}
          onClick={() => onOpenFollows?.("followers")}
        />
        <VmenuStatWidget
          icon="➕"
          value={data.following_count}
          label="подписок"
          avatars={data.recent_following}
          onClick={() => onOpenFollows?.("following")}
        />
      </div>
      <button type="button" className="primary-btn vmenu-publish-btn" onClick={onCreate}>
        + Опубликовать рецепт
      </button>
      <div className="vmenu-feed">
        {data.recipes?.map((r) => (
          <VmenuRecipeCard
            key={r.id}
            recipe={r}
            me={me}
            authFetch={authFetch}
            API_URL={API_URL}
            onOpenUser={onOpenUser}
            onOpenRecipe={onOpenRecipe}
            onDeleted={(id) => setData((d) => ({ ...d, recipes: d.recipes.filter((x) => x.id !== id) }))}
          />
        ))}
      </div>
    </div>
  );
}

export function VmenuFollowsTab({ authFetch, API_URL, initialKind = "following", onOpenUser }) {
  const [kind, setKind] = useState(initialKind === "followers" ? "followers" : "following");
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [searchHits, setSearchHits] = useState([]);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [searchAll, setSearchAll] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    setKind(initialKind === "followers" ? "followers" : "following");
  }, [initialKind]);

  async function reloadList() {
    const d = await loadFollows(authFetch, API_URL, kind);
    setItems(d.items || []);
  }

  useEffect(() => {
    void reloadList();
  }, [authFetch, API_URL, kind]);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setSearchHits([]);
      setSearchHasMore(false);
      setSearchAll(false);
      return;
    }
    const timer = setTimeout(() => {
      void runUserSearch(query, false);
    }, 300);
    return () => clearTimeout(timer);
  }, [q, authFetch, API_URL]);

  async function runUserSearch(query, all) {
    setSearching(true);
    try {
      const d = await searchUsers(authFetch, API_URL, query, all ? { all: true } : { limit: 10 });
      setSearchHits(d.items || []);
      setSearchHasMore(Boolean(d.has_more));
      setSearchAll(all);
    } finally {
      setSearching(false);
    }
  }

  const listUsers = q.trim().length >= 2 ? searchHits : items;

  return (
    <div className="vmenu-tab vmenu-tab--follows">
      <h2>Подписки</h2>
      <div className="vmenu-search-form">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по имени или логину"
        />
        {searching ? <span className="muted small">Поиск…</span> : null}
      </div>
      {q.trim().length >= 2 && searchHasMore && !searchAll ? (
        <button type="button" className="ghost-btn vmenu-show-all-btn" onClick={() => runUserSearch(q.trim(), true)}>
          Показать всех ({searchHits.length}+)
        </button>
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
        {listUsers.map((u) => (
          <VmenuUserRow
            key={u.id}
            user={u}
            onOpenUser={onOpenUser}
            showFollow={false}
          />
        ))}
      </ul>
      {!listUsers.length ? <p className="muted">Никого не найдено.</p> : null}
    </div>
  );
}

export function VmenuUserView({ userId, authFetch, API_URL, me, onBack, onOpenChat, onOpenRecipe }) {
  const [data, setData] = useState(null);
  const [unfollowConfirm, setUnfollowConfirm] = useState(false);

  useEffect(() => {
    void loadUserProfile(authFetch, API_URL, userId).then(setData);
  }, [userId, authFetch, API_URL]);

  if (!data) return <p className="status">Загрузка…</p>;
  const u = data.user;

  async function doUnfollow() {
    await followUser(authFetch, API_URL, userId, true);
    setUnfollowConfirm(false);
    const fresh = await loadUserProfile(authFetch, API_URL, userId);
    setData(fresh);
  }

  async function doFollow() {
    await followUser(authFetch, API_URL, userId, false);
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
    <div className="vmenu-tab vmenu-user-view">
      <VmenuConfirmModal
        open={unfollowConfirm}
        title="Отписаться?"
        message="Вы действительно хотите отписаться?"
        confirmLabel="Отписаться"
        onConfirm={() => void doUnfollow()}
        onCancel={() => setUnfollowConfirm(false)}
      />
      <VmenuBackButton onClick={onBack} />
      <div className="vmenu-user-view-head">
        {u.avatar_url ? (
          <img className="vmenu-profile-avatar" src={u.avatar_url} alt="" />
        ) : (
          <span className="vmenu-profile-avatar vmenu-avatar-fallback">{u.display_name?.[0] || "?"}</span>
        )}
        <div>
          <h2>{u.display_name}</h2>
          <p className="muted">@{u.username}</p>
        </div>
      </div>
      <div className="vmenu-profile-actions">
        {data.is_following ? (
          <button type="button" className="vmenu-subscribed-btn" onClick={() => setUnfollowConfirm(true)}>
            ✓ Вы подписаны
          </button>
        ) : (
          <button type="button" className="primary-btn" onClick={() => void doFollow()}>
            Подписаться
          </button>
        )}
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
            me={me}
            authFetch={authFetch}
            API_URL={API_URL}
            onOpenRecipe={onOpenRecipe}
            onDeleted={(id) => setData((d) => ({ ...d, recipes: d.recipes.filter((x) => x.id !== id) }))}
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
  const [cuisineId, setCuisineId] = useState(initialDraft?.cuisineId || "");
  const [servings, setServings] = useState(initialDraft?.servings || 4);
  const [categories, setCategories] = useState([]);
  const [cuisines, setCuisines] = useState([]);
  const [cover, setCover] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [clearCover, setClearCover] = useState(false);
  const [extraPhotos, setExtraPhotos] = useState([]);
  const [existingExtraPhotos, setExistingExtraPhotos] = useState([]);
  const [extraError, setExtraError] = useState("");
  const [video, setVideo] = useState(null);
  const [videoPreview, setVideoPreview] = useState("");
  const [clearVideo, setClearVideo] = useState(false);
  const [ingredients, setIngredients] = useState(initialDraft?.ingredients || [{ name: "", amount: "", unit: "г" }]);
  const [steps, setSteps] = useState(initialDraft?.steps || [{ text: "" }]);
  const [stepImages, setStepImages] = useState({});
  const [stepImagePreviews, setStepImagePreviews] = useState({});
  const [status, setStatus] = useState("");
  const [id, setId] = useState(recipeId || initialDraft?.id || null);

  useEffect(() => {
    void loadCategories(authFetch, API_URL).then(setCategories);
    void loadCuisines(authFetch, API_URL).then(setCuisines);
    if (recipeId) {
      void vmenuFetch(authFetch, API_URL, `/recipes/${recipeId}/`).then((r) => {
        setTitle(r.title || "");
        setDescription(r.description || "");
        setSourceUrl(r.source_url || "");
        setCategoryId(r.category?.id || "");
        setCuisineId(r.cuisine?.id || "");
        setServings(r.servings || 4);
        setIngredients(r.ingredients?.length ? r.ingredients.map(normalizeIngredient) : [{ name: "", amount: "", unit: "г" }]);
        setCoverPreview(r.cover_url || "");
        setClearCover(false);
        setExistingExtraPhotos(r.extra_photos || []);
        setExtraPhotos([]);
        setVideoPreview(r.video_url || "");
        setClearVideo(false);
        setVideo(null);
        setSteps(r.steps?.length ? r.steps : [{ text: "" }]);
        setStepImages({});
        const previews = {};
        r.steps?.forEach((st, i) => {
          if (st.image_url) previews[i] = st.image_url;
        });
        setStepImagePreviews(previews);
      });
    }
  }, [recipeId]);

  async function saveDraft(silent = false) {
    if (!title.trim() && !description.trim()) return;
    const payload = { id, title, description, sourceUrl, categoryId, cuisineId, servings, ingredients, steps };
    sessionStorage.setItem(VMENU_DRAFT_KEY, JSON.stringify(payload));
    if (!silent) setStatus("Черновик сохранён");
    else setStatus("");
    const fd = new FormData();
    fd.append("title", title || "Черновик");
    fd.append("description", description);
    fd.append("servings", String(servings));
    if (categoryId) fd.append("category_id", categoryId);
    if (cuisineId) fd.append("cuisine_id", cuisineId);
    if (cover) fd.append("cover_image", cover);
    if (clearCover) fd.append("clear_cover", "1");
    if (video) fd.append("video", video);
    if (clearVideo) fd.append("clear_video", "1");
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
  }, [title, description, ingredients, steps, id, cover, video, servings, categoryId, cuisineId]);

  async function parseUrl() {
    setStatus("Импорт…");
    try {
      const r = await parseRecipeUrl(authFetch, API_URL, sourceUrl);
      setId(r.id);
      setTitle(r.title || "");
      setDescription(r.description || "");
      setServings(r.servings || 4);
      if (r.category?.id) setCategoryId(r.category.id);
      if (r.cuisine?.id) setCuisineId(r.cuisine.id);
      if (r.ingredients?.length) setIngredients(r.ingredients.map(normalizeIngredient));
      if (r.steps?.length) {
        setSteps(r.steps);
        const previews = {};
        r.steps.forEach((st, i) => {
          if (st.image_url) previews[i] = st.image_url;
        });
        setStepImagePreviews(previews);
        setStepImages({});
      }
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
    if (cuisineId) fd.append("cuisine_id", cuisineId);
    if (cover) fd.append("cover_image", cover);
    if (clearCover) fd.append("clear_cover", "1");
    if (video) fd.append("video", video);
    if (clearVideo) fd.append("clear_video", "1");
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
      const slots = Math.max(0, 4 - existingExtraPhotos.length);
      if (slots > 0) {
        await uploadExtraPhotos(authFetch, API_URL, recipe, extraPhotos.slice(0, slots));
      }
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
      <VmenuFieldBlock label="Кухня">
        <select className="vmenu-textinput" value={cuisineId} onChange={(e) => setCuisineId(e.target.value)}>
          <option value="">—</option>
          {cuisines.map((c) => (
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
        previews={coverPreview && !cover && !clearCover ? [coverPreview] : []}
        onChange={(files) => {
          const f = files[0] || null;
          setCover(f);
          setClearCover(false);
          if (f) setCoverPreview(URL.createObjectURL(f));
        }}
        onRemove={() => {
          setCover(null);
          setCoverPreview("");
          setClearCover(true);
        }}
      />
      <VmenuMediaUpload
        label="Доп. фото (до 4)"
        accept="image/*"
        multiple
        max={4}
        files={extraPhotos}
        remotePreviews={existingExtraPhotos}
        error={extraError}
        onChange={(files, err) => {
          setExtraError(err || "");
          setExtraPhotos(files);
        }}
        onRemove={(i) => setExtraPhotos((p) => p.filter((_, idx) => idx !== i))}
        onRemoveRemote={(photoId) => {
          void (async () => {
            if (id) {
              try {
                await deleteExtraPhoto(authFetch, API_URL, id, photoId);
              } catch {
                setExtraError("Не удалось удалить фото");
                return;
              }
            }
            setExistingExtraPhotos((p) => p.filter((x) => x.id !== photoId));
          })();
        }}
      />
      <VmenuMediaUpload
        label="Видео (опционально)"
        accept="video/*"
        max={1}
        mediaType="video"
        files={video ? [video] : []}
        previews={videoPreview && !video && !clearVideo ? [videoPreview] : []}
        onChange={(files) => {
          const f = files[0] || null;
          setVideo(f);
          setClearVideo(false);
          if (f) setVideoPreview(URL.createObjectURL(f));
        }}
        onRemove={() => {
          setVideo(null);
          setVideoPreview("");
          setClearVideo(true);
        }}
      />
      <h3>Ингредиенты</h3>
      {ingredients.map((ing, i) => (
        <div key={i} className="vmenu-ing-edit-row">
          <input
            className="vmenu-textinput"
            placeholder="Название"
            value={ing.name}
            onChange={(e) => {
              const next = [...ingredients];
              next[i] = { ...ing, name: e.target.value };
              setIngredients(next);
            }}
          />
          <input
            className="vmenu-textinput vmenu-ing-amount"
            placeholder="Кол-во"
            value={ing.amount}
            onChange={(e) => {
              const next = [...ingredients];
              next[i] = { ...ing, amount: e.target.value };
              setIngredients(next);
            }}
          />
          <select
            className="vmenu-textinput vmenu-ing-unit"
            value={ing.unit || ""}
            onChange={(e) => {
              const next = [...ingredients];
              next[i] = { ...ing, unit: e.target.value };
              setIngredients(next);
            }}
          >
            <option value="">—</option>
            {ALL_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <VmenuTrashButton
            label="Удалить ингредиент"
            onClick={() => {
              const next = ingredients.filter((_, idx) => idx !== i);
              setIngredients(next.length ? next : [{ name: "", amount: "", unit: "г" }]);
            }}
          />
        </div>
      ))}
      <button type="button" className="ghost-btn" onClick={() => setIngredients([...ingredients, { name: "", amount: "", unit: "г" }])}>
        + Ингредиент
      </button>
      <h3>Шаги</h3>
      {steps.map((st, i) => (
        <div key={i} className="vmenu-step-edit">
          <div className="vmenu-step-edit-head">
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
            <VmenuTrashButton
              label="Удалить шаг"
              onClick={() => {
                const next = steps.filter((_, idx) => idx !== i);
                setSteps(next.length ? next : [{ text: "" }]);
                setStepImages((prev) => {
                  const out = {};
                  Object.entries(prev).forEach(([k, v]) => {
                    const ki = Number(k);
                    if (ki < i) out[ki] = v;
                    else if (ki > i) out[ki - 1] = v;
                  });
                  return out;
                });
                setStepImagePreviews((prev) => {
                  const out = {};
                  Object.entries(prev).forEach(([k, v]) => {
                    const ki = Number(k);
                    if (ki < i) out[ki] = v;
                    else if (ki > i) out[ki - 1] = v;
                  });
                  return out;
                });
              }}
            />
          </div>
          <VmenuMediaUpload
            label="Фото шага"
            accept="image/*"
            max={1}
            files={stepImages[i] ? [stepImages[i]] : []}
            previews={stepImagePreviews[i] && !stepImages[i] ? [stepImagePreviews[i]] : []}
            onChange={(files) => setStepImages((prev) => ({ ...prev, [i]: files[0] || null }))}
            onRemove={() => {
              setStepImages((prev) => {
                const next = { ...prev };
                delete next[i];
                return next;
              });
              setStepImagePreviews((prev) => {
                const next = { ...prev };
                delete next[i];
                return next;
              });
            }}
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