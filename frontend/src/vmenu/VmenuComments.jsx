import { useEffect, useRef, useState } from "react";
import { loadRecipe, postComment, toggleCommentLike } from "./vmenuApi.js";
import { VmenuTextArea } from "./VmenuComponents.jsx";

function Stars({ value, onChange, disabled }) {
  return (
    <span className="vmenu-stars" aria-label="Оценка">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={n <= value ? "on" : ""}
          disabled={disabled}
          onClick={() => onChange?.(n)}
        >
          ★
        </button>
      ))}
    </span>
  );
}

export function VmenuComments({
  recipeId,
  authFetch,
  API_URL,
  me,
  onOpenUser,
  compact = false,
  onCommentCountChange,
}) {
  const [comments, setComments] = useState([]);
  const [myRating, setMyRating] = useState(0);
  const [rating, setRating] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [attachFiles, setAttachFiles] = useState([]);
  const commentInputRef = useRef(null);
  const fileInputRef = useRef(null);

  async function reload() {
    setLoading(true);
    try {
      const data = await loadRecipe(authFetch, API_URL, recipeId);
      setComments(data.comments || []);
      const mr = data.my_rating || 0;
      setMyRating(mr);
      setRating(mr || 0);
      onCommentCountChange?.(data.comment_count || 0, data.avg_rating);
      setStatus("");
    } catch (e) {
      setStatus(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [recipeId]);

  function startReply(comment) {
    const username = comment.user?.username || "";
    setReplyTo({ id: comment.id, username });
    setCommentText(username ? `@${username} ` : "");
    commentInputRef.current?.focus();
  }

  function cancelReply() {
    setReplyTo(null);
    setCommentText("");
  }

  function pickAttachments(e) {
    const picked = Array.from(e.target.files || []).slice(0, 4);
    setAttachFiles(picked);
    e.target.value = "";
  }

  async function submitComment(e) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("text", commentText);
    if (replyTo) {
      if (replyTo.username) fd.append("reply_to_username", replyTo.username);
      if (replyTo.id) fd.append("parent_id", String(replyTo.id));
      fd.append("rating", "0");
    } else if (myRating > 0) {
      fd.append("rating", String(rating || myRating));
    } else if (rating > 0) {
      fd.append("rating", String(rating));
    } else {
      fd.append("rating", "0");
    }
    for (const f of attachFiles) fd.append("photos", f);
    await postComment(authFetch, API_URL, recipeId, fd);
    setCommentText("");
    setReplyTo(null);
    setAttachFiles([]);
    await reload();
  }

  async function onCommentLike(comment) {
    const data = await toggleCommentLike(authFetch, API_URL, recipeId, comment.id, comment.liked);
    setComments((prev) =>
      prev.map((c) => (c.id === comment.id ? { ...c, liked: data.liked, like_count: data.like_count } : c)),
    );
  }

  const hasRated = myRating > 0;

  return (
    <div className={`vmenu-comments-block ${compact ? "vmenu-comments-block--compact" : ""}`}>
      {!compact ? <h3>Комментарии</h3> : null}
      {loading && !comments.length ? <p className="muted small">Загрузка…</p> : null}
      <ul className="vmenu-comments-list">
        {comments.map((c) => (
          <li key={c.id} className="vmenu-comment-item">
            <div className="vmenu-comment-head">
              <button type="button" className="vmenu-comment-user" onClick={() => onOpenUser?.(c.user?.id)}>
                {c.user?.avatar_url ? (
                  <img className="vmenu-comment-avatar" src={c.user.avatar_url} alt="" />
                ) : (
                  <span className="vmenu-comment-avatar vmenu-avatar-fallback">{c.user?.display_name?.[0] || "?"}</span>
                )}
                <strong>{c.user?.display_name}</strong>
              </button>
              {c.rating ? <span className="vmenu-comment-rating">★ {c.rating}</span> : null}
              <button
                type="button"
                className="vmenu-comment-reply"
                aria-label="Ответить"
                onClick={() => startReply(c)}
              >
                ↩
              </button>
            </div>
            {c.reply_to_user ? (
              <span className="muted small">@{c.reply_to_user.username} </span>
            ) : null}
            <p>{c.text}</p>
            <button
              type="button"
              className={`vmenu-comment-like ${c.liked ? "active" : ""}`}
              onClick={() => onCommentLike(c)}
            >
              ♥ {c.like_count || 0}
            </button>
          </li>
        ))}
      </ul>
      {!comments.length && !loading ? <p className="muted small">Пока нет комментариев.</p> : null}
      <form className="vmenu-comment-compose" onSubmit={submitComment}>
        {!replyTo && !hasRated ? (
          <div className="vmenu-comment-rating-row">
            <Stars value={rating} onChange={setRating} />
          </div>
        ) : null}
        {attachFiles.length ? (
          <p className="muted small vmenu-comment-attach-hint">
            Прикреплено: {attachFiles.map((f) => f.name).join(", ")}
          </p>
        ) : null}
        <div className="vmenu-comment-input-row">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            onChange={pickAttachments}
          />
          {replyTo ? (
            <button type="button" className="vmenu-comment-reply-prefix" onClick={cancelReply} aria-label="Отменить ответ">
              ↩
            </button>
          ) : null}
          <VmenuTextArea
            ref={commentInputRef}
            value={commentText}
            onChange={setCommentText}
            rows={compact ? 2 : 3}
            placeholder={replyTo ? "" : "Комментарий…"}
          />
          <button
            type="button"
            className="vmenu-comment-attach-btn"
            aria-label="Прикрепить фото или видео"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                fill="currentColor"
                d="M16.5 6v11.5a4 4 0 0 1-8 0V5a2.5 2.5 0 0 1 5 0v10.5a1 1 0 1 1-2 0V6H10v9.5a2.5 2.5 0 0 0 5 0V5a4 4 0 0 0-8 0v12.5a6 6 0 0 0 12 0V6h-2.5z"
              />
            </svg>
          </button>
          <button type="submit" className="vmenu-send-btn" aria-label="Отправить">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path fill="currentColor" d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </form>
      {status ? <p className="status error">{status}</p> : null}
    </div>
  );
}
