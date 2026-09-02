export function trimAddrSeg(s) {
  if (s == null || s === "") return "";
  return String(s).trim().replace(/\s+/g, " ");
}

export function composePipeTailFromDetails({ entrance, floor, apartment, intercom, extra }) {
  const details = [];
  if (entrance) details.push(`подъезд ${entrance}`);
  if (floor) details.push(`этаж ${floor}`);
  if (apartment) details.push(`кв. ${apartment}`);
  if (intercom) details.push(`домофон ${intercom}`);
  if (extra) details.push(extra);
  return details.join(", ");
}

/** Разбор хвоста после « | » при загрузке организации/старых филиалов. */
export function parseAddressDetailsPipeTail(tail) {
  const out = { entrance: "", floor: "", apartment: "", intercom: "", extraDetails: "" };
  const s = tail == null ? "" : String(tail).trim();
  if (!s) return out;
  const parts = s.split(",").map(trimAddrSeg).filter(Boolean);
  const extra = [];
  let matchedStructured = false;
  for (const p of parts) {
    if (/^подъезд\s+/i.test(p)) {
      out.entrance = p.replace(/^подъезд\s+/i, "").trim();
      matchedStructured = true;
    } else if (/^этаж\s+/i.test(p)) {
      out.floor = p.replace(/^этаж\s+/i, "").trim();
      matchedStructured = true;
    } else if (/^кв\.?\s+/i.test(p)) {
      out.apartment = p.replace(/^кв\.?\s+/i, "").trim();
      matchedStructured = true;
    } else if (/^домофон\s+/i.test(p)) {
      out.intercom = p.replace(/^домофон\s+/i, "").trim();
      matchedStructured = true;
    } else extra.push(p);
  }
  out.extraDetails = matchedStructured ? extra.join(", ") : parts.join(", ");
  return out;
}

export function composeBranchDisplay(br) {
  if (!br) return "";
  const tail = composePipeTailFromDetails({
    entrance: br.entrance,
    floor: br.floor,
    apartment: br.apartment,
    intercom: br.intercom,
    extra: br.address_details,
  });
  const base = br.address || "";
  return tail ? `${base} | ${tail}` : base;
}

export function parseBranchRecordForForm(br) {
  const raw = String(br.address || "").trim();
  const sep = " | ";
  const idx = raw.indexOf(sep);
  const base = idx >= 0 ? raw.slice(0, idx).trim() : raw;
  const tail = idx >= 0 ? raw.slice(idx + sep.length).trim() : "";
  const fromApi = {
    entrance: br.entrance || "",
    floor: br.floor || "",
    apartment: br.apartment || "",
    intercom: br.intercom || "",
    address_details: br.address_details || "",
  };
  const hasCol =
    fromApi.entrance || fromApi.floor || fromApi.apartment || fromApi.intercom || fromApi.address_details;
  if (!hasCol && tail) {
    const p = parseAddressDetailsPipeTail(tail);
    return {
      title: br.title || "",
      address: base,
      latitude: String(br.latitude ?? ""),
      longitude: String(br.longitude ?? ""),
      entrance: p.entrance,
      floor: p.floor,
      apartment: p.apartment,
      intercom: p.intercom,
      address_details: p.extraDetails,
    };
  }
  return {
    title: br.title || "",
    address: base,
    latitude: String(br.latitude ?? ""),
    longitude: String(br.longitude ?? ""),
    ...fromApi,
  };
}

export function emptyLocationFormState() {
  return {
    title: "",
    address: "",
    latitude: "55.751244",
    longitude: "37.618423",
    entrance: "",
    floor: "",
    apartment: "",
    intercom: "",
    address_details: "",
  };
}
