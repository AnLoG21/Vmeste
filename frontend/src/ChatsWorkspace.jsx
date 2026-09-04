import { Fragment } from "react";
import { createPortal } from "react-dom";
import ChatVideoNotePlayer from "./ChatVideoNotePlayer.jsx";
import {
  MessageReceiptIcon,
  chatMessagePlainText,
  formatLastSeenLabel,
  formatMessageDayDividerRu,
  formatMessageSenderLine,
  formatRuMatchCount,
  formatStaffFullName,
  getOrgDmPeerMember,
  messageCalendarDayKey,
  renderChatMessageBody,
} from "./chatHelpers.jsx";
import { formatRecordClock } from "./chatMedia.js";

const CHAT_WALL_OPTIONS = [
  { label: "Мята", value: "#dfe9e2" },
  { label: "Облака", value: "#e3edf8" },
  { label: "Песок", value: "#f3e8d8" },
  { label: "Ночь", value: "#1e2a24" },
  { label: "Море", value: "linear-gradient(160deg,#b8dfe9,#6aa6b8)" },
];

/**
 * Telegram-like chats UI (list, thread, compose, info/settings overlays).
 * Chat fetch/recording logic stays in App; this component only renders the portal tree.
 */
export default function ChatsWorkspace({
  addMembersToSelectedGroup,
  cancelChatRecording,
  chatAttachMenuOpen,
  chatCameraFacing,
  chatCameraSwitching,
  chatComposeMode,
  chatDragPinConvId,
  chatFabOpen,
  chatFileInputRef,
  chatFolder,
  chatInfoHeadMenuOpen,
  chatInfoOpen,
  chatInfoPeer,
  chatInfoPhotoMenuId,
  chatInfoTab,
  chatInput,
  chatLiveVideoRef,
  chatLoadingOlder,
  chatLocalPrefs,
  chatMediaGroups,
  chatMediaPreview,
  chatMembersView,
  chatMessages,
  chatMessagesElRef,
  chatMsgSearchActiveIdx,
  chatMsgSearchHits,
  chatMsgSearchInputRef,
  chatMsgSearchOpen,
  chatMsgSearchQuery,
  chatPeerPresenceLine,
  chatPendingFiles,
  chatPins,
  chatPreviewMediaRef,
  chatReceiptsMode,
  chatReceiptsSettingsOpen,
  chatRecordingKind,
  chatRecordLevels,
  chatRecordLiftHint,
  chatRecordLocked,
  chatRecordSecs,
  chatRowMenuId,
  chatSearchQuery,
  chatSettingsAvatar,
  chatSettingsForId,
  chatSettingsNotify,
  chatSettingsTitle,
  chatSettingsWallpaper,
  chatShowJumpBottom,
  chatStatus,
  clearChatVisualSettings,
  clientsFolderUnreadChatsCount,
  conversationAvatarLetter,
  conversations,
  createOrgGroup,
  currentView,
  customColorPickerOpen,
  deleteGroupChat,
  discardChatMediaPreview,
  displayConversationTitle,
  filteredSidebarChats,
  filteredVmenuChatContacts,
  groupAddStaffIds,
  groupAddStatus,
  groupForm,
  jumpToChatMessage,
  loadSellerData,
  me,
  memberDisplayName,
  memberInitial,
  onChatFilePicked,
  onComposeActionPointerDown,
  onComposeActionPointerMove,
  onComposeActionPointerUp,
  openChatAttachPicker,
  openChatPhotosLightbox,
  openVmenuUserChat,
  orgFolderUnreadChatsCount,
  orgStaff,
  persistChatReceiptsMode,
  persistChatVisualSettings,
  reorderPinnedChats,
  scrollChatToBottom,
  selectedChatId,
  selectedConv,
  sendChatMediaPreview,
  sendChatMessage,
  setChatAttachMenuOpen,
  setChatDragPinConvId,
  setChatFabOpen,
  setChatFolder,
  setChatInfoHeadMenuOpen,
  setChatInfoOpen,
  setChatInfoPhotoMenuId,
  setChatInfoTab,
  setChatInput,
  setChatMembersView,
  setChatMsgSearchActiveIdx,
  setChatMsgSearchOpen,
  setChatMsgSearchQuery,
  setChatPendingFiles,
  setChatPendingKind,
  setChatReceiptsSettingsOpen,
  setChatRowMenuId,
  setChatSearchQuery,
  setChatSettingsAvatar,
  setChatSettingsForId,
  setChatSettingsNotify,
  setChatSettingsTitle,
  setChatSettingsWallpaper,
  setCurrentView,
  setCustomColorPickerOpen,
  setGroupAddStaffIds,
  setGroupAddStatus,
  setGroupForm,
  setMenuOpen,
  setPendingInspectionId,
  setSelectedChatId,
  staffJobTitleForUser,
  stopChatRecording,
  switchChatCamera,
  tgAttachMenuRef,
  tgMainDark,
  tgMainStyle,
  tgMsgSearchWrapRef,
  toggleGroupAddStaff,
  toggleGroupStaff,
  togglePinChatForFolder,
  updateChatScrollUi,
}) {
  return (
          <section className={`card full-width tg-chats-card${currentView === "vmenu" ? " tg-chats-card--vmenu" : ""}`}>
            <div
              className={[
                "tg-body",
                currentView === "vmenu"
                  ? `tg-body--vmenu${selectedChatId ? " tg-body--mobile-thread" : " tg-body--mobile-list"}`
                  : selectedChatId
                    ? "tg-body--mobile-thread"
                    : "tg-body--mobile-list",
              ].join(" ")}
            >
              <aside className="tg-sidebar">
                <div className="tg-sidebar-head">
                  <span className="tg-sidebar-title">Чаты</span>
                  {me?.role === "provider" && currentView !== "vmenu" && (
                    <div className="tg-fab-wrap">
                      <button
                        type="button"
                        className="tg-fab"
                        aria-label="Новая группа"
                        title="Новая группа"
                        onClick={() => {
                          setChatFabOpen(true);
                          loadSellerData();
                        }}
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
                <input
                  type="search"
                  className="tg-chat-search"
                  placeholder={currentView === "vmenu" ? "Поиск по людям..." : "Поиск по чатам..."}
                  value={chatSearchQuery}
                  onChange={(e) => setChatSearchQuery(e.target.value)}
                  onFocus={() => setChatFabOpen(false)}
                />
                {currentView !== "vmenu" && (me?.role === "provider" || me?.role === "staff") && (
                <div className="tg-folder-tabs">
                  <button type="button" className={chatFolder === "org" ? "active" : ""} onClick={() => setChatFolder("org")}>
                    <span className="tg-folder-tab-label">Организация</span>
                    {orgFolderUnreadChatsCount > 0 && (
                      <span className="tg-folder-tab-badge">{orgFolderUnreadChatsCount > 99 ? "99+" : orgFolderUnreadChatsCount}</span>
                    )}
                  </button>
                  <button type="button" className={chatFolder === "clients" ? "active" : ""} onClick={() => setChatFolder("clients")}>
                    <span className="tg-folder-tab-label">Клиенты</span>
                    {clientsFolderUnreadChatsCount > 0 && (
                      <span className="tg-folder-tab-badge">{clientsFolderUnreadChatsCount > 99 ? "99+" : clientsFolderUnreadChatsCount}</span>
                    )}
                  </button>
                </div>
                )}
                <div className="tg-sidebar-scroll">
                {filteredSidebarChats.length > 0 && currentView === "vmenu" ? (
                  <div className="vmenu-chat-section-label">Переписки</div>
                ) : null}
                <div className="tg-chat-list">
                  {filteredSidebarChats.map((c) => {
                    const peerM = currentView === "vmenu"
                      ? (c.members || []).find((m) => Number(m.user) !== Number(me?.id))
                      : (chatFolder === "org" ? getOrgDmPeerMember(c, me?.id) : null);
                    const showPresenceDot = Boolean(peerM) && !c.is_group && !c.is_saved_messages && (
                      currentView === "vmenu" ? c.is_user_direct : !c.is_client_correspondence
                    );
                    const pinsList = (chatFolder === "clients" ? chatPins?.clients : chatPins?.org) || [];
                    const isPinned = currentView !== "vmenu" && pinsList.map(Number).includes(Number(c.id));
                    const unreadN = Number(c.unread_message_count) || 0;
                    return (
                    <div
                      key={c.id}
                      draggable={isPinned}
                      onDragStart={(e) => {
                        if (!isPinned) {
                          e.preventDefault();
                          return;
                        }
                        setChatDragPinConvId(c.id);
                        try {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", String(c.id));
                        } catch {
                          // ignore
                        }
                      }}
                      onDragEnd={() => setChatDragPinConvId(null)}
                      onDragOver={(e) => {
                        if (chatDragPinConvId != null && isPinned) e.preventDefault();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (chatDragPinConvId == null || !isPinned) return;
                        reorderPinnedChats(chatFolder, chatDragPinConvId, c.id);
                        setChatDragPinConvId(null);
                      }}
                      className={[
                        "tg-chat-item-row",
                        selectedChatId === c.id && "active",
                        c.is_saved_messages && "saved",
                        unreadN > 0 && "tg-chat-item-row--unread",
                        isPinned && "tg-chat-item-row--pinned",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <button
                        type="button"
                        className="tg-chat-item-main"
                        onClick={() => setSelectedChatId(c.id)}
                      >
                        <span className="tg-avatar-wrap">
                          <span className={`tg-avatar ${c.is_saved_messages ? "tg-avatar-saved" : ""}`}>
                            {chatLocalPrefs[c.id]?.avatarDataUrl ? (
                              <img src={chatLocalPrefs[c.id].avatarDataUrl} alt="" className="tg-avatar-img" />
                            ) : (
                              conversationAvatarLetter(c)
                            )}
                          </span>
                          {showPresenceDot && (
                            <span className={`tg-presence-dot ${peerM.is_online ? "tg-presence-dot--on" : "tg-presence-dot--off"}`} title={peerM.is_online ? "в сети" : "не в сети"} />
                          )}
                        </span>
                        <span className="tg-chat-item-text">
                          <span className="tg-chat-item-title">{displayConversationTitle(c)}</span>
                          <span className="tg-chat-item-sub">
                            {c.last_message?.text ? `${(c.last_message.text || "").slice(0, 42)}${(c.last_message.text || "").length > 42 ? "…" : ""}` : c.is_group ? "Группа" : c.is_saved_messages ? "Личный раздел" : "Нет сообщений"}
                          </span>
                        </span>
                      </button>
                      {unreadN > 0 && (
                        <span className="tg-chat-unread-badge" aria-label={`Непрочитано сообщений: ${unreadN}`}>
                          {unreadN > 99 ? "99+" : unreadN}
                        </span>
                      )}
                      {currentView !== "vmenu" && (
                      <div className="tg-chat-row-actions">
                        <button
                          type="button"
                          className={["tg-chat-row-icon-btn", isPinned && "tg-chat-row-icon-btn--on"].filter(Boolean).join(" ")}
                          aria-label={isPinned ? "Открепить" : "Закрепить"}
                          title={isPinned ? "Открепить" : "Закрепить (до 5)"}
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePinChatForFolder(c.id, chatFolder);
                          }}
                        >
                          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                            <path
                              fill="currentColor"
                              d="M16 12V4h-2V2h-4v2H8v8l-4 4v2h16v-2l-4-4zm-6 0V5h4v7h-4zm-2 9h8v2H8v-2z"
                            />
                          </svg>
                        </button>
                        <div className="tg-chat-row-menu-wrap">
                          <button
                            type="button"
                            className="tg-chat-row-icon-btn"
                            aria-label="Ещё"
                            title="Ещё"
                            aria-expanded={chatRowMenuId === c.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setChatRowMenuId((id) => (id === c.id ? null : c.id));
                            }}
                          >
                            <span className="tg-chat-row-dots" aria-hidden="true">
                              ⋯
                            </span>
                          </button>
                          {chatRowMenuId === c.id && (
                            <div className="tg-chat-row-dropdown" role="menu">
                              <button
                                type="button"
                                role="menuitem"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setChatRowMenuId(null);
                                  setChatSettingsForId(c.id);
                                }}
                              >
                                Настройки чата
                              </button>
                              {c.is_group &&
                              me?.role === "provider" &&
                              Number(c.organization) === Number(me?.id) ? (
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="tg-chat-info-danger"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void deleteGroupChat(c);
                                  }}
                                >
                                  Удалить группу
                                </button>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </div>
                      )}
                    </div>
                  );
                  })}
                </div>
                {currentView === "vmenu" && filteredVmenuChatContacts.length > 0 ? (
                  <>
                    <div className="vmenu-chat-section-label">Подписчики</div>
                    <div className="tg-chat-list vmenu-chat-contacts">
                      {filteredVmenuChatContacts.map((u) => {
                        const title = u.display_name || u.username || "Пользователь";
                        const letter = title.slice(0, 1).toUpperCase();
                        return (
                          <div key={u.id} className="tg-chat-item-row vmenu-chat-contact-row">
                            <button
                              type="button"
                              className="tg-chat-item-main"
                              disabled={u.can_message === false}
                              title={u.can_message === false ? "Пользователь ограничил сообщения" : undefined}
                              onClick={() => void openVmenuUserChat(u.id)}
                            >
                              <span className="tg-avatar-wrap">
                                <span className="tg-avatar">
                                  {u.avatar_url ? (
                                    <img src={u.avatar_url} alt="" className="tg-avatar-img" />
                                  ) : (
                                    letter
                                  )}
                                </span>
                              </span>
                              <span className="tg-chat-item-text">
                                <span className="tg-chat-item-title">{title}</span>
                                <span className="tg-chat-item-sub">Подписчик</span>
                              </span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : null}
                {currentView === "vmenu"
                  ? filteredSidebarChats.length === 0 && filteredVmenuChatContacts.length === 0 && (
                    <p className="tg-empty">Пока нет переписок. Напишите подписчику или откройте профиль пользователя.</p>
                  )
                  : filteredSidebarChats.length === 0 && (
                    <p className="tg-empty">{chatFolder === "clients" ? "Пока нет чатов с клиентами — они появятся здесь автоматически." : "Нет чатов в этой папке."}</p>
                  )}
                </div>
              </aside>
              <div className={`tg-main ${tgMainDark ? "tg-main--dark" : ""}`} style={tgMainStyle}>
                <div className="tg-main-head">
                  {selectedChatId ? (
                    <div className="tg-main-head-bar">
                      <div className="tg-main-head-left">
                        <button
                          type="button"
                          className="tg-chat-back-btn"
                          aria-label="К списку чатов"
                          title="Назад к списку"
                          onClick={() => setSelectedChatId(null)}
                        >
                          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                            <path
                              fill="currentColor"
                              d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"
                            />
                          </svg>
                        </button>
                      </div>
                      <button
                        type="button"
                        className="tg-main-head-peer"
                        onClick={() => setChatInfoOpen(true)}
                        title="Информация о чате"
                      >
                        <span className="tg-avatar tg-main-head-avatar">
                          {chatLocalPrefs[selectedChatId]?.avatarDataUrl ? (
                            <img src={chatLocalPrefs[selectedChatId].avatarDataUrl} alt="" className="tg-avatar-img" />
                          ) : (
                            (displayConversationTitle(conversations.find((c) => c.id === selectedChatId)) || "?")
                              .slice(0, 1)
                              .toUpperCase()
                          )}
                        </span>
                        <span className="tg-main-head-peer-text">
                          <span className="tg-main-title">
                            {displayConversationTitle(conversations.find((c) => c.id === selectedChatId))}
                          </span>
                          {chatPeerPresenceLine ? <span className="tg-main-head-presence">{chatPeerPresenceLine}</span> : null}
                        </span>
                      </button>
                      <div className="tg-main-head-right">
                        <div className="tg-msg-search-wrap" ref={tgMsgSearchWrapRef}>
                          <button
                            type="button"
                            className={["tg-head-icon-btn", chatMsgSearchOpen && "tg-head-icon-btn--on"].filter(Boolean).join(" ")}
                            aria-label="Поиск в чате"
                            aria-expanded={chatMsgSearchOpen}
                            title="Поиск по сообщениям"
                            onClick={() => {
                              if (chatMsgSearchOpen) {
                                setChatMsgSearchOpen(false);
                                setChatMsgSearchQuery("");
                                setChatMsgSearchActiveIdx(0);
                              } else {
                                setChatMsgSearchOpen(true);
                              }
                            }}
                          >
                            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                              <path
                                fill="currentColor"
                                d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
                              />
                            </svg>
                          </button>
                          {chatMsgSearchOpen && (
                            <div className="tg-msg-search-panel" role="search">
                              <input
                                ref={chatMsgSearchInputRef}
                                type="search"
                                className="tg-msg-search-field"
                                value={chatMsgSearchQuery}
                                onChange={(e) => {
                                  setChatMsgSearchQuery(e.target.value);
                                  setChatMsgSearchActiveIdx(0);
                                }}
                                onKeyDown={(e) => {
                                  const hits = chatMsgSearchHits;
                                  if (!hits.length) return;
                                  if (e.key === "ArrowDown") {
                                    e.preventDefault();
                                    setChatMsgSearchActiveIdx((i) => Math.min(hits.length - 1, i + 1));
                                  } else if (e.key === "ArrowUp") {
                                    e.preventDefault();
                                    setChatMsgSearchActiveIdx((i) => Math.max(0, i - 1));
                                  }
                                }}
                                placeholder="Поиск…"
                                aria-autocomplete="list"
                              />
                              <div className="tg-msg-search-count" aria-live="polite">
                                {chatMsgSearchQuery.trim()
                                  ? formatRuMatchCount(chatMsgSearchHits.length)
                                  : "Введите запрос"}
                              </div>
                              {chatMsgSearchQuery.trim() ? (
                                <ul className="tg-msg-search-hits tg-msg-search-hits--panel" role="listbox">
                                  {chatMsgSearchHits.map((m, i) => (
                                    <li key={m.id} role="option" aria-selected={i === chatMsgSearchActiveIdx}>
                                      <button
                                        type="button"
                                        className={["tg-msg-search-hit", i === chatMsgSearchActiveIdx && "tg-msg-search-hit--active"].filter(Boolean).join(" ")}
                                        onClick={() => setChatMsgSearchActiveIdx(i)}
                                      >
                                        <span className="tg-msg-search-hit-date">
                                          {new Date(m.created_at).toLocaleString("ru-RU", {
                                            day: "numeric",
                                            month: "long",
                                            year: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })}
                                        </span>
                                        <span className="tg-msg-search-hit-text">{chatMessagePlainText(m) || "—"}</span>
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                              <p className="tg-msg-search-keys-hint muted">В поле поиска: ↑ ↓ — к совпадениям в чате</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="tg-main-head-bar tg-main-head-bar--empty">
                      <div className="tg-main-head-center">
                        <span className="tg-main-title">Выбери чат</span>
                      </div>
                    </div>
                  )}
                </div>
                {selectedChatId ? (
                  <>
                    <div className="tg-messages-wrap">
                    <div
                      className="tg-messages"
                      ref={chatMessagesElRef}
                      onScroll={(e) => updateChatScrollUi(e.currentTarget)}
                    >
                      {chatLoadingOlder ? (
                        <div className="tg-messages-loading-older" aria-live="polite">
                          Загрузка…
                        </div>
                      ) : null}
                      {chatMessages.map((m, idx) => {
                        const prev = chatMessages[idx - 1];
                        const showDay =
                          !prev || messageCalendarDayKey(prev.created_at) !== messageCalendarDayKey(m.created_at);
                        return (
                          <Fragment key={m.id}>
                            {showDay && (
                              <div className="tg-msg-day-sep" role="separator">
                                <span className="tg-msg-day-chip">{formatMessageDayDividerRu(m.created_at)}</span>
                              </div>
                            )}
                            <div
                              id={`tg-msg-${m.id}`}
                              className={[
                                "tg-msg",
                                Number(m.sender) === Number(me?.id) && "tg-msg-own",
                                (m.kind === "voice" || m.kind === "video_note") && "tg-msg--media-bare",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            >
                              <div className="tg-msg-author">
                                {formatMessageSenderLine(m) || m.sender_username}
                              </div>
                              {renderChatMessageBody(m, {
                                onOpenPhotos: (items, index) => openChatPhotosLightbox(items, index),
                                onOpenInspection: (inspectionId) => {
                                  setPendingInspectionId(inspectionId ? Number(inspectionId) : null);
                                  setCurrentView("inspections");
                                  setMenuOpen(false);
                                },
                              })}
                              <div className="tg-msg-meta">
                                <div className="tg-msg-time">
                                  {new Date(m.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                                </div>
                                {Number(m.sender) === Number(me?.id) && m.viewed_by_peer != null && (
                                  <MessageReceiptIcon mode={chatReceiptsMode} viewed={Boolean(m.viewed_by_peer)} />
                                )}
                              </div>
                            </div>
                          </Fragment>
                        );
                      })}
                    </div>
                    {chatShowJumpBottom ? (
                      <button
                        type="button"
                        className="tg-jump-bottom-btn"
                        aria-label="К последним сообщениям"
                        title="Вниз"
                        onClick={() => scrollChatToBottom(true)}
                      >
                        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                          <path fill="currentColor" d="M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z" />
                        </svg>
                      </button>
                    ) : null}
                    </div>
                    {(chatRecordingKind === "video_note" || chatMediaPreview?.kind === "video_note") &&
                      typeof document !== "undefined" &&
                      createPortal(
                        <div
                          className={[
                            "tg-circle-stage",
                            "tg-circle-stage--overlay",
                            chatRecordingKind === "video_note" && "tg-circle-stage--live",
                            chatMediaPreview?.kind === "video_note" && "tg-circle-stage--preview",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          aria-live="polite"
                        >
                          {chatRecordingKind === "video_note" ? (
                            <>
                              <div className="tg-circle-live-wrap">
                                <video
                                  ref={chatLiveVideoRef}
                                  className={[
                                    "tg-circle-live-video",
                                    chatCameraFacing === "user" && "tg-circle-live-video--mirror",
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                  playsInline
                                  muted
                                  autoPlay
                                />
                                <span className="tg-circle-live-timer">{formatRecordClock(chatRecordSecs)}</span>
                              </div>
                              <div className="tg-circle-stage-actions">
                                <button
                                  type="button"
                                  className="tg-circle-stage-btn tg-circle-stage-btn--discard"
                                  aria-label="Отменить запись"
                                  title="Отменить"
                                  onClick={cancelChatRecording}
                                >
                                  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                                    <path
                                      fill="currentColor"
                                      d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                                    />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  className="tg-circle-stage-btn tg-circle-stage-btn--stop"
                                  aria-label="Остановить запись"
                                  title="Стоп"
                                  onClick={stopChatRecording}
                                >
                                  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                                    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  className="tg-circle-stage-btn tg-circle-stage-btn--flip"
                                  aria-label="Сменить камеру"
                                  title="Сменить камеру"
                                  disabled={chatCameraSwitching}
                                  onPointerDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    void switchChatCamera();
                                  }}
                                >
                                  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                                    <path
                                      fill="currentColor"
                                      d="M16 7h-1l-1-1h-4L9 7H8c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm-4 9c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"
                                    />
                                    <path
                                      fill="currentColor"
                                      d="M9.1 3.1 7.7 1.7 2 7.4l1.4 1.4 2.3-2.3V9h2V4.5L9.1 3.1zm12.5 12.1-1.4-1.4-2.3 2.3V15h-2v4.5l1.4 1.4 5.7-5.7z"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="tg-circle-preview-player">
                                <ChatVideoNotePlayer
                                  key={chatMediaPreview.url}
                                  src={chatMediaPreview.url}
                                  size={Math.min(280, typeof window !== "undefined" ? window.innerWidth * 0.72 : 280)}
                                  mirror={Boolean(chatMediaPreview.displayFlip)}
                                  previewMode
                                  durationSec={Number(chatMediaPreview.durationSec) || 0}
                                />
                              </div>
                              <div className="tg-circle-stage-actions">
                                <button
                                  type="button"
                                  className="tg-circle-stage-btn tg-circle-stage-btn--discard"
                                  aria-label="Удалить кружок"
                                  title="Удалить"
                                  onClick={discardChatMediaPreview}
                                >
                                  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                                    <path
                                      fill="currentColor"
                                      d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                                    />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  className="tg-circle-stage-btn tg-circle-stage-btn--send"
                                  aria-label="Отправить кружок"
                                  title="Отправить"
                                  onClick={sendChatMediaPreview}
                                >
                                  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                                    <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                                  </svg>
                                </button>
                              </div>
                            </>
                          )}
                        </div>,
                        document.body
                      )}
                    <form onSubmit={sendChatMessage} className="tg-compose">
                      <input
                        ref={chatFileInputRef}
                        type="file"
                        className="tg-file-input-hidden"
                        onChange={onChatFilePicked}
                        multiple
                        hidden
                      />
                      {chatMediaPreview && chatMediaPreview.kind !== "video_note" ? (
                        <div className="tg-media-preview tg-media-preview--compose">
                          <audio
                            key={chatMediaPreview.url}
                            ref={chatPreviewMediaRef}
                            src={chatMediaPreview.url}
                            controls
                            preload="auto"
                            autoPlay
                          />
                          <div className="tg-media-preview-actions">
                            <button type="button" className="ghost-btn" onClick={discardChatMediaPreview}>
                              Удалить
                            </button>
                            <button type="button" className="primary" onClick={sendChatMediaPreview}>
                              Отправить
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="tg-attach-wrap tg-attach-wrap--compose" ref={tgAttachMenuRef}>
                            <button
                              type="button"
                              className="tg-compose-icon-btn"
                              aria-label="Вложения"
                              title="Вложения"
                              disabled={Boolean(chatRecordingKind) || Boolean(chatMediaPreview)}
                              onClick={() => setChatAttachMenuOpen((v) => !v)}
                            >
                              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                                <path
                                  fill="currentColor"
                                  d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S5 2.79 5 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"
                                />
                              </svg>
                            </button>
                            {chatAttachMenuOpen && (
                              <div className="tg-attach-menu tg-attach-menu--up" role="menu">
                                <button type="button" className="tg-attach-menu-item" onClick={() => openChatAttachPicker("image")}>
                                  Фото
                                </button>
                                <button type="button" className="tg-attach-menu-item" onClick={() => openChatAttachPicker("video")}>
                                  Видео
                                </button>
                                <button type="button" className="tg-attach-menu-item" onClick={() => openChatAttachPicker("file")}>
                                  Файл
                                </button>
                                <button type="button" className="tg-attach-menu-item" onClick={() => openChatAttachPicker("music")}>
                                  Музыка
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="tg-compose-main">
                            {chatPendingFiles.length ? (
                              <div className="tg-compose-pending">
                                <span>
                                  {chatPendingFiles.length === 1
                                    ? chatPendingFiles[0].file.name
                                    : `${chatPendingFiles.length} файлов`}
                                </span>
                                <button
                                  type="button"
                                  className="tg-compose-pending-clear"
                                  onClick={() => {
                                    setChatPendingFiles([]);
                                    setChatPendingKind("");
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            ) : null}
                            {chatRecordingKind === "voice" ? (
                              <div className="tg-voice-live" aria-live="polite">
                                <span className="tg-voice-live-timer">{formatRecordClock(chatRecordSecs)}</span>
                                <div className="tg-voice-wave" aria-hidden>
                                  {chatRecordLevels.map((lvl, i) => (
                                    <span key={i} style={{ height: `${12 + lvl * 22}px` }} />
                                  ))}
                                </div>
                                {chatRecordLocked ? (
                                  <button type="button" className="tg-record-stop-btn tg-record-stop-btn--inline" onClick={stopChatRecording}>
                                    Стоп
                                  </button>
                                ) : null}
                              </div>
                            ) : chatRecordingKind === "video_note" ? (
                              <div className="tg-compose-circle-status muted">
                                Запись · {formatRecordClock(chatRecordSecs)}
                                {chatRecordLiftHint ? " · отпустите, чтобы закрепить" : ""}
                              </div>
                            ) : chatMediaPreview?.kind === "video_note" ? (
                              <div className="tg-compose-circle-status muted">Кружок готов к отправке</div>
                            ) : (
                              <input
                                className="tg-compose-input"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder="Сообщение..."
                                disabled={Boolean(chatRecordingKind)}
                              />
                            )}
                          </div>
                          {chatMediaPreview?.kind === "video_note" ? (
                            <button type="button" className="tg-send-btn" aria-label="Отправить кружок" title="Отправить" onClick={sendChatMediaPreview}>
                              <svg className="tg-send-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                                <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                              </svg>
                            </button>
                          ) : chatInput.trim() || chatPendingFiles.length ? (
                            <button type="submit" className="tg-send-btn" aria-label="Отправить сообщение" title="Отправить">
                              <svg className="tg-send-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                                <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                              </svg>
                            </button>
                          ) : chatRecordLocked ? (
                            <button type="button" className="tg-send-btn tg-record-btn tg-record-btn--active" onClick={stopChatRecording} title="Остановить">
                              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                                <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
                              </svg>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={[
                                "tg-send-btn",
                                "tg-record-btn",
                                chatComposeMode === "video_note" && "tg-record-btn--circle",
                                chatRecordingKind && "tg-record-btn--active",
                                chatRecordLiftHint && "tg-record-btn--lift",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              aria-label={
                                chatComposeMode === "video_note"
                                  ? "Кружок: короткий тап — голосовое, удержание — запись"
                                  : "Голосовое: короткий тап — кружок, удержание — запись"
                              }
                              title={
                                chatComposeMode === "video_note"
                                  ? "Кружок (тап — сменить режим)"
                                  : "Голосовое (тап — сменить режим)"
                              }
                              onPointerDown={onComposeActionPointerDown}
                              onPointerMove={onComposeActionPointerMove}
                              onPointerUp={onComposeActionPointerUp}
                              onPointerCancel={onComposeActionPointerUp}
                              onContextMenu={(e) => e.preventDefault()}
                            >
                              {chatComposeMode === "video_note" ? (
                                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                                  <path
                                    fill="currentColor"
                                    d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"
                                  />
                                </svg>
                              ) : (
                                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                                  <path
                                    fill="currentColor"
                                    d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
                                  />
                                </svg>
                              )}
                            </button>
                          )}
                        </>
                      )}
                    </form>
                  </>
                ) : (
                  <div className="tg-empty">Выбери чат слева.</div>
                )}
                {chatStatus ? <p className="tg-status">{chatStatus}</p> : null}
              </div>
            </div>
            {chatReceiptsSettingsOpen && (
              <div
                className="modal-backdrop"
                onClick={() => {
                  setChatReceiptsSettingsOpen(false);
                }}
              >
                <div className="modal-card tg-settings-card" onClick={(e) => e.stopPropagation()}>
                  <h3>Прочтение сообщений</h3>
                  <p className="muted">Как показывать, просмотрел ли собеседник твоё сообщение (только для твоих исходящих).</p>
                  <div className="form chat-receipts-settings">
                    <label className="checkbox">
                      <input
                        type="radio"
                        name="receipt-mode-chat"
                        checked={chatReceiptsMode === "stickers"}
                        onChange={() => persistChatReceiptsMode("stickers")}
                      />
                      Стикеры (обезьянки)
                    </label>
                    <label className="checkbox">
                      <input
                        type="radio"
                        name="receipt-mode-chat"
                        checked={chatReceiptsMode === "classic"}
                        onChange={() => persistChatReceiptsMode("classic")}
                      />
                      Стандарт
                    </label>
                    <div className="chat-receipts-preview">
                      <span className="muted small-label">Как будет в переписке</span>
                      <div className="chat-receipts-preview-bubbles">
                        <div className="chat-receipt-preview-msg tg-msg-own">
                          <div className="tg-msg-text">Пример</div>
                          <div className="tg-msg-meta">
                            <span className="tg-msg-time">12:00</span>
                            <MessageReceiptIcon mode={chatReceiptsMode} viewed={false} />
                          </div>
                        </div>
                        <div className="chat-receipt-preview-msg tg-msg-own">
                          <div className="tg-msg-text">Пример</div>
                          <div className="tg-msg-meta">
                            <span className="tg-msg-time">12:01</span>
                            <MessageReceiptIcon mode={chatReceiptsMode} viewed />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="tg-settings-actions">
                    <button type="button" className="primary" onClick={() => setChatReceiptsSettingsOpen(false)}>
                      Готово
                    </button>
                  </div>
                </div>
              </div>
            )}
            {chatSettingsForId != null && (
              <div
                className="modal-backdrop modal-backdrop--chat-settings"
                onClick={() => {
                  setChatSettingsForId(null);
                  setCustomColorPickerOpen(false);
                }}
              >
                <div className="modal-card tg-settings-card" onClick={(e) => e.stopPropagation()}>
                  <h3>Настройки чата</h3>
                  <p className="muted">Название в списке, аватар и фон чата. Хранится в браузере на этом устройстве.</p>
                  <label className="tg-settings-label">
                    Имя
                    <input value={chatSettingsTitle} onChange={(e) => setChatSettingsTitle(e.target.value)} />
                  </label>
                  <label className="tg-settings-label">
                    Аватар (картинка)
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => setChatSettingsAvatar(typeof reader.result === "string" ? reader.result : "");
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                  {chatSettingsAvatar && (
                    <div className="tg-settings-preview">
                      <img src={chatSettingsAvatar} alt="" />
                      <button type="button" className="ghost-btn" onClick={() => setChatSettingsAvatar("")}>
                        Убрать аватар
                      </button>
                    </div>
                  )}
                  <div className="tg-wall-label">Фон переписки</div>
                  <div className="tg-wall-grid">
                    {CHAT_WALL_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`tg-wall-swatch ${chatSettingsWallpaper === opt.value ? "active" : ""}`}
                        style={{ background: opt.value }}
                        title={opt.label}
                        onClick={() => {
                          setChatSettingsWallpaper(opt.value);
                          setCustomColorPickerOpen(false);
                        }}
                      />
                    ))}
                  </div>
                  <div className="tg-wall-label">Свой цвет</div>
                  <div className="tg-color-row">
                    <button
                      type="button"
                      className="ghost-btn tg-color-picker-toggle"
                      onClick={() => setCustomColorPickerOpen((v) => !v)}
                    >
                      {customColorPickerOpen ? "Закрыть палитру" : "Открыть палитру"}
                    </button>
                    {customColorPickerOpen && (
                      <div className="tg-color-popover">
                        <input
                          type="color"
                          value={
                            chatSettingsWallpaper && chatSettingsWallpaper.startsWith("#") && chatSettingsWallpaper.length >= 4
                              ? chatSettingsWallpaper.slice(0, 7)
                              : "#dfe9e2"
                          }
                          onChange={(e) => setChatSettingsWallpaper(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                  <div className="tg-wall-label">Уведомления</div>
                  <select value={chatSettingsNotify} onChange={(e) => setChatSettingsNotify(e.target.value)} className="tg-notify-select">
                    <option value="all">Включены</option>
                    <option value="off">Заглушить</option>
                    <option value="1h">Заглушить на 1 час</option>
                    <option value="2h">Заглушить на 2 часа</option>
                    <option value="8h">Заглушить на 8 часов</option>
                  </select>
                  <div className="tg-settings-actions">
                    <button type="button" className="primary" onClick={persistChatVisualSettings}>
                      Сохранить
                    </button>
                    <button type="button" className="ghost-btn" onClick={clearChatVisualSettings}>
                      Сбросить оформление
                    </button>
                    <button type="button" className="ghost-btn" onClick={() => setChatSettingsForId(null)}>
                      Закрыть
                    </button>
                  </div>
                  <button
                    type="button"
                    className="ghost-btn"
                    style={{ marginTop: 8 }}
                    onClick={() => {
                      setChatSettingsForId(null);
                      setChatReceiptsSettingsOpen(true);
                    }}
                  >
                    Прочтение сообщений…
                  </button>
                </div>
              </div>
            )}
            {chatFabOpen && me?.role === "provider" && (
              <div
                className="modal-backdrop"
                onClick={() => {
                  setChatFabOpen(false);
                  setGroupForm({ title: "", staff_ids: [] });
                }}
              >
                <div className="modal-card tg-group-create-card" onClick={(e) => e.stopPropagation()}>
                  <div className="tg-group-create-head">
                    <h3>Новая группа</h3>
                    <button
                      type="button"
                      className="tg-chat-info-close"
                      aria-label="Закрыть"
                      onClick={() => {
                        setChatFabOpen(false);
                        setGroupForm({ title: "", staff_ids: [] });
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <form onSubmit={createOrgGroup} className="form">
                    <p className="muted">Можно не отмечать сотрудников — группа только для тебя. Или добавь участников.</p>
                    <input
                      placeholder="Название группы"
                      value={groupForm.title}
                      onChange={(e) => setGroupForm({ ...groupForm, title: e.target.value })}
                      required
                      autoFocus
                    />
                    <div className="tg-group-create-staff-label">Участники</div>
                    <div className="staff-pick-grid staff-pick-grid--people staff-pick-grid--modal">
                      {orgStaff
                        .filter(
                          (l) =>
                            l.is_active &&
                            l.invitation_status !== "pending" &&
                            l.invitation_status !== "rejected"
                        )
                        .map((link) => {
                          const name = formatStaffFullName(link.staff_user) || `id ${link.staff}`;
                          const title = (link.job_title || "").trim();
                          return (
                            <label key={link.id} className="staff-pick-person">
                              <input
                                type="checkbox"
                                checked={groupForm.staff_ids.includes(link.staff)}
                                onChange={() => toggleGroupStaff(link.staff)}
                              />
                              <span className="tg-avatar staff-pick-avatar" aria-hidden="true">
                                {name.slice(0, 1).toUpperCase()}
                              </span>
                              <span className="staff-pick-meta">
                                <span className="staff-pick-name">{name}</span>
                                {title ? <span className="staff-pick-job muted">{title}</span> : null}
                              </span>
                            </label>
                          );
                        })}
                    </div>
                    {!orgStaff.filter(
                      (l) =>
                        l.is_active &&
                        l.invitation_status !== "pending" &&
                        l.invitation_status !== "rejected"
                    ).length && (
                      <p className="muted">Пока нет сотрудников — пригласи их в разделе «Сотрудники».</p>
                    )}
                    <div className="tg-group-create-actions">
                      <button type="button" className="ghost-btn" onClick={() => {
                        setChatFabOpen(false);
                        setGroupForm({ title: "", staff_ids: [] });
                      }}>
                        Отмена
                      </button>
                      <button type="submit">Создать группу</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
            {chatInfoOpen && selectedChatId && (
              <div
                className="modal-backdrop"
                onClick={() => {
                  setChatInfoOpen(false);
                  setChatInfoHeadMenuOpen(false);
                  setChatInfoPhotoMenuId(null);
                  setChatMembersView(null);
                  setGroupAddStaffIds([]);
                  setGroupAddStatus("");
                }}
              >
                <div className="modal-card tg-chat-info-card" onClick={(e) => e.stopPropagation()}>
                  <div className="tg-chat-info-head">
                    <span className="tg-avatar tg-chat-info-avatar">
                      {chatLocalPrefs[selectedChatId]?.avatarDataUrl ? (
                        <img src={chatLocalPrefs[selectedChatId].avatarDataUrl} alt="" className="tg-avatar-img" />
                      ) : (
                        (displayConversationTitle(selectedConv) || "?").slice(0, 1).toUpperCase()
                      )}
                    </span>
                    <div className="tg-chat-info-titles">
                      <h3>{displayConversationTitle(selectedConv)}</h3>
                      <p className="muted small">
                        {chatPeerPresenceLine ||
                          (chatInfoPeer?.is_online
                            ? "в сети"
                            : chatInfoPeer?.last_seen_at
                              ? formatLastSeenLabel(chatInfoPeer.last_seen_at)
                              : "—")}
                      </p>
                    </div>
                    <div className="tg-chat-info-head-actions">
                      <div className="tg-chat-info-menu-wrap">
                        <button
                          type="button"
                          className="tg-chat-info-icon-btn"
                          aria-label="Ещё"
                          aria-expanded={chatInfoHeadMenuOpen}
                          onClick={() => {
                            setChatInfoPhotoMenuId(null);
                            setChatInfoHeadMenuOpen((v) => !v);
                          }}
                        >
                          ⋮
                        </button>
                        {chatInfoHeadMenuOpen && (
                          <div className="tg-chat-info-dropdown" role="menu">
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setChatInfoHeadMenuOpen(false);
                                setChatInfoOpen(false);
                                setChatSettingsForId(selectedChatId);
                              }}
                            >
                              Настройки чата
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setChatInfoHeadMenuOpen(false);
                                setChatInfoOpen(false);
                                setChatReceiptsSettingsOpen(true);
                              }}
                            >
                              Прочтение сообщений
                            </button>
                            {selectedConv?.is_group &&
                            me?.role === "provider" &&
                            Number(selectedConv.organization) === Number(me?.id) ? (
                              <button
                                type="button"
                                role="menuitem"
                                className="tg-chat-info-danger"
                                onClick={() => {
                                  void deleteGroupChat(selectedConv);
                                }}
                              >
                                Удалить группу
                              </button>
                            ) : null}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        className="tg-chat-info-close"
                        aria-label="Закрыть"
                        onClick={() => {
                          setChatInfoOpen(false);
                          setChatInfoHeadMenuOpen(false);
                          setChatInfoPhotoMenuId(null);
                          setChatMembersView(null);
                          setGroupAddStaffIds([]);
                          setGroupAddStatus("");
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  {chatInfoPeer ? (
                    <div className="tg-chat-info-meta">
                      {(chatInfoPeer.first_name || chatInfoPeer.last_name) && (
                        <p>
                          {[chatInfoPeer.last_name, chatInfoPeer.first_name, chatInfoPeer.patronymic]
                            .filter(Boolean)
                            .join(" ")}
                        </p>
                      )}
                      {chatInfoPeer.organization_name ? <p>Организация: {chatInfoPeer.organization_name}</p> : null}
                      {chatInfoPeer.username ? <p className="muted">@{chatInfoPeer.username}</p> : null}
                    </div>
                  ) : null}
                  {selectedConv?.is_group ? (
                    <div className="tg-chat-info-members-bar">
                      <button
                        type="button"
                        className={["tg-chat-members-count", chatMembersView === "list" && "active"].filter(Boolean).join(" ")}
                        onClick={() => setChatMembersView((v) => (v === "list" ? null : "list"))}
                      >
                        <span className="tg-chat-members-count-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                          </svg>
                        </span>
                        <span>{(selectedConv.members || []).length} участников</span>
                      </button>
                      {me?.role === "provider" && Number(selectedConv.organization) === Number(me?.id) ? (
                        <button
                          type="button"
                          className={["tg-chat-members-add", chatMembersView === "add" && "active"].filter(Boolean).join(" ")}
                          aria-label="Добавить участников"
                          title="Добавить участников"
                          onClick={() => {
                            setGroupAddStatus("");
                            setGroupAddStaffIds([]);
                            setChatMembersView((v) => (v === "add" ? null : "add"));
                          }}
                        >
                          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                            <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                          </svg>
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {selectedConv?.is_group && chatMembersView === "list" ? (
                    <ul className="tg-chat-members-list">
                      {(selectedConv.members || []).map((m) => {
                        const job = staffJobTitleForUser(m.user);
                        return (
                          <li key={m.id || m.user} className="tg-chat-members-row">
                            <span className="tg-avatar tg-chat-members-avatar" aria-hidden="true">
                              {memberInitial(m)}
                            </span>
                            <span className="tg-chat-members-meta">
                              <span className="tg-chat-members-name">{memberDisplayName(m)}</span>
                              {job ? <span className="muted small">{job}</span> : null}
                              {m.role === "provider" ? <span className="muted small">Руководитель</span> : null}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                  {selectedConv?.is_group && chatMembersView === "add" ? (
                    <div className="tg-chat-members-add-panel">
                      <p className="muted small">Сотрудники, которых ещё нет в группе</p>
                      <div className="staff-pick-grid staff-pick-grid--people">
                        {orgStaff
                          .filter((l) => l.is_active && l.invitation_status !== "pending" && l.invitation_status !== "rejected")
                          .filter((l) => !(selectedConv.members || []).some((m) => Number(m.user) === Number(l.staff)))
                          .map((link) => {
                            const name = formatStaffFullName(link.staff_user) || `id ${link.staff}`;
                            const title = (link.job_title || "").trim();
                            return (
                              <label key={link.id} className="staff-pick-person">
                                <input
                                  type="checkbox"
                                  checked={groupAddStaffIds.includes(link.staff)}
                                  onChange={() => toggleGroupAddStaff(link.staff)}
                                />
                                <span className="tg-avatar staff-pick-avatar" aria-hidden="true">
                                  {name.slice(0, 1).toUpperCase()}
                                </span>
                                <span className="staff-pick-meta">
                                  <span className="staff-pick-name">{name}</span>
                                  {title ? <span className="staff-pick-job muted">{title}</span> : null}
                                </span>
                              </label>
                            );
                          })}
                      </div>
                      {!orgStaff.filter(
                        (l) =>
                          l.is_active &&
                          l.invitation_status !== "pending" &&
                          l.invitation_status !== "rejected" &&
                          !(selectedConv.members || []).some((m) => Number(m.user) === Number(l.staff))
                      ).length && <p className="muted">Все сотрудники уже в группе</p>}
                      {groupAddStatus ? <p className="status">{groupAddStatus}</p> : null}
                      <button type="button" disabled={!groupAddStaffIds.length} onClick={addMembersToSelectedGroup}>
                        Добавить
                      </button>
                    </div>
                  ) : null}
                  <div className="tg-chat-info-tabs">
                    {[
                      ["photos", "Фото"],
                      ["videos", "Видео"],
                      ["files", "Файлы"],
                      ["links", "Ссылки"],
                      ["music", "Музыка"],
                      ["voice", "Голосовые"],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        className={chatInfoTab === key ? "active" : ""}
                        onClick={() => setChatInfoTab(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="tg-chat-info-body">
                    {chatInfoTab === "photos" &&
                      (chatMediaGroups.photos.length ? (
                        <div className="tg-chat-info-grid">
                          {chatMediaGroups.photos.map((m) => (
                            <div key={m.id} className="tg-chat-info-thumb-wrap">
                              <button
                                type="button"
                                className="tg-chat-info-thumb"
                                onClick={() => {
                                  setChatInfoPhotoMenuId(null);
                                  openChatPhotosLightbox(
                                    chatMediaGroups.photos.map((x) => ({ id: x.id, url: x.url, source: "chat" })),
                                    chatMediaGroups.photos.findIndex((x) => x.id === m.id)
                                  );
                                }}
                              >
                                <img src={m.thumb_url || m.url} alt="" loading="lazy" decoding="async" />
                              </button>
                              <div className="tg-chat-info-thumb-more">
                                <button
                                  type="button"
                                  className="tg-chat-info-thumb-dots"
                                  aria-label="Действия"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setChatInfoHeadMenuOpen(false);
                                    setChatInfoPhotoMenuId((id) => (id === m.id ? null : m.id));
                                  }}
                                >
                                  ⋮
                                </button>
                                {chatInfoPhotoMenuId === m.id && (
                                  <div className="tg-chat-info-dropdown tg-chat-info-dropdown--thumb" role="menu">
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        setChatInfoPhotoMenuId(null);
                                        jumpToChatMessage(m.id);
                                      }}
                                    >
                                      К сообщению
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="muted">Пока нет фото</p>
                      ))}
                    {chatInfoTab === "videos" &&
                      (chatMediaGroups.videos.length ? (
                        <ul className="tg-chat-info-list">
                          {chatMediaGroups.videos.map((m) => (
                            <li key={m.id} className="tg-chat-info-row">
                              <video src={m.url} controls preload="metadata" />
                              <button type="button" className="ghost-btn small-btn" onClick={() => jumpToChatMessage(m.id)}>
                                К сообщению
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">Пока нет видео</p>
                      ))}
                    {chatInfoTab === "files" &&
                      (chatMediaGroups.files.length ? (
                        <ul className="tg-chat-info-list">
                          {chatMediaGroups.files.map((m) => (
                            <li key={m.id} className="tg-chat-info-row">
                              <a href={m.url} target="_blank" rel="noreferrer">
                                {m.name || "Файл"}
                              </a>
                              <button type="button" className="ghost-btn small-btn" onClick={() => jumpToChatMessage(m.id)}>
                                К сообщению
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">Пока нет файлов</p>
                      ))}
                    {chatInfoTab === "links" &&
                      (chatMediaGroups.links.length ? (
                        <ul className="tg-chat-info-list">
                          {chatMediaGroups.links.map((m) => (
                            <li key={m.id} className="tg-chat-info-row">
                              <a href={(m.text || "").match(/https?:\/\/\S+/)?.[0] || "#"} target="_blank" rel="noreferrer">
                                {m.text}
                              </a>
                              <button type="button" className="ghost-btn small-btn" onClick={() => jumpToChatMessage(m.id)}>
                                К сообщению
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">Пока нет ссылок</p>
                      ))}
                    {chatInfoTab === "music" &&
                      (chatMediaGroups.music.length ? (
                        <ul className="tg-chat-info-list">
                          {chatMediaGroups.music.map((m) => (
                            <li key={m.id} className="tg-chat-info-row">
                              <div>{m.name}</div>
                              <audio src={m.url} controls preload="metadata" />
                              <button type="button" className="ghost-btn small-btn" onClick={() => jumpToChatMessage(m.id)}>
                                К сообщению
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">Пока нет музыки</p>
                      ))}
                    {chatInfoTab === "voice" &&
                      (chatMediaGroups.voice.length ? (
                        <ul className="tg-chat-info-list">
                          {chatMediaGroups.voice.map((m) => (
                            <li key={m.id} className="tg-chat-info-row">
                              <audio src={m.url} controls preload="metadata" />
                              <button type="button" className="ghost-btn small-btn" onClick={() => jumpToChatMessage(m.id)}>
                                К сообщению
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">Пока нет голосовых</p>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </section>
  );
}
