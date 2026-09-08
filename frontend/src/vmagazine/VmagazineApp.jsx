import { useCallback, useEffect, useRef, useState } from "react";
import PublicShopPage from "../PublicShopPage.jsx";
import { showToast } from "../toast.js";
import { CartTab, FavoritesTab, HomeTab, ProfileTab } from "./VmagazinePanels.jsx";
import VmagazineLogo from "./VmagazineLogo.jsx";
import VmagazineProductSheet from "./VmagazineProductSheet.jsx";
import "./vmagazine.css";

const TABS = [
  { id: "home", label: "Главная", icon: "🏠" },
  { id: "chats", label: "Чаты", icon: "💬" },
  { id: "favorites", label: "Избранное", icon: "♥" },
  { id: "cart", label: "Корзина", icon: "🛒" },
  { id: "profile", label: "Профиль", icon: "👤" },
];

/**
 * stack:
 *  null
 *  { kind: "product", productId }
 *  { kind: "shop", slug, returnProductId }
 */
export default function VmagazineApp({
  authFetch,
  API_URL,
  onTabChange,
  onChatsHostReady,
  onRegisterBackHandler,
  onOpenPhotos,
  openChatWithProvider,
  me,
}) {
  const [tab, setTab] = useState("home");
  const [stack, setStack] = useState(null);
  const [paidOrderId, setPaidOrderId] = useState(null);
  const [cartRemainingHint, setCartRemainingHint] = useState(false);
  const shopBackRef = useRef(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const fromQuery = params.get("paid_order") || params.get("order");
      const fromStore = sessionStorage.getItem("vmag_last_paid_order");
      const remaining = sessionStorage.getItem("vmag_cart_remaining") === "1";
      const oid = fromQuery && fromQuery !== "PENDING" ? fromQuery : fromStore;
      if (oid) {
        setPaidOrderId(String(oid));
        setTab("profile");
        setCartRemainingHint(remaining);
        showToast(remaining ? "Оплата принята. В корзине ещё есть товары других магазинов." : "Оплата принята — заказ в профиле");
        sessionStorage.removeItem("vmag_last_paid_order");
        sessionStorage.removeItem("vmag_cart_remaining");
        window.history.replaceState({}, "", "/vmagazine");
      }
    } catch {
      /* ignore */
    }
  }, []);

  const popStack = useCallback(() => {
    setStack((cur) => {
      if (!cur) return null;
      if (cur.kind === "shop" && cur.returnProductId) {
        return { kind: "product", productId: cur.returnProductId };
      }
      return null;
    });
    return true;
  }, []);

  useEffect(() => {
    onTabChange?.(tab);
  }, [tab, onTabChange]);

  useEffect(() => {
    if (tab !== "chats") onChatsHostReady?.(null);
  }, [tab, onChatsHostReady]);

  useEffect(() => {
    if (!onRegisterBackHandler) return undefined;
    onRegisterBackHandler(() => {
      if (stack?.kind === "shop" && shopBackRef.current?.()) return true;
      if (stack) {
        popStack();
        return true;
      }
      return false;
    });
    return () => onRegisterBackHandler(null);
  }, [onRegisterBackHandler, stack, popStack]);

  function switchTab(id) {
    setStack(null);
    setTab(id);
  }

  function openProduct(productOrId) {
    const id = typeof productOrId === "object" ? productOrId?.id : productOrId;
    if (!id) return;
    setStack({ kind: "product", productId: id });
  }

  function openShop(slug, fromProduct) {
    if (!slug) return;
    setStack({
      kind: "shop",
      slug,
      returnProductId: fromProduct?.id || (stack?.kind === "product" ? stack.productId : null),
    });
  }

  const overlayOpen = Boolean(stack);

  return (
    <section
      className={`card vmagazine-app${tab === "chats" ? " vmagazine-app--chats" : ""}${
        overlayOpen ? " vmagazine-app--overlay" : ""
      }`}
    >
      <div className="vmagazine-app-body">
        {paidOrderId && !stack ? (
          <div className="vmag-paid-banner">
            <strong>Заказ #{paidOrderId}</strong>
            <span className="muted small">
              {cartRemainingHint
                ? "Оплата прошла. Оформите остальные магазины из корзины."
                : "Статус обновится после подтверждения оплаты."}
            </span>
            <div className="vmag-paid-banner-actions">
              {cartRemainingHint ? (
                <button type="button" className="primary-btn" onClick={() => switchTab("cart")}>
                  В корзину
                </button>
              ) : null}
              <button type="button" className="ghost-btn" onClick={() => setPaidOrderId(null)}>
                Закрыть
              </button>
            </div>
          </div>
        ) : null}
        {stack?.kind === "product" ? (
          <VmagazineProductSheet
            productId={stack.productId}
            authFetch={authFetch}
            API_URL={API_URL}
            onOpenRelated={(id) => openProduct(id)}
            onOpenShop={openShop}
            onClose={popStack}
            onOpenPhotos={onOpenPhotos}
            onWriteSeller={async (providerId) => {
              if (!openChatWithProvider) return;
              await openChatWithProvider(providerId);
              setStack(null);
              setTab("chats");
            }}
          />
        ) : null}
        {stack?.kind === "shop" ? (
          <div className="vmagazine-embedded-shop">
            <PublicShopPage
              slug={stack.slug}
              embedded
              onBack={popStack}
              onConsumeBack={(fn) => {
                shopBackRef.current = fn;
              }}
              onOpenPhotos={onOpenPhotos}
              onWriteSeller={async (providerId) => {
                if (!openChatWithProvider) return;
                await openChatWithProvider(providerId);
                setStack(null);
                setTab("chats");
              }}
            />
          </div>
        ) : null}
        {!stack ? (
          <>
            {tab === "home" ? (
              <HomeTab authFetch={authFetch} API_URL={API_URL} onOpenProduct={openProduct} />
            ) : null}
            {tab === "chats" ? (
              <div
                className="vmenu-chats-host vmagazine-chats-host"
                ref={(el) => onChatsHostReady?.(el)}
              />
            ) : null}
            {tab === "favorites" ? (
              <FavoritesTab
                authFetch={authFetch}
                API_URL={API_URL}
                onOpenProduct={openProduct}
                onGoHome={() => switchTab("home")}
              />
            ) : null}
            {tab === "cart" ? (
              <CartTab
                authFetch={authFetch}
                API_URL={API_URL}
                me={me}
                onOpenProduct={openProduct}
                onGoHome={() => switchTab("home")}
              />
            ) : null}
            {tab === "profile" ? (
              <ProfileTab
                authFetch={authFetch}
                API_URL={API_URL}
                onOpenProduct={openProduct}
                highlightOrderId={paidOrderId}
              />
            ) : null}
          </>
        ) : null}
      </div>
      {!overlayOpen ? (
        <nav className="vmenu-bottom-nav vmagazine-bottom-nav" aria-label="Вмагазине">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? "active" : ""}
              onClick={() => switchTab(t.id)}
            >
              <span aria-hidden>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      ) : null}
    </section>
  );
}

export { VmagazineLogo };
