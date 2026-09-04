import { useState } from "react";
import { API_URL } from "./config.js";
import { reviewImageUrl } from "./chatHelpers.jsx";
import {
  todayIsoDate,
  formatApiError,
  normalizeReviewsList,
} from "./bookingCalendarUtils.jsx";
import { reviewIsSupplemented } from "./bookingDisplay.jsx";

/**
 * Provider/client reviews load, reply, submit, and related UI state for App.
 */
export function useReviews({
  authFetch,
  me,
  bookings,
  setBookings,
  allLocations,
  setAllLocations,
  setCurrentView,
  setClientStatus,
  setClientBookingForm,
  setClientBookModalOpen,
  mapOrgPopup,
  mapOrgReviewsOpen,
  mapOrgReviewsOrdering,
  setMapOrgReviews,
  loadMapOrgSummary,
  loadMapOrgReviews,
  waitForClientDiscoverMap,
  openOrgOnMap,
  onClientLocationSelect,
  openOrgPhotoLightbox,
}) {
  const [reviewModalBooking, setReviewModalBooking] = useState(null);
  const [reviewModalReview, setReviewModalReview] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, staff_rating: 5, text: "", staff_text: "" });
  const [reviewSubmitError, setReviewSubmitError] = useState("");
  const [providerReviews, setProviderReviews] = useState([]);
  const [providerReviewsOrdering, setProviderReviewsOrdering] = useState("-created_at");
  const [missedReviewsCount, setMissedReviewsCount] = useState(0);
  const [myReviews, setMyReviews] = useState([]);
  const [reviewReplyOpenId, setReviewReplyOpenId] = useState(null);
  const [reviewReplyForms, setReviewReplyForms] = useState({});
  const [reviewReplyFormError, setReviewReplyFormError] = useState("");

  async function loadProviderReviewsList(ordering = providerReviewsOrdering) {
    const res = await authFetch(
      `${API_URL}/reviews/?ordering=${encodeURIComponent(ordering || "-created_at")}`,
    );
    if (res.ok) setProviderReviews(normalizeReviewsList(await res.json()));
  }

  async function loadMyReviews() {
    const res = await authFetch(`${API_URL}/reviews/`);
    if (res.ok) setMyReviews(normalizeReviewsList(await res.json()));
  }

  async function loadMissedReviewsCount() {
    if (me?.role !== "provider") return;
    const res = await authFetch(`${API_URL}/reviews/unread-count/`);
    if (res.ok) {
      const data = await res.json();
      setMissedReviewsCount(Number(data.count) || 0);
    }
  }

  async function markReviewsSeen() {
    if (me?.role !== "provider") return;
    const res = await authFetch(`${API_URL}/reviews/mark-seen/`, { method: "POST", body: "{}" });
    if (res.ok) setMissedReviewsCount(0);
  }

  function openProviderReviews() {
    setCurrentView("reviews");
    loadProviderReviewsList(providerReviewsOrdering);
    markReviewsSeen();
  }

  async function refreshReviewsAfterSubmit(providerId) {
    if (me?.role === "client") await loadMyReviews();
    if (me?.role === "provider") await loadProviderReviewsList(providerReviewsOrdering);
    if (mapOrgPopup && Number(mapOrgPopup.provider) === Number(providerId)) {
      await loadMapOrgSummary(providerId);
      if (mapOrgReviewsOpen) await loadMapOrgReviews(providerId, mapOrgReviewsOrdering);
    }
  }

  function bookingHasReview(bookingId) {
    const b = bookings.find((x) => Number(x.id) === Number(bookingId));
    if (b?.review?.id) return true;
    return myReviews.some((r) => Number(r.booking) === Number(bookingId));
  }

  function getBookingReview(booking) {
    if (booking?.review?.id) return booking.review;
    if (me?.role === "client") {
      return myReviews.find((r) => Number(r.booking) === Number(booking.id)) || null;
    }
    return null;
  }

  async function openOrgCardFromHistory(booking) {
    const providerId = booking?.provider;
    if (!providerId) return;
    let loc = allLocations.find((l) => Number(l.provider) === Number(providerId));
    if (!loc) {
      const res = await authFetch(`${API_URL}/locations/`);
      if (res.ok) {
        const list = await res.json();
        loc = list.find((l) => Number(l.provider) === Number(providerId));
        if (Array.isArray(list) && list.length) setAllLocations(list);
      }
    }
    if (!loc) {
      setClientStatus("Точка организации на карте не найдена.");
      return;
    }
    setCurrentView("client_map");
    await waitForClientDiscoverMap();
    await openOrgOnMap(loc);
    const serviceId = booking.service || booking.service_id;
    const staffId = booking.staff || booking.staff_id;
    await onClientLocationSelect(String(loc.id), todayIsoDate());
    setClientBookingForm((p) => ({
      ...p,
      provider: String(booking.provider || loc.provider || p.provider),
      locationId: String(loc.id),
      serviceId: serviceId ? String(serviceId) : p.serviceId,
      staffId: staffId ? String(staffId) : "any",
      windowKey: "",
    }));
    setClientBookModalOpen(true);
  }

  function patchReviewInLists(updated) {
    const merge = (list) => list.map((r) => (Number(r.id) === Number(updated.id) ? { ...r, ...updated } : r));
    setProviderReviews((list) => merge(list));
    setMapOrgReviews((list) => merge(list));
    setMyReviews((list) => merge(list));
  }

  async function toggleReviewLike(reviewId, likedByMe) {
    const path = likedByMe ? "unlike" : "like";
    const res = await authFetch(`${API_URL}/reviews/${reviewId}/${path}/`, { method: "POST", body: "{}" });
    if (!res.ok) return;
    const data = await res.json();
    const patch = (list) =>
      list.map((r) =>
        Number(r.id) === Number(reviewId)
          ? { ...r, liked_by_me: !likedByMe, likes_count: data.likes_count ?? r.likes_count }
          : r,
      );
    setProviderReviews(patch);
    setMapOrgReviews(patch);
  }

  async function submitReviewReply(reviewId) {
    const form = reviewReplyForms[reviewId] || {};
    const text = (form.text || "").trim();
    if (!text) {
      setReviewReplyFormError("Введите текст ответа.");
      return;
    }
    if (!form.publishReply && !form.viaChat) {
      setReviewReplyFormError("Отметьте хотя бы один способ: ответ на отзыв или сообщение в чат.");
      return;
    }
    setReviewReplyFormError("");
    const res = await authFetch(`${API_URL}/reviews/${reviewId}/reply/`, {
      method: "POST",
      body: JSON.stringify({
        text,
        publish_reply: form.publishReply,
        via_chat: form.viaChat,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setReviewReplyFormError(formatApiError(err, res.status) || "Не удалось отправить ответ.");
      return;
    }
    const updated = await res.json();
    patchReviewInLists(updated);
    setReviewReplyOpenId(null);
    setReviewReplyForms((p) => {
      const next = { ...p };
      delete next[reviewId];
      return next;
    });
  }

  function buildAllReviewPhotoLightboxItems(reviews) {
    const items = [];
    for (const r of reviews || []) {
      for (const p of r.photos || []) {
        items.push({
          id: `review-${r.id}-${p.id}`,
          url: reviewImageUrl(p, "full"),
          source: "review",
          review_id: r.id,
          client_name: r.client_name,
          rating: r.rating,
          text: r.text || "",
        });
      }
    }
    return items;
  }

  function findReviewPhotoGlobalIndex(reviews, reviewId, photoIndex) {
    let offset = 0;
    for (const r of reviews || []) {
      const photos = r.photos || [];
      if (r.id === reviewId) return offset + photoIndex;
      offset += photos.length;
    }
    return 0;
  }

  function openReviewPhotoLightbox(review, photoIndex = 0, reviewsList = null) {
    const reviews = reviewsList?.length ? reviewsList : [review];
    const items = buildAllReviewPhotoLightboxItems(reviews);
    if (!items.length) return;
    const globalIndex = findReviewPhotoGlobalIndex(reviews, review.id, photoIndex);
    openOrgPhotoLightbox(items, globalIndex);
  }

  async function submitClientReview(event) {
    event.preventDefault();
    if (!reviewModalBooking) return;
    setReviewSubmitError("");
    const input = document.getElementById("review-photos-input");
    const isSupplement = Boolean(reviewModalReview?.id);

    if (isSupplement) {
      const fd = new FormData();
      if ((reviewForm.text || "").trim()) fd.append("append_text", reviewForm.text.trim());
      if (input?.files) {
        for (const f of input.files) fd.append("photos", f);
      }
      const res = await authFetch(`${API_URL}/reviews/${reviewModalReview.id}/`, {
        method: "PATCH",
        body: fd,
      });
      if (res.ok) {
        const updated = await res.json();
        const bookingId = reviewModalBooking.id;
        const providerId = reviewModalBooking.provider;
        setBookings((prev) =>
          prev.map((b) =>
            Number(b.id) === Number(bookingId)
              ? {
                  ...b,
                  review: {
                    id: updated.id,
                    rating: updated.rating,
                    text: updated.text,
                    created_at: updated.created_at,
                    supplemented_at: updated.supplemented_at,
                    photos: updated.photos || [],
                    reply: updated.reply || null,
                  },
                }
              : b,
          ),
        );
        setMyReviews((prev) => {
          const has = prev.some((r) => Number(r.id) === Number(updated.id));
          if (has) return prev.map((r) => (Number(r.id) === Number(updated.id) ? { ...r, ...updated } : r));
          return [updated, ...prev];
        });
        setReviewModalBooking(null);
        setReviewModalReview(null);
        setReviewForm({ rating: 5, staff_rating: 5, text: "", staff_text: "" });
        if (input) input.value = "";
        setReviewSubmitError("");
        setClientStatus("Отзыв дополнен.");
        await refreshReviewsAfterSubmit(providerId);
        return;
      }
      const err = await res.json().catch(() => ({}));
      setReviewSubmitError(formatApiError(err, res.status) || "Не удалось дополнить отзыв.");
      return;
    }

    const fd = new FormData();
    fd.append("provider", String(reviewModalBooking.provider));
    fd.append("booking", String(reviewModalBooking.id));
    if (reviewModalBooking.staff_user_id) {
      fd.append("staff_user", String(reviewModalBooking.staff_user_id));
    }
    fd.append("rating", String(reviewForm.rating));
    if (reviewModalBooking.staff_user_id && reviewForm.staff_rating) {
      fd.append("staff_rating", String(reviewForm.staff_rating));
    }
    fd.append("text", reviewForm.text || "");
    if (reviewModalBooking.staff_user_id) {
      fd.append("staff_text", reviewForm.staff_text || "");
    }
    if (input?.files) {
      for (const f of input.files) fd.append("photos", f);
    }
    const res = await authFetch(`${API_URL}/reviews/`, { method: "POST", body: fd });
    if (res.ok) {
      const created = await res.json();
      const providerId = reviewModalBooking.provider;
      const bookingId = reviewModalBooking.id;
      setBookings((prev) =>
        prev.map((b) =>
          Number(b.id) === Number(bookingId)
            ? {
                ...b,
                review: {
                  id: created.id,
                  rating: created.rating,
                  text: created.text,
                  created_at: created.created_at,
                  supplemented_at: created.supplemented_at,
                  photos: created.photos || [],
                  reply: created.reply || null,
                },
              }
            : b,
        ),
      );
      setReviewModalBooking(null);
      setReviewModalReview(null);
      setReviewForm({ rating: 5, staff_rating: 5, text: "", staff_text: "" });
      if (input) input.value = "";
      setReviewSubmitError("");
      setClientStatus("Отзыв отправлен.");
      await refreshReviewsAfterSubmit(providerId);
      return;
    }
    const err = await res.json().catch(() => ({}));
    setReviewSubmitError(formatApiError(err, res.status) || "Не удалось отправить отзыв.");
  }

  function openClientReviewModal(booking, existingReview = null) {
    if (existingReview && reviewIsSupplemented(existingReview)) return;
    setReviewSubmitError("");
    if (existingReview) {
      setReviewModalReview(existingReview);
      setReviewForm({
        rating: existingReview.rating,
        staff_rating: existingReview.staff_rating || 5,
        text: "",
        staff_text: "",
      });
    } else {
      setReviewModalReview(null);
      setReviewForm({ rating: 5, staff_rating: 5, text: "", staff_text: "" });
    }
    setReviewModalBooking({ ...booking, staff_user_id: booking.staff || null });
  }

  return {
    reviewModalBooking,
    setReviewModalBooking,
    reviewModalReview,
    setReviewModalReview,
    reviewForm,
    setReviewForm,
    reviewSubmitError,
    setReviewSubmitError,
    providerReviews,
    setProviderReviews,
    providerReviewsOrdering,
    setProviderReviewsOrdering,
    missedReviewsCount,
    myReviews,
    reviewReplyOpenId,
    setReviewReplyOpenId,
    reviewReplyForms,
    setReviewReplyForms,
    reviewReplyFormError,
    setReviewReplyFormError,
    loadProviderReviewsList,
    loadMyReviews,
    loadMissedReviewsCount,
    markReviewsSeen,
    openProviderReviews,
    refreshReviewsAfterSubmit,
    bookingHasReview,
    getBookingReview,
    openOrgCardFromHistory,
    toggleReviewLike,
    submitReviewReply,
    openReviewPhotoLightbox,
    submitClientReview,
    openClientReviewModal,
  };
}
