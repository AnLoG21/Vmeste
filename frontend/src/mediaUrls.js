/** Full-size image URL from API field, string, or { url, image, thumb_url }. */
export function mediaFullUrl(item) {
  if (!item) return "";
  if (typeof item === "string") return item;
  return item.url || item.image || "";
}

/** Thumbnail URL — falls back to full when thumb is missing. */
export function mediaThumbUrl(item) {
  if (!item) return "";
  if (typeof item === "string") return item;
  return item.thumb_url || item.url || item.image || "";
}
