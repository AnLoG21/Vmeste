import { useEffect, useRef, useState } from "react";
import { loadYandexMaps } from "./yandexMapsLoader.js";
import { buildYmapOrgPlacemark, resetOrgPinLayoutClass } from "./clientOrgFeatures.js";
import { getDevicePosition } from "./geoPosition.js";
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
  const clientMyLocationCoordsRef = useRef(null);
  const clientMyLocationWatchIdRef = useRef(null);
  const clientCenteredOnMeRef = useRef(false);
  const [mapMarkersTick, setMapMarkersTick] = useState(0);
  const openOrgOnMapRef = useRef(openOrgOnMap);
  openOrgOnMapRef.current = openOrgOnMap;

  function destroyClientDiscoverMap() {
    if (clientMyLocationWatchIdRef.current != null && navigator.geolocation?.clearWatch) {
      try {
        navigator.geolocation.clearWatch(clientMyLocationWatchIdRef.current);
      } catch {
        /* ignore */
      }
      clientMyLocationWatchIdRef.current = null;
    }
    clientMyLocationPlacemarkRef.current = null;
    clientMyLocationCoordsRef.current = null;
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

  function ensureClientMyLocationMarker(coords, { center = false } = {}) {
    const ymaps = window.ymaps;
    const map = clientDiscoverMapRef.current;
    if (!ymaps || !map || !coords) return;
    const [lat, lon] = coords;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    clientMyLocationCoordsRef.current = [lat, lon];
    if (clientMyLocationPlacemarkRef.current) {
      try {
        clientMyLocationPlacemarkRef.current.geometry.setCoordinates([lat, lon]);
      } catch {
        /* ignore */
      }
      try {
        map.geoObjects.remove(clientMyLocationPlacemarkRef.current);
      } catch {
        /* ignore */
      }
      try {
        map.geoObjects.add(clientMyLocationPlacemarkRef.current);
      } catch {
        /* ignore */
      }
      if (center) maybeCenterOnMe([lat, lon]);
      return;
    }
    const layout = ymaps.templateLayoutFactory.createClass(
      `<div class="ymap-me-pin" title="Вы здесь">
        <span class="ymap-me-pin__halo"></span>
        <span class="ymap-me-pin__dot"></span>
      </div>`,
    );
    const pm = new ymaps.Placemark(
      [lat, lon],
      { hintContent: "Вы здесь", balloonContent: "Моё местоположение" },
      {
        iconLayout: layout,
        iconShape: { type: "Circle", coordinates: [0, 0], radius: 18 },
        zIndex: 900,
        zIndexHover: 900,
      },
    );
    clientMyLocationPlacemarkRef.current = pm;
    map.geoObjects.add(pm);
    if (center) maybeCenterOnMe([lat, lon]);
  }

  async function startClientMyLocationTracking() {
    if (clientMyLocationWatchIdRef.current != null) return;
    try {
      const pos = await getDevicePosition();
      if (pos && Number.isFinite(pos.lat) && Number.isFinite(pos.lon)) {
        ensureClientMyLocationMarker([pos.lat, pos.lon], { center: true });
      }
    } catch {
      /* permission denied / unavailable */
    }
    if (!navigator.geolocation) return;
    const apply = (pos) => {
      const lat = pos?.coords?.latitude;
      const lon = pos?.coords?.longitude;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      ensureClientMyLocationMarker([lat, lon], { center: !clientCenteredOnMeRef.current });
    };
    try {
      clientMyLocationWatchIdRef.current = navigator.geolocation.watchPosition(
        apply,
        () => {},
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 15000 },
      );
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
      ensureClientMyLocationMarker(clientMyLocationCoordsRef.current);
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
              controls: ["zoomControl", "fullscreenControl", "geolocationControl"],
            });
            clientDiscoverMapRef.current = map;
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
