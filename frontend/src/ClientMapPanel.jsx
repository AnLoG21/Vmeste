import ServicePhotoCarousel from "./ServicePhotoCarousel.jsx";
import { ReviewListItem } from "./ProviderReviewsPanel.jsx";
import { MapOrgContactsBlock, MapOrgHoursBlock } from "./mapOrgBlocks.jsx";
import { formatStaffFullName, reviewImageUrl } from "./chatHelpers.jsx";
import { ReviewTextContent } from "./bookingDisplay.jsx";
import { todayIsoDate } from "./bookingCalendarUtils.jsx";
import { buildOrgCarouselItems } from "./clientOrgFeatures.js";

/** Карта услуг: Яндекс-карта (контейнер) и карточка организации. */
export default function ClientMapPanel({
  allLocations,
  mapOrgPopup,
  mapOrgSheetCollapsed,
  mapOrgReviewsOpen,
  clientBookModalOpen,
  clientFiltersOpen,
  mapOrgSheetTouchY,
  expandMapOrgSheet,
  collapseMapOrgSheet,
  closeMapOrgSheet,
  mapOrgProfile,
  mapOrgSummary,
  sphereOptions,
  mapOrgCarouselTouchX,
  openOrgPhotoLightbox,
  mapOrgCarouselIndex,
  setMapOrgCarouselIndex,
  mapOrgPackages,
  authFetch,
  API_URL,
  showToast,
  clientDiscoverFiltersRef,
  onClientLocationSelect,
  setClientBookModalOpen,
  openChatWithProvider,
  mapOrgStaff,
  setStaffReviewModal,
  loadMapOrgReviews,
  mapOrgReviewsOrdering,
  staffReviewModal,
  mapOrgReviews,
  setMapOrgReviewsOrdering,
  accessToken,
  me,
  reviewReplyOpenId,
  reviewReplyForms,
  reviewReplyFormError,
  setReviewReplyOpenId,
  setReviewReplyForms,
  setReviewReplyFormError,
  toggleReviewLike,
  submitReviewReply,
  openReviewPhotoLightbox,
}) {
  return (
    <section className="card full-width client-discover-card">
      <div className="client-discover-top">
        <h2 className="client-discover-title" id="client-map-title">
          Карта услуг
        </h2>
        <p className="muted client-discover-meta">Найдено точек: {allLocations.length}</p>
      </div>
      <div
        className={[
          "client-discover-map-wrap",
          mapOrgPopup && "client-discover-map-wrap--has-sheet",
          mapOrgPopup && mapOrgSheetCollapsed && "client-discover-map-wrap--sheet-collapsed",
          mapOrgReviewsOpen && !mapOrgSheetCollapsed && "client-discover-map-wrap--org-reviews",
          (clientBookModalOpen || clientFiltersOpen) && "client-discover-map-wrap--blocked",
          (clientBookModalOpen || clientFiltersOpen) && "client-discover-map-wrap--sheet-inert",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div id="client-discover-map" className="client-discover-map" role="application" aria-label="Карта точек записи" />
        {mapOrgPopup && (
          <div
            className={[
              "map-org-sheet",
              mapOrgReviewsOpen && !mapOrgSheetCollapsed && "map-org-sheet--reviews-open",
              mapOrgSheetCollapsed && "map-org-sheet--collapsed",
            ]
              .filter(Boolean)
              .join(" ")}
            role="dialog"
            aria-label="Организация на карте"
          >
            <button
              type="button"
              className="map-org-sheet-handle"
              aria-label={mapOrgSheetCollapsed ? "Развернуть карточку" : "Свернуть карточку"}
              onClick={(e) => {
                e.stopPropagation();
                if (mapOrgSheetCollapsed) expandMapOrgSheet();
                else collapseMapOrgSheet();
              }}
              onTouchStart={(e) => {
                mapOrgSheetTouchY.current = e.touches?.[0]?.clientY ?? 0;
              }}
              onTouchEnd={(e) => {
                const startY = mapOrgSheetTouchY.current;
                mapOrgSheetTouchY.current = null;
                if (startY == null) return;
                const endY = e.changedTouches?.[0]?.clientY ?? startY;
                const dy = endY - startY;
                if (dy > 56) {
                  if (mapOrgSheetCollapsed) closeMapOrgSheet();
                  else collapseMapOrgSheet();
                } else if (dy < -56 && mapOrgSheetCollapsed) {
                  expandMapOrgSheet();
                }
              }}
            >
              <span className="map-org-sheet-handle-bar" aria-hidden />
            </button>
            {mapOrgSheetCollapsed ? (
              <button
                type="button"
                className="map-org-sheet-peek"
                onClick={() => expandMapOrgSheet()}
              >
                <span className="map-org-sheet-peek-title">
                  {mapOrgPopup.organization_name || mapOrgPopup.title}
                </span>
                <span className="muted small">Нажмите, чтобы открыть</span>
              </button>
            ) : (
            <div className="map-org-sheet-body">
            <div className="map-org-sheet-header">
              <button
                type="button"
                className="map-org-sheet-close"
                aria-label="Закрыть"
                onClick={closeMapOrgSheet}
              >
                ×
              </button>
              {(() => {
                const sphereKey = mapOrgPopup.provider_sphere || mapOrgProfile?.provider_sphere;
                const sphereLabel =
                  mapOrgPopup.sphere_label ||
                  mapOrgProfile?.sphere_label ||
                  sphereOptions.find((o) => o.key === sphereKey)?.value ||
                  "";
                return sphereLabel ? (
                  <p className="map-org-sheet-sphere">{sphereLabel}</p>
                ) : null;
              })()}
              <h3 className="map-org-sheet-title">
                {mapOrgPopup.organization_name || mapOrgPopup.title}
              </h3>
              {(mapOrgProfile?.average_rating != null || mapOrgSummary?.average_rating != null) && (
                <p className="map-org-sheet-rating">
                  ★ {Number(mapOrgProfile?.average_rating ?? mapOrgSummary?.average_rating).toFixed(2)}
                  {" "}
                  ({mapOrgProfile?.reviews_count ?? mapOrgSummary?.reviews_count ?? 0} отзывов)
                </p>
              )}
              <p className="muted small map-org-platform-note">
                Услуги оказывает организация. Платформа «Вместе» предоставляет инструмент записи и не
                несёт ответственность за качество и лицензии.
              </p>
            </div>

            {buildOrgCarouselItems(mapOrgProfile).length > 0 && (
              <div className="map-org-carousel">
                <button
                  type="button"
                  className="map-org-carousel-main"
                  onClick={() => {
                    if (Math.abs(mapOrgCarouselTouchX.current?.delta || 0) > 28) return;
                    const items = buildOrgCarouselItems(mapOrgProfile);
                    openOrgPhotoLightbox(items, mapOrgCarouselIndex);
                  }}
                  onTouchStart={(e) => {
                    mapOrgCarouselTouchX.current = {
                      x: e.changedTouches?.[0]?.clientX ?? 0,
                      delta: 0,
                    };
                  }}
                  onTouchMove={(e) => {
                    const start = mapOrgCarouselTouchX.current;
                    if (!start) return;
                    const x = e.changedTouches?.[0]?.clientX ?? start.x;
                    start.delta = x - start.x;
                  }}
                  onTouchEnd={() => {
                    const start = mapOrgCarouselTouchX.current;
                    const items = buildOrgCarouselItems(mapOrgProfile);
                    const n = items.length;
                    if (!start || n < 2) {
                      mapOrgCarouselTouchX.current = null;
                      return;
                    }
                    const dx = start.delta || 0;
                    if (Math.abs(dx) > 40) {
                      setMapOrgCarouselIndex((idx) =>
                        dx < 0 ? (idx + 1) % n : (idx - 1 + n) % n,
                      );
                    }
                    window.setTimeout(() => {
                      mapOrgCarouselTouchX.current = null;
                    }, 0);
                  }}
                >
                  <img
                    src={buildOrgCarouselItems(mapOrgProfile)[mapOrgCarouselIndex]?.thumb_url
                      || buildOrgCarouselItems(mapOrgProfile)[mapOrgCarouselIndex]?.url}
                    alt=""
                    draggable={false}
                    loading="lazy"
                    decoding="async"
                  />
                </button>
                {buildOrgCarouselItems(mapOrgProfile).length > 1 && (
                  <div className="map-org-carousel-thumbs">
                    {buildOrgCarouselItems(mapOrgProfile).map((ph, idx) => (
                      <button
                        key={ph.id}
                        type="button"
                        className={["map-org-carousel-thumb", idx === mapOrgCarouselIndex && "map-org-carousel-thumb--active"].filter(Boolean).join(" ")}
                        onClick={() => setMapOrgCarouselIndex(idx)}
                      >
                        <img src={ph.thumb_url || ph.url} alt="" loading="lazy" decoding="async" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(mapOrgProfile?.phones?.length > 0 || mapOrgProfile?.websites?.length > 0) && (
              <MapOrgContactsBlock phones={mapOrgProfile.phones} websites={mapOrgProfile.websites} />
            )}

            {mapOrgProfile?.card_note ? (

              <p className="map-org-card-note">{mapOrgProfile.card_note}</p>

            ) : null}

            {mapOrgProfile?.working_hours ? (
              <MapOrgHoursBlock workingHours={mapOrgProfile.working_hours} />
            ) : null}

            {mapOrgPopup.address && <p className="muted small">{mapOrgPopup.address}</p>}

            {mapOrgPackages.length > 0 ? (
              <div className="loyalty-packages-scroll map-org-packages">
                {mapOrgPackages.map((p) => (
                  <article key={p.id} className="loyalty-package-card">
                    {p.cover_image_url ? (
                      <img src={p.cover_image_url} alt="" className="loyalty-package-cover" />
                    ) : (
                      <div className="loyalty-package-cover loyalty-package-cover--empty" />
                    )}
                    <strong>{p.name}</strong>
                    <p className="muted small">
                      {p.visits_count} виз. · {Number(p.price).toLocaleString("ru-RU")} ₽
                      {p.validity_days ? ` · ${p.validity_days} дн.` : ""}
                    </p>
                    {p.description ? <p className="small">{p.description}</p> : null}
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await authFetch(`${API_URL}/booking/packages/${p.id}/purchase/`, {
                          method: "POST",
                          body: "{}",
                        });
                        const data = await res.json().catch(() => ({}));
                        showToast(
                          res.ok
                            ? "Абонемент оформлен — детали в разделе «Лояльность»."
                            : data.detail || "Не удалось купить абонемент.",
                        );
                      }}
                    >
                      Купить
                    </button>
                  </article>
                ))}
              </div>
            ) : null}

            <div className="map-org-sheet-actions row-2">
              {mapOrgPopup.provider_sphere === "cafe_restaurant" || mapOrgProfile?.is_cafe ? (
                <button
                  type="button"
                  onClick={() => {
                    const slug = mapOrgProfile?.organization_slug;
                    if (slug) window.location.href = `/m/${slug}`;
                    else showToast("Сохраните профиль организации — появится ссылка меню.");
                  }}
                >
                  Заказать
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const filterDate = clientDiscoverFiltersRef.current?.slot_date || todayIsoDate();
                    onClientLocationSelect(String(mapOrgPopup.id), filterDate);
                    setClientBookModalOpen(true);
                  }}
                >
                  Записаться
                </button>
              )}
              <button type="button" onClick={() => openChatWithProvider(mapOrgPopup.provider)}>
                Чат
              </button>
            </div>

            {mapOrgStaff?.length > 0 && (
              <div className="map-org-staff-section">
                <div className="map-org-staff-head">
                  <p className="field-label" style={{ margin: 0 }}>
                    Сотрудники
                  </p>
                </div>
                <div className="map-org-staff-cards">
                  {mapOrgStaff.slice(0, 3).map((st) => {
                    const staffName = formatStaffFullName(st.staff_user) || st.display_name || "Сотрудник";
                    const avatarUrl = st.avatar_thumb_url || (st.avatar_image ? reviewImageUrl(st.avatar_image) : "");
                    const portfolioItems = (st.portfolio_photos || []).map((p) => ({
                      id: p.id,
                      image: p.image,
                      source: "portfolio",
                    }));
                    const reviewsCount = Number(st.reviews_count) || 0;
                    const avgRating =
                      st.average_rating != null && Number.isFinite(Number(st.average_rating))
                        ? Number(st.average_rating).toFixed(2).replace(".", ",")
                        : null;
                    return (
                      <div key={st.id} className="map-org-staff-card">
                        <div className="map-org-staff-card-head">
                          {avatarUrl ? (
                            <img src={avatarUrl} alt="" className="map-org-staff-avatar" />
                          ) : (
                            <div className="map-org-staff-avatar map-org-staff-avatar--ph" aria-hidden>
                              {String(staffName || "?").slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div className="map-org-staff-card-meta">
                            <div className="map-org-staff-card-name-row">
                              <p className="map-org-staff-card-name">{staffName}</p>
                              {avgRating ? (
                                <span className="map-org-staff-card-rating" title="Рейтинг сотрудника">
                                  {avgRating} <span aria-hidden>★</span>
                                </span>
                              ) : null}
                            </div>
                            {st.job_title ? <p className="muted small">{st.job_title}</p> : null}
                          </div>
                        </div>
                        {st.bio ? <p className="map-org-staff-card-bio">{st.bio}</p> : null}
                        {portfolioItems.length > 0 && (
                          <ServicePhotoCarousel
                            items={portfolioItems}
                            className="map-org-staff-portfolio"
                            onOpen={(items, index) => openOrgPhotoLightbox(items, index)}
                          />
                        )}
                        <div className="map-org-staff-card-actions">
                          <button
                            type="button"
                            className="ghost-btn small map-org-staff-reviews-btn"
                            onClick={() => {
                              setStaffReviewModal({
                                providerId: mapOrgPopup.provider,
                                staffLinkId: st.id,
                                staffUserId: st.staff,
                                staffName,
                                reviewsCount,
                                averageRating: avgRating,
                              });
                              void loadMapOrgReviews(
                                mapOrgPopup.provider,
                                mapOrgReviewsOrdering,
                                st.id,
                              );
                            }}
                          >
                            Отзывы{reviewsCount > 0 ? ` +${reviewsCount}` : ""}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {mapOrgStaff.length > 3 && (
                  <p className="muted small">Ещё {mapOrgStaff.length - 3} сотрудника(ов)</p>
                )}
              </div>
            )}

            {staffReviewModal && (
              <div
                className="modal-backdrop"
                onClick={() => {
                  setStaffReviewModal(null);
                }}
              >
                <div className="modal-card staff-review-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="staff-review-modal-head">
                    <h3>
                      Отзывы о {staffReviewModal.staffName}
                      {staffReviewModal.averageRating
                        ? ` · ${staffReviewModal.averageRating} ★`
                        : ""}
                    </h3>
                    <button
                      type="button"
                      className="small-btn"
                      onClick={() => {
                        setStaffReviewModal(null);
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  <div className="staff-review-modal-list">
                    {(() => {
                      const list = mapOrgReviews || [];
                      if (!list.length) return <p className="muted">Пока нет отзывов.</p>;
                      return (
                        <ul className="list review-list">
                          {list.map((r) => {
                            const displayRating = r.staff_rating || r.rating;
                            return (
                            <li
                              key={r.id}
                              className={["review-item", r.is_new && "review-item--new"]
                                .filter(Boolean)
                                .join(" ")}
                            >
                              <div className="review-item-head">
                                <strong>{r.client_name || "Клиент"}</strong>
                                {displayRating ? (
                                  <span
                                    className="review-stars"
                                    aria-label={`Оценка ${displayRating}`}
                                  >
                                    {"★".repeat(displayRating)}
                                    <span className="review-stars-empty">
                                      {"☆".repeat(Math.max(0, 5 - displayRating))}
                                    </span>
                                  </span>
                                ) : null}
                              </div>
                              {r.staff_text ? (
                                <p className="review-item-text">{r.staff_text}</p>
                              ) : (
                                <ReviewTextContent review={r} />
                              )}
                              {r.staff_text && r.text ? (
                                <p className="muted small review-item-text">Об услуге: {r.text}</p>
                              ) : null}
                              {r.photos?.length > 0 && (
                                <div className="review-photos">
                                  {r.photos.map((p, photoIdx) => (
                                    <button
                                      key={p.id}
                                      type="button"
                                      className="review-photo-btn"
                                      onClick={() => {
                                        const items = (list || []).flatMap((rev) =>
                                          (rev.photos || []).map((ph) => ({
                                            id: `review-${rev.id}-${ph.id}`,
                                            url: reviewImageUrl(ph.image),
                                            source: "review",
                                            review_id: rev.id,
                                            client_name: rev.client_name,
                                            rating: rev.staff_rating || rev.rating,
                                            text: rev.staff_text || rev.text || "",
                                          })),
                                        );
                                        const start = items.findIndex(
                                          (it) => it.id === `review-${r.id}-${p.id}`,
                                        );
                                        openOrgPhotoLightbox(items, start >= 0 ? start : photoIdx);
                                      }}
                                    >
                                      <img src={reviewImageUrl(p, "thumb")} alt="" loading="lazy" decoding="async" />
                                    </button>
                                  ))}
                                </div>
                              )}
                            </li>
                            );
                          })}
                        </ul>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {(mapOrgProfile?.reviews_count > 0 || mapOrgReviews.length > 0) && (

              <div className="map-org-reviews">

                <div className="map-org-reviews-head">

                  <p className="field-label">Отзывы</p>

                  <select

                    value={mapOrgReviewsOrdering}

                    onChange={(e) => {

                      setMapOrgReviewsOrdering(e.target.value);

                      loadMapOrgReviews(mapOrgPopup.provider, e.target.value);

                    }}

                  >

                    <option value="-created_at">Сначала новые</option>

                    <option value="-rating">Сначала положительные</option>

                    <option value="rating">Сначала негативные</option>

                  </select>

                </div>

                <ul className="list review-list">

                  {mapOrgReviews.length === 0 ? (

                    <li className="muted">Загрузка…</li>

                  ) : (

                    mapOrgReviews.map((r) => (
                      <ReviewListItem
                        key={r.id}
                        review={r}
                        reviewsForGallery={mapOrgReviews}
                        accessToken={accessToken}
                        me={me}
                        reviewReplyOpenId={reviewReplyOpenId}
                        reviewReplyForms={reviewReplyForms}
                        reviewReplyFormError={reviewReplyFormError}
                        setReviewReplyOpenId={setReviewReplyOpenId}
                        setReviewReplyForms={setReviewReplyForms}
                        setReviewReplyFormError={setReviewReplyFormError}
                        toggleReviewLike={toggleReviewLike}
                        submitReviewReply={submitReviewReply}
                        openReviewPhotoLightbox={openReviewPhotoLightbox}
                      />
                    ))

                  )}

                </ul>

              </div>

            )}

            </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
