import { useEffect, useRef, useState } from "react";
import { loadYandexMaps } from "./yandexMapsLoader.js";
import { buildYmapOrgPlacemark, resetOrgPinLayoutClass } from "./clientOrgFeatures.js";
import { getDevicePosition, hasCoords } from "./geoPosition.js";
import { showToast } from "./toast.js";

/**
 * Client discover map: Yandex init/destroy, placemarks, my-location tracking.
 * Org pins live in orgLayer; my-location lives in meLayer (never wiped by paint).
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
  const orgLayerRef = useRef(null);
  const meLayerRef = useRef(null);
  const clientDiscoverMapClickBoundRef = useRef(false);
  const clientDiscoverMapZoomTimerRef = useRef(null);
  const clientMyLocationPlacemarkRef = useRef(null);
  const clientMyLocationAccuracyRef = useRef(null);
  const clientMyLocationCoordsRef = useRef(null);
  const clientMyLocationMetaRef = useRef(null);
  const clientMyLocationWatchIdRef = useRef(null);
  const clientCenteredOnMeRef = useRef(false);
  const geoStartedRef = useRef(false);
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
    geoStartedRef.current = false;
  }

  function destroyClientDiscoverMap() {
    clearMyLocationWatch();
    clientMyLocationPlacemarkRef.current = null;
    clientMyLocationAccuracyRef.current = null;
    clientMyLocationCoordsRef.current = null;
    clientMyLocationMetaRef.current = null;
    clientCenteredOnMeRef.current = false;
    orgLayerRef.current = null;
    meLayerRef.current = null;
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
      map.setCenter([lat, lon], 14, { duration: 280 });
      clientCenteredOnMeRef.current = true;
    } catch {
      /* ignore */
    }
  }

  function ensureClientMyLocationMarker(coords, { center = false, accuracy = null } = {}) {
    const ymaps = window.ymaps;
    const map = clientDiscoverMapRef.current;
    const meLayer = meLayerRef.current;
    if (!ymaps || !map || !meLayer || !coords) return;
    const [lat, lon] = coords;
    if (!hasCoords(lat, lon)) return;

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
      if (acc > prev.accuracy * 1.75 && acc > 80 && ageMs < 90_000) {
        return;
      }
    }

    clientMyLocationCoordsRef.current = [Number(lat), Number(lon)];
    clientMyLocationMetaRef.current = {
      accuracy: hasAcc ? acc : prev?.accuracy ?? null,
      at: Date.now(),
    };

    if (clientMyLocationPlacemarkRef.current) {
      try {
        clientMyLocationPlacemarkRef.current.geometry.setCoordinates([Number(lat), Number(lon)]);
      } catch {
        /* ignore */
      }
    } else {
      // Как курьер: CafeOrderMapPin islands#blueCircleDotIcon
      const pm = new ymaps.Placemark(
        [Number(lat), Number(lon)],
        { hintContent: "Вы здесь", balloonContent: "Моё местоположение" },
        { preset: "islands#blueCircleDotIcon", zIndex: 1000, zIndexHover: 1000 },
      );
      clientMyLocationPlacemarkRef.current = pm;
      try {
        meLayer.add(pm);
      } catch {
        try {
          map.geoObjects.add(pm);
        } catch {
          /* ignore */
        }
      }
    }

    if (hasAcc) {
      const radius = Math.max(25, Math.min(acc, 350));
      if (clientMyLocationAccuracyRef.current) {
        try {
          clientMyLocationAccuracyRef.current.geometry.setCoordinates([
            [Number(lat), Number(lon)],
            radius,
          ]);
        } catch {
          /* ignore */
        }
      } else {
        try {
          const circle = new ymaps.Circle(
            [[Number(lat), Number(lon)], radius],
            {},
            {
              fillColor: "rgba(26, 115, 232, 0.12)",
              strokeColor: "#1a73e8",
              strokeOpacity: 0.35,
              strokeWidth: 1,
              zIndex: 40,
            },
          );
          clientMyLocationAccuracyRef.current = circle;
          meLayer.add(circle);
        } catch {
          /* ignore */
        }
      }
    }

    if (center) maybeCenterOnMe([Number(lat), Number(lon)]);
  }

  function applyGeoPosition(lat, lon, accuracy, { center = false, source = "" } = {}) {
    if (!hasCoords(lat, lon)) return;
    if (String(source) === "yandex:yandex") return;
    ensureClientMyLocationMarker([Number(lat), Number(lon)], {
      center,
      accuracy,
    });
  }

  /** Не блокируем watch долгими await — иначе метка так и не появляется. */
  function startClientMyLocationTracking() {
    if (geoStartedRef.current) return;
    geoStartedRef.current = true;

    const onWatch = (pos) => {
      applyGeoPosition(pos?.coords?.latitude, pos?.coords?.longitude, pos?.coords?.accuracy, {
        center: !clientCenteredOnMeRef.current,
        source: "browser-watch",
      });
    };

    if (navigator.geolocation) {
      try {
        // Сразу network/Wi‑Fi — на десктопе GPS часто не отвечает.
        clientMyLocationWatchIdRef.current = navigator.geolocation.watchPosition(onWatch, () => {}, {
          enableHighAccuracy: false,
          timeout: 20000,
          maximumAge: 10000,
        });
      } catch {
        clientMyLocationWatchIdRef.current = null;
      }

      // Параллельно одна точная попытка (не ждём её для старта watch).
      try {
        navigator.geolocation.getCurrentPosition(
          onWatch,
          () => {},
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
        );
      } catch {
        /* ignore */
      }
    }

    // Параллельно общий хелпер (как у курьера), без IP.
    void getDevicePosition({ force: true, allowIpFallback: false })
      .then((pos) => {
        if (!pos) return;
        applyGeoPosition(pos.lat, pos.lon, pos.accuracy, {
          center: !clientCenteredOnMeRef.current,
          source: pos.source,
        });
      })
      .catch(() => {});

    // И ymaps browser-provider (как CafeGuestDeliveryMap).
    void (async () => {
      try {
        const ymaps = window.ymaps;
        if (!ymaps?.geolocation?.get) return;
        const result = await ymaps.geolocation.get({
          provider: "browser",
          autoReverseGeocode: false,
          mapStateAutoApply: false,
        });
        const coords = result?.geoObjects?.get?.(0)?.geometry?.getCoordinates?.();
        if (Array.isArray(coords) && coords.length >= 2) {
          applyGeoPosition(coords[0], coords[1], null, {
            center: !clientCenteredOnMeRef.current,
            source: "yandex:browser",
          });
        }
      } catch {
        /* ignore */
      }
    })();
  }

  function attachBrowserGeolocationControl(ymaps, map) {
    try {
      const geoControl = new ymaps.control.GeolocationControl({
        options: { provider: "browser", noPlacemark: true },
      });
      map.controls.add(geoControl);
      geoControl.events.add("locationchange", (e) => {
        const position = e.get("position");
        if (!Array.isArray(position) || position.length < 2) return;
        applyGeoPosition(position[0], position[1], null, { center: true, source: "geo-control" });
      });
    } catch {
      /* ignore */
    }
  }

  function paintClientDiscoverMapMarkers(locations, { fitView = false, selectedId = null } = {}) {
    const ymaps = window.ymaps;
    const map = clientDiscoverMapRef.current;
    const orgLayer = orgLayerRef.current;
    if (!ymaps || !map || !orgLayer || !Array.isArray(locations)) return;

    if (!clientDiscoverMapClickBoundRef.current) {
      clientDiscoverMapClickBoundRef.current = true;
      orgLayer.events.add("click", (e) => {
        const target = e.get("target");
        const loc = target?.properties?.get?.("vmesteLoc");
        if (loc) openOrgOnMapRef.current?.(loc);
      });
    }

    const zoom = map.getZoom();
    const selected = selectedId != null ? selectedId : mapOrgPopup?.id;
    // Важно: чистим только слой организаций — метка «я» в meLayer не трогается.
    orgLayer.removeAll();
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
      orgLayer.add(pm);
      coordsList.push([lat, lon]);
    }

    if (!clientMyLocationCoordsRef.current) {
      startClientMyLocationTracking();
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
              controls: ["zoomControl", "fullscreenControl"],
            });
            const orgLayer = new ymaps.GeoObjectCollection();
            const meLayer = new ymaps.GeoObjectCollection();
            map.geoObjects.add(orgLayer);
            map.geoObjects.add(meLayer);
            orgLayerRef.current = orgLayer;
            meLayerRef.current = meLayer;
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
            paintClientDiscoverMapMarkers(allLocationsRef.current || [], { fitView: !city });
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
    paintClientDiscoverMapMarkers(allLocations || [], { fitView: true });
  }, [allLocations, onClientMap]);

  useEffect(() => {
    if (!onClientMap || !clientDiscoverMapRef.current) return;
    paintClientDiscoverMapMarkers(allLocations || [], { fitView: false });
  }, [mapMarkersTick, onClientMap]);

  useEffect(() => {
    if (!onClientMap || !clientDiscoverMapRef.current) return;
    paintClientDiscoverMapMarkers(allLocations || [], {
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
