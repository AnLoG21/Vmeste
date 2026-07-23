import { useEffect } from "react";

/**
 * Injects JSON-LD into document head. Replaces previous script with same id.
 */
export default function JsonLd({ id = "vmeste-jsonld", data }) {
  useEffect(() => {
    if (!data || typeof document === "undefined") return undefined;
    const scriptId = id;
    let el = document.getElementById(scriptId);
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = scriptId;
      document.head.appendChild(el);
    }
    el.text = JSON.stringify(data);
    return () => {
      const node = document.getElementById(scriptId);
      if (node) node.remove();
    };
  }, [id, data]);

  return null;
}
