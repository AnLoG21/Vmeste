/** Minimal Yandex Maps stub for Playwright (cafe delivery map). */

export async function installYmapsStub(page) {
  await page.addInitScript(() => {
    window.ymaps = {
      ready(cb) {
        queueMicrotask(() => cb());
      },
      Map: class {
        constructor() {
          this._clickHandlers = [];
          this.geoObjects = {
            add() {},
            remove() {},
          };
          const self = this;
          this.events = {
            add(name, cb) {
              if (name === "click") self._clickHandlers.push(cb);
            },
            remove() {},
          };
          this.controls = { add() {}, remove() {} };
          this.margin = { setDefaultMargin() {} };
          window.__e2eYmapsMap = this;
        }
        destroy() {}
        setBounds() {}
        setCenter() {}
        getCenter() {
          return [55.75, 37.62];
        }
        getZoom() {
          return 12;
        }
      },
      Placemark: class {
        constructor() {
          this.events = { add() {}, remove() {} };
          this.geometry = {
            setCoordinates() {},
            getCoordinates() {
              return [55.5, 37.5];
            },
          };
        }
      },
      Polygon: class {
        constructor() {
          this.events = { add() {} };
        }
      },
      GeoObjectCollection: class {
        constructor() {
          this.events = { add() {} };
        }
        add() {}
        removeAll() {}
        getBounds() {
          return [
            [55.0, 37.0],
            [56.0, 38.0],
          ];
        }
      },
      Clusterer: class {
        constructor() {
          this.events = { add() {} };
        }
        add() {}
        removeAll() {}
      },
      control: {
        GeolocationControl: class {
          constructor() {
            this.events = { add() {} };
          }
        },
      },
      geocode() {
        return Promise.resolve({
          geoObjects: {
            get() {
              return null;
            },
            each() {},
          },
        });
      },
    };
  });
}

/** Simulate a map click at lat/lon (uses handlers registered by CafeGuestDeliveryMap). */
export async function clickYmapsAt(page, lat = 55.5, lon = 37.5) {
  await page.waitForFunction(() => Boolean(window.__e2eYmapsMap), null, { timeout: 15_000 });
  await page.evaluate(
    ({ lat, lon }) => {
      const map = window.__e2eYmapsMap;
      const evt = { get: (key) => (key === "coords" ? [lat, lon] : undefined) };
      (map._clickHandlers || []).forEach((cb) => cb(evt));
    },
    { lat, lon },
  );
}

/** Photon suggest/reverse response at a fixed lat/lon inside the test square zone. */
export async function installPhotonSuggest(page, { lat = 55.5, lon = 37.5, label = "ул. Зона, 1" } = {}) {
  const street = label.includes(",") ? label.split(",")[0].trim() : label;
  const housenumber = label.includes(",") ? label.split(",").slice(1).join(",").trim() : "";
  const body = JSON.stringify({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [lon, lat] },
        properties: {
          street,
          housenumber,
          name: label,
          country: "Russia",
        },
      },
    ],
  });

  await page.route("**/photon.komoot.io/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body,
    });
  });
}
