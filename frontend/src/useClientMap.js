import { useEffect, useRef, useState } from "react";
import { loadYandexMaps } from "./yandexMapsLoader.js";
import { buildYmapOrgPlacemark, resetOrgPinLayoutClass } from "./clientOrgFeatures.js";
import { hasCoords } from "./geoPosition.js";
import { showToast } from "./toast.js";

function geoErrorMessage(err) {
  if (!err) return "Не удалось получить геолокацию";
  if (err.code === 1) return "Разрешите доступ к геолокации в браузере";
  if (err.code === 2) return "Местоположение недоступно";
  if (err.code === 3) return "Таймаут геолокации — попробуйте ещё раз";
  return err.message || "Не удалось получить геолокацию";
}

function browserGetPosition(options) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Геолокация недоступна в этом браузере"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

/**
 * Client discover map. Org pins in orgLayer; my-location is a direct Placemark on the map
 * (same pattern as CafeOrderMapPin courier marker).
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
  const clientDiscoverMapClickBoundRef = useRef(false);
  const clientDiscoverMapZoomTimerRef = useRef(null);
  const clientMyLocationPlacemarkRef = useRef(null);
  const clientMyLocationCoordsRef = useRef(null);
  const clientCenteredOnMeRef = useRef(false);
  const [mapMarkersTick, setMapMarkersTick] = useState(0);
  const openOrgOnMapRef = useRef(openOrgOnMap);
  openOrgOnMapRef.current = openOrgOnMap;

  function destroyClientDiscoverMap() {
    clientMyLocationPlacemarkRef.current = null;
    clientMyLocationCoordsRef.current = null;
    clientCenteredOnMeRef.current = false;
    orgLayerRef.current = null;
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

  /** Поставить/сдвинуть метку «я» — как курьер в CafeOrderMapPin. */
  function setMyLocationPin(lat, lon, { center = true } = {}) {
    const ymaps = window.ymaps;
    const map = clientDiscoverMapRef.current;
    if (!ymaps || !map) return false;
    if (!hasCoords(lat, lon)) return false;
    const la = Number(lat);
    const lo = Number(lon);
    clientMyLocationCoordsRef.current = [la, lo];

    if (clientMyLocationPlacemarkRef.current) {
      try {
        clientMyLocationPlacemarkRef.current.geometry.setCoordinates([la, lo]);
      } catch {
        try {
          map.geoObjects.remove(clientMyLocationPlacemarkRef.current);
        } catch {
          /* ignore */
        }
        clientMyLocationPlacemarkRef.current = null;
      }
    }

    if (!clientMyLocationPlacemarkRef.current) {
      const pm = new ymaps.Placemark(
        [la, lo],
        { hintContent: "Вы здесь", balloonContent: "Моё местоположение" },
        { preset: "islands#blueCircleDotIcon" },
      );
      clientMyLocationPlacemarkRef.current = pm;
      map.geoObjects.add(pm);
    }

    if (center) {
      try {
        map.setCenter([la, lo], Math.max(map.getZoom(), 14), { duration: 250 });
        clientCenteredOnMeRef.current = true;
      } catch {
        /* ignore */
      }
    }
    return true;
  }

  /**
   * Явный клик пользователя (нужен жест браузеру).
   * Тот же путь, что кнопка «Обновить местоположение курьера».
   */
  async function locateMeNow() {
    const map = clientDiscoverMapRef.current;
    if (!map || !window.ymaps) {
      throw new Error("Карта ещё не загрузилась — подождите секунду");
    }

    let pos;
    try {
      pos = await browserGetPosition({
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      });
    } catch (err1) {
      try {
        pos = await browserGetPosition({
          enableHighAccuracy: false,
          timeout: 20000,
          maximumAge: 5000,
        });
      } catch (err2) {
        throw new Error(geoErrorMessage(err2 || err1));
      }
    }

    const lat = pos?.coords?.latitude;
    const lon = pos?.coords?.longitude;
    if (!hasCoords(lat, lon)) {
      throw new Error("Получены некорректные координаты");
    }

    const ok = setMyLocationPin(lat, lon, { center: true });
    if (!ok) throw new Error("Не удалось поставить метку на карту");
    return { lat: Number(lat), lon: Number(lon) };
  }

  function attachBrowserGeolocationControl(ymaps, map) {
    try {
      // provider=browser; placemark рисует сам Яндекс при клике по контролу.
      const geoControl = new ymaps.control.GeolocationControl({
        options: { provider: "browser" },
      });
      map.controls.add(geoControl);
      geoControl.events.add("locationchange", (e) => {
        const position = e.get("position");
        if (!Array.isArray(position) || position.length < 2) return;
        setMyLocationPin(position[0], position[1], { center: true });
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

    // Метка «я» лежит прямо на map.geoObjects — orgLayer.removeAll её не трогает.
    // Если вдруг сняли — восстановить из последних координат.
    if (clientMyLocationCoordsRef.current && !clientMyLocationPlacemarkRef.current) {
      setMyLocationPin(clientMyLocationCoordsRef.current[0], clientMyLocationCoordsRef.current[1], {
        center: false,
      });
    }

    if (!fitView) return;
    if (clientMyLocationCoordsRef.current && !clientCenteredOnMeRef.current) {
      try {
        map.setCenter(clientMyLocationCoordsRef.current, 14);
        clientCenteredOnMeRef.current = true;
      } catch {
        /* ignore */
      }
      return;
    }
    if (clientCenteredOnMeRef.current && clientMyLocationCoordsRef.current) return;
    if (coordsList.length === 1) {
      map.setCenter(coordsList[0], 14);
    } else if (coordsList.length > 1) {
      map.setBounds(ymaps.util.bounds.fromPoints(coordsList), { checkZoomRange: true, zoomMargin: 52 });
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
            map.geoObjects.add(orgLayer);
            orgLayerRef.current = orgLayer;
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
                    paintClientDiscoverMapMarkers(allLocationsRef.current || [], { fitView: false });
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
    const id = window.setInterval(() => setMapMarkersTick((tick) => tick + 1), 60000);
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
    locateMeNow,
  };
}
