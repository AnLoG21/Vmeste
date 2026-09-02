import { useEffect, useRef } from "react";

const BOOKING_MSG_PRESETS = {
  confirm: [
    "Здравствуйте! Ваша запись подтверждена на {date}. Ждём вас!",
    "Запись на {date} подтверждена. Если планы изменятся — напишите нам заранее.",
    "Подтверждаем запись на {date}. До встречи!",
  ],
  cancel: [
    "К сожалению, запись на {date} отменена. При необходимости выберите другое время.",
    "Ваша запись на {date} отменена. Будем рады видеть вас в другой день.",
    "Запись на {date} снята. Если нужна помощь с новой записью — напишите нам.",
  ],
  done: [
    "Спасибо, что были с нами {date}! Будем рады отзыву и новой встрече.",
    "Услуга по записи на {date} оказана. Благодарим за визит!",
    "Запись на {date} завершена. Спасибо, что выбрали нас!",
  ],
};

const BOOKING_TOKEN_DEFS = {
  org: { token: "{org}", label: "Организация", title: "Название организации" },
  service: { token: "{service}", label: "Услуга", title: "Название услуги" },
  date: { token: "{date}", label: "Дата и время записи", title: "Дата и время записи клиента" },
  weeks: { token: "{weeks}", label: "Недель", title: "Сколько недель без визита" },
  client: { token: "{client}", label: "Клиент", title: "Имя клиента" },
};
const BOOKING_TOKEN_SPLIT_RE = /(\{org\}|\{service\}|\{date\}|\{weeks\}|\{client\})/g;
const BOOKING_MESSAGE_DATE_TOKEN = "{date}";
const bookingTokenDragRef = { el: null };
const bookingTokenPointerRef = { active: false, token: null, editorRoot: null, onComplete: null };

function bookingTokenKindFromValue(value) {
  const raw = String(value || "").trim();
  if (raw.startsWith("{") && raw.endsWith("}")) {
    const kind = raw.slice(1, -1);
    if (BOOKING_TOKEN_DEFS[kind]) return kind;
    return null;
  }
  return BOOKING_TOKEN_DEFS[raw] ? raw : null;
}

function stopBookingTokenPointerDrag() {
  document.getElementById("booking-token-ghost")?.remove();
  if (!bookingTokenPointerRef.active) return;
  bookingTokenPointerRef.active = false;
  bookingTokenPointerRef.token = null;
  bookingTokenPointerRef.editorRoot = null;
  bookingTokenPointerRef.onComplete = null;
  document.body.classList.remove("booking-token-pointer-dragging");
  document.removeEventListener("pointermove", onBookingTokenPointerMove);
  document.removeEventListener("pointerup", onBookingTokenPointerUp);
  document.removeEventListener("pointercancel", onBookingTokenPointerUp);
}

function onBookingTokenPointerMove(e) {
  if (!bookingTokenPointerRef.active) return;
  e.preventDefault();
  let ghost = document.getElementById("booking-token-ghost");
  if (!ghost) {
    ghost = document.createElement("div");
    ghost.id = "booking-token-ghost";
    const kind = bookingTokenPointerRef.token?.dataset?.bookingToken || "date";
    ghost.textContent = BOOKING_TOKEN_DEFS[kind]?.label || "Дата и время";
    Object.assign(ghost.style, {
      position: "fixed",
      zIndex: "9999",
      pointerEvents: "none",
      padding: "6px 10px",
      borderRadius: "999px",
      background: "#fff",
      boxShadow: "0 4px 16px rgba(0,0,0,.18)",
    });
    document.body.appendChild(ghost);
  }
  ghost.style.left = `${e.clientX + 12}px`;
  ghost.style.top = `${e.clientY + 12}px`;
}

function onBookingTokenPointerUp(e) {
  const { token, editorRoot, onComplete } = bookingTokenPointerRef;
  token?.classList?.remove("booking-msg-token--dragging");
  stopBookingTokenPointerDrag();
  if (typeof onComplete === "function") onComplete(e.clientX, e.clientY, editorRoot);
}

function startBookingTokenPointerDrag({ token, editorRoot, onComplete }) {
  stopBookingTokenPointerDrag();
  bookingTokenPointerRef.active = true;
  bookingTokenPointerRef.token = token;
  bookingTokenPointerRef.editorRoot = editorRoot;
  bookingTokenPointerRef.onComplete = onComplete;
  token?.classList?.add("booking-msg-token--dragging");
  token?.classList?.add("booking-msg-token--pointer-enabled");
  document.body.classList.add("booking-token-pointer-dragging");
  document.addEventListener("pointermove", onBookingTokenPointerMove, { passive: false });
  document.addEventListener("pointerup", onBookingTokenPointerUp);
  document.addEventListener("pointercancel", onBookingTokenPointerUp);
}

function getBookingEditorCaretAtPoint(root, clientX, clientY, excludeToken = null) {
  if (!root) return null;

  if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(clientX, clientY);
    if (range && root.contains(range.commonAncestorContainer)) {
      if (!excludeToken || !excludeToken.contains(range.commonAncestorContainer)) return range;
    }
  } else if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(clientX, clientY);
    if (pos?.offsetNode && root.contains(pos.offsetNode)) {
      if (!excludeToken || !excludeToken.contains(pos.offsetNode)) {
        const range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
        return range;
      }
    }
  }

  let node = document.elementFromPoint(clientX, clientY);
  if (!node || !root.contains(node)) return null;

  const hitToken = node.closest?.("[data-booking-token]");
  if (hitToken && root.contains(hitToken) && hitToken !== excludeToken) {
    const range = document.createRange();
    const rect = hitToken.getBoundingClientRect();
    if (clientX > rect.left + rect.width / 2) range.setStartAfter(hitToken);
    else range.setStartBefore(hitToken);
    range.collapse(true);
    return range;
  }

  let child = node;
  while (child && child.parentNode !== root) child = child.parentNode;
  if (child && child !== root) {
    const range = document.createRange();
    const rect = child.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const midX = rect.left + rect.width / 2;
    if (clientY > midY || (clientY >= rect.top && clientX > midX)) {
      if (child.nextSibling) range.setStartBefore(child.nextSibling);
      else range.setStartAfter(child);
    } else {
      range.setStartBefore(child);
    }
    range.collapse(true);
    if (root.contains(range.commonAncestorContainer)) return range;
  }

  const fallback = document.createRange();
  fallback.selectNodeContents(root);
  fallback.collapse(false);
  return fallback;
}

function insertBookingTokenAtRange(root, range, token) {
  if (!root || !token) return;
  if (range && root.contains(range.commonAncestorContainer)) {
    range.insertNode(token);
    range.setStartAfter(token);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  } else {
    root.appendChild(token);
  }
}

function dropBookingTokenAtPoint(
  root,
  clientX,
  clientY,
  { moveToken = null, createNew = false, tokenKind = "date", onAfterChange } = {},
) {
  if (!root) return;
  const rect = root.getBoundingClientRect();
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return;

  const range = getBookingEditorCaretAtPoint(root, clientX, clientY, moveToken || null);
  let token = moveToken;
  if (createNew) token = createBookingTokenElement(root, onAfterChange, tokenKind);
  else if (token?.parentNode) token.remove();

  insertBookingTokenAtRange(root, range, token);
  resizeBookingEditor(root);
  onAfterChange?.();
}

function parseBookingMessage(value) {
  if (!value) return [""];
  return value.split(BOOKING_TOKEN_SPLIT_RE);
}

function serializeBookingEditor(root) {
  if (!root) return "";
  let out = "";
  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent || "";
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node;
    const kind = el.dataset?.bookingToken;
    if (kind && BOOKING_TOKEN_DEFS[kind]) {
      out += BOOKING_TOKEN_DEFS[kind].token;
      return;
    }
    if (el.tagName === "BR") {
      out += "\n";
      return;
    }
    out += serializeBookingEditor(el);
  });
  return out;
}

function resizeBookingEditor(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.max(el.scrollHeight, 72)}px`;
}

function bindInlineBookingTokenDrag(token, editorRoot, onAfterChange) {
  if (!token || token.dataset.pointerDragBound) return;
  token.dataset.pointerDragBound = "1";
  token.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (e.target.closest(".booking-msg-token-remove")) return;
    e.preventDefault();
    e.stopPropagation();
    startBookingTokenPointerDrag({
      token,
      editorRoot,
      onComplete: (x, y, root) => {
        dropBookingTokenAtPoint(root || editorRoot, x, y, { moveToken: token, onAfterChange });
      },
    });
  });
  token.draggable = true;
  token.addEventListener("dragstart", (e) => {
    bookingTokenDragRef.el = token;
    token.classList.add("booking-msg-token--dragging");
    const kind = token.dataset?.bookingToken || "date";
    e.dataTransfer.setData("application/x-booking-token-move", "1");
    e.dataTransfer.setData("application/x-booking-token", kind);
    e.dataTransfer.setData("text/plain", BOOKING_TOKEN_DEFS[kind]?.token || BOOKING_MESSAGE_DATE_TOKEN);
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setDragImage(document.createElement("span"), 0, 0);
    } catch {
      // ignore
    }
  });
  token.addEventListener("dragend", () => {
    bookingTokenDragRef.el = null;
    token.classList.remove("booking-msg-token--dragging");
  });
}

function createBookingTokenElement(editorRoot, onAfterChange, kind = "date") {
  const def = BOOKING_TOKEN_DEFS[kind] || BOOKING_TOKEN_DEFS.date;
  const wrap = document.createElement("span");
  wrap.contentEditable = "false";
  wrap.dataset.bookingToken = kind;
  wrap.className = "booking-msg-token booking-msg-token--inline";
  wrap.setAttribute("title", def.title);
  wrap.innerHTML = `<span class="booking-msg-token-grip" aria-hidden="true">⋮⋮</span> ${def.label} <span class="booking-msg-token-remove" role="button" tabindex="0" aria-label="Убрать ${def.label.toLowerCase()}">×</span>`;
  bindInlineBookingTokenDrag(wrap, editorRoot, onAfterChange);
  return wrap;
}

function syncBookingEditorFromValue(root, value, onAfterChange) {
  if (!root) return;
  root.innerHTML = "";
  parseBookingMessage(value).forEach((part) => {
    const kind = part.match(/^\{(\w+)\}$/)?.[1];
    if (kind && BOOKING_TOKEN_DEFS[kind]) {
      root.appendChild(createBookingTokenElement(root, onAfterChange, kind));
    } else if (part) {
      root.appendChild(document.createTextNode(part));
    }
  });
  resizeBookingEditor(root);
}

function insertBookingTokenAtSelection(root, onAfterChange, kind = "date") {
  if (!root) return;
  root.focus();
  const token = createBookingTokenElement(root, onAfterChange, kind);
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    root.appendChild(token);
  } else {
    const range = sel.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) {
      root.appendChild(token);
    } else {
      range.deleteContents();
      range.insertNode(token);
      range.setStartAfter(token);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }
  resizeBookingEditor(root);
  onAfterChange?.();
}

function BookingMsgToken({ kind = "date", onPointerDown, onDragStart, onRemove, onClick, className = "" }) {
  const def = BOOKING_TOKEN_DEFS[kind] || BOOKING_TOKEN_DEFS.date;
  return (
    <button
      type="button"
      draggable
      data-booking-token={kind}
      className={["booking-msg-token", className].filter(Boolean).join(" ")}
      style={{ touchAction: "none" }}
      onPointerDown={onPointerDown}
      onDragStart={onDragStart}
      onClick={onClick}
      title="Перетащите в текст или нажмите для вставки"
    >
      <span className="booking-msg-token-grip" aria-hidden="true">
        ⋮⋮
      </span>
      {def.label}
      {onRemove ? (
        <span
          role="button"
          tabIndex={0}
          className="booking-msg-token-remove"
          aria-label={`Убрать ${def.label.toLowerCase()}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }
          }}
        >
          ×
        </span>
      ) : null}
    </button>
  );
}

export default function BookingMessageField({
  id,
  label,
  value,
  onChange,
  placeholder,
  highlighted,
  presetKey,
  tokens = ["date"],
}) {
  const hintPlaceholder =
    placeholder || BOOKING_MSG_PRESETS[presetKey]?.[0] || "Текст сообщения клиенту…";
  const editorRef = useRef(null);
  const syncingRef = useRef(false);
  const isEmpty = !(value || "").trim();
  const tokenKinds = tokens.filter((kind) => BOOKING_TOKEN_DEFS[kind]);

  function emitFromEditor() {
    const el = editorRef.current;
    if (!el) return;
    syncingRef.current = true;
    onChange(serializeBookingEditor(el));
    syncingRef.current = false;
    resizeBookingEditor(el);
  }

  function onTokenDragStart(kind, e) {
    e.dataTransfer.setData("application/x-booking-token", kind);
    e.dataTransfer.setData("text/plain", BOOKING_TOKEN_DEFS[kind]?.token || BOOKING_MESSAGE_DATE_TOKEN);
    e.dataTransfer.effectAllowed = "copy";
    try {
      e.dataTransfer.setDragImage(document.createElement("span"), 0, 0);
    } catch {
      // ignore
    }
  }

  function onPalettePointerDown(kind, e) {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const root = editorRef.current;
    startBookingTokenPointerDrag({
      token: e.currentTarget,
      editorRoot: root,
      onComplete: (x, y, editorRoot) => {
        if (Math.hypot(x - startX, y - startY) < 8) return;
        dropBookingTokenAtPoint(editorRoot || root, x, y, {
          createNew: true,
          tokenKind: kind,
          onAfterChange: emitFromEditor,
        });
      },
    });
  }

  function insertToken(kind) {
    insertBookingTokenAtSelection(editorRef.current, emitFromEditor, kind);
  }

  useEffect(() => {
    const el = editorRef.current;
    if (!el || syncingRef.current) return;
    if (serializeBookingEditor(el) !== value) {
      syncBookingEditorFromValue(el, value, emitFromEditor);
    }
  }, [value]);

  useEffect(() => () => stopBookingTokenPointerDrag(), []);

  return (
    <div className="booking-msg-field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div
        id={id}
        ref={editorRef}
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        contentEditable
        suppressContentEditableWarning
        className={[
          "booking-msg-composer",
          "booking-msg-editor",
          highlighted && "booking-msg-composer--highlight",
          isEmpty && "booking-msg-editor--empty",
        ]
          .filter(Boolean)
          .join(" ")}
        data-placeholder={hintPlaceholder}
        onInput={emitFromEditor}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = bookingTokenDragRef.el ? "move" : "copy";
        }}
        onDrop={(e) => {
          e.preventDefault();
          const el = editorRef.current;
          if (!el) return;
          const moving = bookingTokenDragRef.el;
          bookingTokenDragRef.el = null;
          if (moving?.parentNode) {
            dropBookingTokenAtPoint(el, e.clientX, e.clientY, { moveToken: moving, onAfterChange: emitFromEditor });
            return;
          }
          const droppedKind = bookingTokenKindFromValue(
            e.dataTransfer.getData("application/x-booking-token") || e.dataTransfer.getData("text/plain"),
          );
          if (droppedKind) {
            dropBookingTokenAtPoint(el, e.clientX, e.clientY, {
              createNew: true,
              tokenKind: droppedKind,
              onAfterChange: emitFromEditor,
            });
          }
        }}
        onClick={(e) => {
          const removeBtn = e.target.closest(".booking-msg-token-remove");
          const token = e.target.closest("[data-booking-token]");
          if (removeBtn && token) {
            e.preventDefault();
            token.remove();
            emitFromEditor();
          }
        }}
        onKeyDown={(e) => {
          if (!(e.key === "Enter" || e.key === " ")) return;
          const removeBtn = e.target.closest?.(".booking-msg-token-remove");
          if (!removeBtn) return;
          e.preventDefault();
          removeBtn.closest("[data-booking-token]")?.remove();
          emitFromEditor();
        }}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
          emitFromEditor();
        }}
      />
      <div className="booking-msg-token-palette">
        {tokenKinds.map((kind) => (
          <BookingMsgToken
            key={kind}
            kind={kind}
            className="booking-msg-token--palette"
            onPointerDown={(e) => onPalettePointerDown(kind, e)}
            onDragStart={(e) => onTokenDragStart(kind, e)}
            onClick={() => insertToken(kind)}
          />
        ))}
      </div>
    </div>
  );
}
