import { BOOKMARK_CATALOG } from "./subnavBookmarks.js";
import { orgSphereOf } from "./staffPermissions.js";

function isMobileChatLayout() {
  if (typeof window === "undefined") return false;
  if (document.documentElement.classList.contains("native-app")) return true;
  return window.matchMedia("(max-width: 900px)").matches;
}

/**
 * Bookmark availability + navigate / toggle for cabinet chrome.
 */
export function useCabinetNavigation({
  me,
  accessToken,
  isCafeOrgUser,
  canViewOrgReviews,
  canManageOrgSettings,
  canAccessStaffPage,
  staffHasPerm,
  setMenuOpen,
  setSelectedChatId,
  setMarketplaceInitialTab,
  setCurrentView,
  setCafeWorkspaceTab,
  openProviderReviews,
  setSubnavBookmarks,
}) {
  function isBookmarkAvailable(id) {
    const role = me?.role;
    if (!role) return false;
    const def = BOOKMARK_CATALOG.find((b) => b.id === id);
    if (!def || !def.roles.includes(role)) return false;
    if (id === "reviews" && !canViewOrgReviews()) return false;
    if (id === "analytics" && role === "staff") {
      const sphere = orgSphereOf(me);
      if (sphere === "cafe_restaurant") {
        if (
          !staffHasPerm("cafe_orders") &&
          !staffHasPerm("cafe_kitchen") &&
          !staffHasPerm("cafe_settings")
        ) {
          return false;
        }
      } else if (sphere === "marketplaces") {
        if (!staffHasPerm("marketplace_manage_orders") && !staffHasPerm("marketplace_manage_catalog")) {
          return false;
        }
      } else if (!staffHasPerm("manage_bookings")) {
        return false;
      }
    }
    if (role === "staff") {
      if (id === "bookings" && !staffHasPerm("manage_bookings")) return false;
      if (id === "intervals" && !staffHasPerm("manage_intervals")) return false;
      if (id === "services" && !staffHasPerm("manage_services")) return false;
      if (id === "chats" && !staffHasPerm("manage_chats") && !staffHasPerm("manage_client_chats")) return false;
    }
    if (id === "organization" && !canManageOrgSettings) return false;
    if (id === "staff" && !canAccessStaffPage) return false;
    if (id === "activity" && role !== "client") return false;
    if (me?.provider_sphere === "cafe_restaurant" || me?.employer_sphere === "cafe_restaurant") {
      if (
        id === "intervals" ||
        id === "bookings" ||
        id === "services" ||
        id === "my_bookings" ||
        id === "booking_history"
      ) {
        return false;
      }
      if ((id === "cafe" || id === "cafe_orders") && !isCafeOrgUser) return false;
      if (id === "cafe" && role === "staff" && !staffHasPerm("cafe_menu") && !staffHasPerm("cafe_settings") && !staffHasPerm("cafe_seating")) {
        return false;
      }
      if (
        id === "cafe_orders" &&
        role === "staff" &&
        !staffHasPerm("cafe_orders") &&
        !staffHasPerm("cafe_kitchen") &&
        !staffHasPerm("cafe_seating") &&
        !staffHasPerm("cafe_delivery")
      ) {
        return false;
      }
    } else if (id === "cafe" || id === "cafe_orders") {
      return false;
    }
    if (id === "cafe_my_orders" || id === "loyalty") {
      return role === "client";
    }
    if (me?.provider_sphere === "marketplaces" || me?.employer_sphere === "marketplaces") {
      if (id === "intervals" || id === "bookings" || id === "services" || id === "my_bookings") return false;
      if (id === "analytics" || id === "reviews") {
        return role === "provider" || role === "staff";
      }
      if (id === "marketplaces") {
        if (role === "provider") return me?.provider_sphere === "marketplaces";
        if (role === "staff") {
          return (
            staffHasPerm("marketplace_manage_orders") ||
            staffHasPerm("marketplace_manage_catalog") ||
            staffHasPerm("marketplace_view_keys")
          );
        }
        return false;
      }
    } else if (id === "marketplaces") {
      return false;
    }
    if (id === "inspections") {
      if (role === "client") return true;
      if (role === "provider") return me?.provider_sphere === "service_center";
      if (role === "staff") {
        return (
          (staffHasPerm("manage_inspections") || staffHasPerm("manage_bookings")) &&
          (me?.provider_sphere === "service_center" || me?.employer_sphere === "service_center")
        );
      }
      return false;
    }
    if (id === "service_apps" || id === "vmenu") return Boolean(accessToken);
    return true;
  }

  function navigateBookmark(id) {
    setMenuOpen(false);
    if (id === "chats" && isMobileChatLayout()) setSelectedChatId(null);
    if (id === "reviews") {
      if (me?.provider_sphere === "marketplaces" || me?.employer_sphere === "marketplaces") {
        setMarketplaceInitialTab("reviews");
        setCurrentView("marketplaces");
        return;
      }
      openProviderReviews();
      return;
    }
    if (id === "analytics" && (me?.provider_sphere === "marketplaces" || me?.employer_sphere === "marketplaces")) {
      setMarketplaceInitialTab("analytics");
      setCurrentView("marketplaces");
      return;
    }
    if (id === "cafe") setCafeWorkspaceTab("floor");
    setCurrentView(id);
  }

  function toggleSubnavBookmark(id) {
    setSubnavBookmarks((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev;
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  }

  return {
    isBookmarkAvailable,
    navigateBookmark,
    toggleSubnavBookmark,
  };
}
