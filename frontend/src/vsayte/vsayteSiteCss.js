/** Общие CSS взаимодействия (hover/focus) для холста и публикации */

export const VSAYTE_INTERACTIVE_CSS = `
.vs-btn{
  display:inline-block;
  text-decoration:none;
  font-weight:600;
  cursor:pointer;
  line-height:1.2;
  transition:transform .15s ease,opacity .15s ease,box-shadow .15s ease,background .15s ease,filter .15s ease,border-color .15s ease,color .15s ease;
}
.vs-btn[data-hover="lift"]:hover{opacity:.95;transform:translateY(-2px);box-shadow:0 12px 28px rgba(0,0,0,.14)}
.vs-btn[data-hover="glow"]:hover{box-shadow:0 0 0 4px color-mix(in srgb,currentColor 22%,transparent)}
.vs-btn[data-hover="darken"]:hover{filter:brightness(.9)}
.vs-btn[data-hover="brighten"]:hover{filter:brightness(1.08)}
.vs-btn[data-hover="press"]:hover{transform:translateY(1px);box-shadow:none;opacity:.95}
.vs-btn[data-hover="none"]:hover{transform:none;filter:none}
.vs-btn:focus-visible{outline:2px solid #FF7A00;outline-offset:3px}
.vs-input,.vs-textarea,.vs-select{
  transition:border-color .15s ease,box-shadow .15s ease;
}
.vs-input:focus,.vs-textarea:focus,.vs-select:focus{
  border-color:#FF7A00 !important;
  box-shadow:0 0 0 3px rgba(255,122,0,.18);
  outline:none;
}
.vs-check input{accent-color:#FF7A00}
a[href]:not(.vs-btn){transition:color .15s ease,opacity .15s ease}
a[href]:not(.vs-btn):hover{opacity:.85}
`;

export function ensureInteractiveCss(css = "") {
  const body = css || "";
  if (body.includes(".vs-btn[data-hover=")) return body;
  return `${body}\n${VSAYTE_INTERACTIVE_CSS}`;
}

export function defaultSiteSettings(meta = {}, siteTitle = "") {
  const site = meta?.site || {};
  return {
    name: site.name || siteTitle || "",
    favicon: site.favicon || "",
    ogImage: site.ogImage || "",
    ogTitle: site.ogTitle || "",
    ogDescription: site.ogDescription || "",
    customCss: site.customCss || "",
  };
}
