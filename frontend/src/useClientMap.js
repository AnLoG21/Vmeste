import { useEffect, useRef, useState } from "react";
import { loadYandexMaps } from "./yandexMapsLoader.js";
import { buildYmapOrgPlacemark, resetOrgPinLayoutClass } from "./clientOrgFeatures.js";
import { getDevicePosition, hasCoords } from "./geoPosition.js";
import { showToast } from "./toast.js";

/**
 * Client discover map: Yandex init/destroy, placemarks, my-location tracking.
 * Map-org sheet state lives in useMapOrgSheet; pass setDetectedCity from useOrgAddress.
 */
export function useClientMap({
  currentView,
  meRole,
  allLocations,
  allLocationsRef,
  mapOrgPopup,
  mapOrgReviewsOpen,
  clientBookModalOpen,
  clientFiltersOpen,
  setDetectedCity,
  openOrgOnMap,
}) {
  const clientDiscoverMapRef = useRef(null);
  const clientDiscoverMapClickBoundRef = useRef(false);
  const clientDiscoverMapZoomTimerRef = useRef(null);
  const clientMyLocationPlacemarkRef = useRef(null);
  const clientMyLocationAccuracyRef = useRef(null);
  const clientMyLocationCoordsRef = useRef(null);
  const clientMyLocationMetaRef = useRef(null); // { accuracy, at }
  const clientMyLocationWatchIdRef = useRef(null);
  const clientCenteredOnMeRef = useRef(false);
  const [mapMarkersTick, setMapMarkersTick] = useState(0);
  const openOrgOnMapRef = useRef(openOrgOnMap);
  openOrgOnMapRef.current = openOrgOnMap;

  function clearMyLocationWatch() {
    const id = clientMyLocationWatchIdRef.current;
    if (typeof id === "number" && navigator.geolocation?.clearWatch) {
      try {
        navigator.geolocation.clearWatch(id);
      } catch {
        /* ignore */
      }
    }
    clientMyLocationWatchIdRef.current = null;
  }

  function destroyClientDiscoverMap() {
    clearMyLocationWatch();
    clientMyLocationPlacemarkRef.current = null;
    clientMyLocationAccuracyRef.current = null;
    clientMyLocationCoordsRef.current = null;
    clientMyLocationMetaRef.current = null;
    clientCenteredOnMeRef.current = false;
    if (clientDiscoverMapRef.current) {
      try {
        clientDiscoverMapRef.current.destroy();
      } catch (_e) {
        // ignore
      }
      clientDiscoverMapRef.current = null;
    }
    clientDiscoverMapClickBoundRef.current = false;
    if (clientDiscoverMapZoomTimerRef.current) {
      window.clearTimeout(clientDiscoverMapZoomTimerRef.current);
      clientDiscoverMapZoomTimerRef.current = null;
    }
    resetOrgPinLayoutClass();
  }

  function maybeCenterOnMe(coords, { force = false } = {}) {
    const map = clientDiscoverMapRef.current;
    if (!map || !coords) return;
    const cityKey = (new URLSearchParams(window.location.search).get("city") || "").toLowerCase();
    if (cityKey && !force) return;
    if (clientCenteredOnMeRef.current && !force) return;
    const [lat, lon] = coords;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    try {
      map.setCenter([lat, lon], 13, { duration: 280 });
      clientCenteredOnMeRef.current = true;
    } catch {
      /* ignore */
    }
  }

  function ensureClientMyLocationMarker(coords, { center = false, accuracy = null } = {}) {
    const ymaps = window.ymaps;
    const map = clientDiscoverMapRef.current;
    if (!ymaps || !map || !coords) return;
    const [lat, lon] = coords;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const acc = Number(accuracy);
    const hasAcc = Number.isFinite(acc) && acc > 0 && acc < 5000;
    const prev = clientMyLocationMetaRef.current;
    if (
      clientMyLocationPlacemarkRef.current &&
      prev &&
      hasAcc &&
      Number.isFinite(prev.accuracy)
    ) {
      const ageMs = Date.now() - (prev.at || 0);
      if (acc > prev.accuracy * 1.75 && acc > 60 && ageMs < 90_000) {
        return;
      }
    }

    clientMyLocationCoordsRef.current = [lat, lon];
    clientMyLocationMetaRef.current = {
      accuracy: hasAcc ? acc : prev?.accuracy ?? null,
      at: Date.now(),
    };

    if (clientMyLocationPlacemarkRef.current) {
      try {
        clientMyLocationPlacemarkRef.current.geometry.setCoordinates([lat, lon]);
      } catch {
        /* ignore */
      }
    } else {
      // Как у курьера в CafeOrderMapPin: islands#blueCircleDotIcon
      const pm = new ymaps.Placemark(
        [lat, lon],
        { hintContent: "Вы здесь", balloonContent: "Моё местоположение" },
        {
          preset: "islands#blueCircleDotIcon",
          zIndex: 1000,
          zIndexHover: 1000,
        },
      );
      clientMyLocationPlacemarkRef.current = pm;
      try {
        map.geoObjects.add(pm);
      } catch {
        /* ignore */
      }
    }

    const radius = hasAcc ? Math.max(25, Math.min(acc, 350)) : null;
    if (radius != null) {
      if (clientMyLocationAccuracyRef.current) {
        try {
          clientMyLocationAccuracyRef.current.geometry.setCoordinates([[lat, lon], radius]);
        } catch {
          try {
            clientMyLocationAccuracyRef.current.geometry.setCoordinates([lat, lon]);
            clientMyLocationAccuracyRef.current.geometry.setRadius?.(radius);
          } catch {
            /* ignore */
          }
        }
      } else {
        try {
          const circle = new ymaps.Circle(
            [[lat, lon], radius],
            {},
            {
              fillColor: "rgba(26, 115, 232, 0.12)",
              strokeColor: "#1a73e8",
              strokeOpacity: 0.4,
              strokeWidth: 1,
              zIndex: 50,
            },
          );
          clientMyLocationAccuracyRef.current = circle;
          map.geoObjects.add(circle);
        } catch {
          /* ignore */
        }
      }
    }

    try {
      if (clientMyLocationAccuracyRef.current) {
        map.geoObjects.remove(clientMyLocationAccuracyRef.current);
        map.geoObjects.add(clientMyLocationAccuracyRef.current);
      }
      if (clientMyLocationPlacemarkRef.current) {
        map.geoObjects.remove(clientMyLocationPlacemarkRef.current);
        map.geoObjects.add(clientMyLocationPlacemarkRef.current);
      }
    } catch {
      /* ignore */
    }

    if (center) maybeCenterOnMe([lat, lon]);
  }

  async function startClientMyLocationTracking() {
    if (clientMyLocationWatchIdRef.current != null) return;
    clientMyLocationWatchIdRef.current = "pending";

    const applyCoords = (lat, lon, accuracy, { center = false, source = "" } = {}) => {
      if (!hasCoords(lat, lon)) return false;
      // Только явный IP-провайдер Яндекса даёт «за городом»; browser/Wi‑Fi — ставим всегда.
      if (String(source) === "yandex:yandex") return false;
      ensureClientMyLocationMarker([Number(lat), Number(lon)], {
        center,
        accuracy: Number(accuracy),
      });
      return true;
    };

    try {
      // Как у курьера: getDevicePosition без IP. Сначала точный GPS, потом обычный browser.
      try {
        const pos =
          (await getDevicePosition({
            force: true,
            allowIpFallback: false,
            highAccuracyOnly: true,
          }).catch(() => null)) ||
          (await getDevicePosition({
            force: true,
            allowIpFallback: false,
            highAccuracyOnly: false,
          }));
        if (pos) {
          applyCoords(pos.lat, pos.lon, pos.accuracy, { center: true, source: pos.source });
        }
      } catch {
        /* watch / кнопка геолокации */
      }

      try {
        const ymaps = window.ymaps;
        if (ymaps?.geolocation?.get && !clientMyLocationCoordsRef.current) {
          const result = await ymaps.geolocation.get({
            provider: "browser",
            autoReverseGeocode: false,
            mapStateAutoApply: false,
          });
          const coords = result?.geoObjects?.get?.(0)?.geometry?.getCoordinates?.();
          if (Array.isArray(coords) && coords.length >= 2) {
            applyCoords(coords[0], coords[1], null, {
              center: !clientCenteredOnMeRef.current,
              source: "yandex:browser",
            });
          }
        }
      } catch {
        /* ignore */
      }

      if (!navigator.geolocation) {
        clientMyLocationWatchIdRef.current = null;
        return;
      }

      const applyWatch = (pos) => {
        applyCoords(pos?.coords?.latitude, pos?.coords?.longitude, pos?.coords?.accuracy, {
          center: !clientCenteredOnMeRef.current,
          source: "browser-watch",
        });
      };

      const startWatch = (high) => {
        try {
          return navigator.geolocation.watchPosition(
            applyWatch,
            () => {
              if (high) {
                // Desktop без GPS: пробуем network location.
                clientMyLocationWatchIdRef.current = startWatch(false);
              } else {
                clientMyLocationWatchIdRef.current = null;
              }
            },
            high
              ? { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
              : { enableHighAccuracy: false, timeout: 20000, maximumAge: 10000 },
          );
        } catch {
          return null;
        }
      };

      clientMyLocationWatchIdRef.current = startWatch(true);
      if (clientMyLocationWatchIdRef.current == null) {
        clientMyLocationWatchIdRef.current = startWatch(false);
      }
    } catch {
      clientMyLocationWatchIdRef.current = null;
    }
  }

  function attachBrowserGeolocationControl(ymaps, map) {
    // Как CafeGuestDeliveryMap: provider=browser, без IP-метки Яндекса.
    try {
      const geoControl = new ymaps.control.GeolocationControl({
        options: { provider: "browser", noPlacemark: true },
      });
      map.controls.add(geoControl);
      geoControl.events.add("locationchange", (e) => {
        const position = e.get("position");
        if (!Array.isArray(position) || position.length < 2) return;
        if (!hasCoords(position[0], position[1])) return;
        ensureClientMyLocationMarker([Number(position[0]), Number(position[1])], {
          center: true,
          accuracy: null,
        });
      });
    } catch {
      /* ignore */
    }
  }

  function paintClientDiscoverMapMarkers(locations, { fitView = false, selectedId = null } = {}) {
    const ymaps = window.ymaps;
    const map = clientDiscoverMapRef.current;
    if (!ymaps || !map || !Array.isArray(locations)) return;
    if (!clientDiscoverMapClickBoundRef.current) {
      clientDiscoverMapClickBoundRef.current = true;
      map.geoObjects.events.add("click", (e) => {
        const target = e.get("target");
        const loc = target?.properties?.get?.("vmesteLoc");
        if (loc) openOrgOnMapRef.current?.(loc);
      });
    }
    const zoom = map.getZoom();
    const selected = selectedId != null ? selectedId : mapOrgPopup?.id;
    map.geoObjects.removeAll();
    clientMyLocationPlacemarkRef.current = null;
    clientMyLocationAccuracyRef.current = null;
    const coordsList = [];
    for (const loc of locations) {
      const lat = Number(loc.latitude);
      const lon = Number(loc.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const pm = buildYmapOrgPlacemark(
        ymaps,
        loc,
        () => {
          openOrgOnMapRef.current?.(loc);
        },
        new Date(),
        zoom,
        { selected: selected != null && String(loc.id) === String(selected) },
      );
      map.geoObjects.add(pm);
      coordsList.push([lat, lon]);
    }
    if (clientMyLocationCoordsRef.current) {
      ensureClientMyLocationMarker(clientMyLocationCoordsRef.current, {
        accuracy: clientMyLocationMetaRef.current?.accuracy,
      });
    } else {
      void startClientMyLocationTracking();
    }
    if (!fitView) return;
    if (clientMyLocationCoordsRef.current && !clientCenteredOnMeRef.current) {
      maybeCenterOnMe(clientMyLocationCoordsRef.current);
      return;
    }
    if (clientCenteredOnMeRef.current && clientMyLocationCoordsRef.current) {
      return;
    }
    if (coordsList.length === 1) {
      map.setCenter(coordsList[0], 14);
    } else if (coordsList.length > 1) {
      map.setBounds(ymaps.util.bounds.fromPoints(coordsList), { checkZoomRange: true, zoomMargin: 52 });
    } else if (clientMyLocationCoordsRef.current) {
      map.setCenter(clientMyLocationCoordsRef.current, 14);
    } else {
      map.setCenter([55.751244, 37.618423], 10);
    }
  }

  function fitClientDiscoverMapViewport() {
    const map = clientDiscoverMapRef.current;
    if (!map) return;
    try {
      if (map.container?.fitToViewport) map.container.fitToViewport();
      else map.setSize?.([map.container?.getSize?.()?.[0], map.container?.getSize?.()?.[1]]);
    } catch {
      // ignore
    }
  }

  async function waitForClientDiscoverMap(maxMs = 4500) {
    if (clientDiscoverMapRef.current) return clientDiscoverMapRef.current;
    const started = Date.now();
    while (Date.now() - started < maxMs) {
      await new Promise((r) => window.setTimeout(r, 80));
      if (clientDiscoverMapRef.current) return clientDiscoverMapRef.current;
    }
    return null;
  }

  const onClientMap =
    currentView === "client_map" && (meRole === "client" || meRole === "provider");

  useEffect(() => {
    const map = clientDiscoverMapRef.current;
    if (!map || !onClientMap) return;
    const lockMap = Boolean(clientBookModalOpen || clientFiltersOpen);
    try {
      if (lockMap) {
        map.behaviors.disable(["drag", "scrollZoom", "dblClickZoom", "multiTouch"]);
      } else {
        map.behaviors.enable(["drag", "scrollZoom", "dblClickZoom", "multiTouch"]);
      }
    } catch {
      // ignore
    }
  }, [clientBookModalOpen, clientFiltersOpen, onClientMap]);

  useEffect(() => {
    if (!onClientMap) return undefined;
    if (mapOrgPopup) {
      window.setTimeout(fitClientDiscoverMapViewport, 0);
      window.setTimeout(fitClientDiscoverMapViewport, 200);
    } else {
      window.setTimeout(fitClientDiscoverMapViewport, 0);
    }
    return undefined;
  }, [mapOrgPopup, mapOrgReviewsOpen, onClientMap]);

  useEffect(() => {
    if (!onClientMap) {
      destroyClientDiscoverMap();
      return undefined;
    }
    const t = setTimeout(() => {
      void loadYandexMaps()
        .then(() => {
          const ymaps = window.ymaps;
          if (!ymaps || clientDiscoverMapRef.current) return;
          if (!document.getElementById("client-discover-map")) return;
          ymaps.ready(() => {
            if (clientDiscoverMapRef.current) return;
            const cityKey = (new URLSearchParams(window.location.search).get("city") || "").toLowerCase();
            const cityCenters = {
              moscow: { center: [55.751244, 37.618423], zoom: 11, name: "Москва" },
              spb: { center: [59.9342802, 30.3350986], zoom: 11, name: "Санкт-Петербург" },
            };
            const city = cityCenters[cityKey];
            if (city?.name) setDetectedCity(city.name);
            const map = new ymaps.Map("client-discover-map", {
              center: city ? city.center : [55.751244, 37.618423],
              zoom: city ? city.zoom : 10,
              // Без дефолтного geolocationControl: он часто ставит метку по IP (вне города).
              controls: ["zoomControl", "fullscreenControl"],
            });
            clientDiscoverMapRef.current = map;
            attachBrowserGeolocationControl(ymaps, map);
            if (!map._vmesteZoomBound) {
              map._vmesteZoomBound = true;
              map.events.add("boundschange", () => {
                if (clientDiscoverMapZoomTimerRef.current) {
                  window.clearTimeout(clientDiscoverMapZoomTimerRef.current);
                }
                clientDiscoverMapZoomTimerRef.current = window.setTimeout(() => {
                  if (clientDiscoverMapRef.current) {
                    paintClientDiscoverMapMarkers(allLocationsRef.current, { fitView: false });
                  }
                }, 160);
              });
            }
            paintClientDiscoverMapMarkers(allLocationsRef.current, { fitView: !city });
            if (city) {
              try {
                map.setCenter(city.center, city.zoom);
              } catch {
                /* ignore */
              }
            }
            startClientMyLocationTracking();
          });
        })
        .catch(() => showToast("Не удалось загрузить карту.", { tone: "error" }));
    }, 280);
    return () => {
      clearTimeout(t);
      destroyClientDiscoverMap();
    };
  }, [onClientMap, setDetectedCity, allLocationsRef]);

  useEffect(() => {
    if (!onClientMap) return undefined;
    const id = window.setInterval(() => setMapMarkersTick((t) => t + 1), 60000);
    return () => window.clearInterval(id);
  }, [onClientMap]);

  useEffect(() => {
    if (!onClientMap || !clientDiscoverMapRef.current) return;
    paintClientDiscoverMapMarkers(allLocations, { fitView: true });
  }, [allLocations, onClientMap]);

  useEffect(() => {
    if (!onClientMap || !clientDiscoverMapRef.current) return;
    paintClientDiscoverMapMarkers(allLocations, { fitView: false });
  }, [mapMarkersTick, onClientMap]);

  useEffect(() => {
    if (!onClientMap || !clientDiscoverMapRef.current) return;
    paintClientDiscoverMapMarkers(allLocations, {
      fitView: false,
      selectedId: mapOrgPopup?.id ?? null,
    });
  }, [mapOrgPopup?.id, onClientMap]);

  return {
    clientDiscoverMapRef,
    mapMarkersTick,
    destroyClientDiscoverMap,
    paintClientDiscoverMapMarkers,
    fitClientDiscoverMapViewport,
    waitForClientDiscoverMap,
    startClientMyLocationTracking,
  };
}
