import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { App } from "./App";
import { setUpFavicon } from "./favicon";

const disposeFavicon = setUpFavicon();
if (import.meta.hot) import.meta.hot.dispose(() => disposeFavicon());

const element = document.getElementById("root")!;
const root = import.meta.hot
  ? ((import.meta.hot.data as { root?: Root }).root ??= createRoot(element))
  : createRoot(element);

root.render(<StrictMode><App /></StrictMode>);
