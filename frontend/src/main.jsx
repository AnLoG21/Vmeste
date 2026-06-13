import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import PublicEntry from "./PublicEntry.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PublicEntry />
  </StrictMode>
);
