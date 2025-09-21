import url from "url"; // (url imported previously; retained for potential dynamic theme path logic)

// normalizeHref: Handles loader export variance (string vs {default: string}) across
// sass-loader / file-loader versions so dynamic <link> insertion remains stable.
function normalizeHref(mod) {
  if (!mod) return mod;
  if (typeof mod === 'string') return mod;
  if (mod.default && typeof mod.default === 'string') return mod.default;
  return mod.toString();
}
var loadingTheme = normalizeHref(require("../themes/MetroMumbleLight/loading.scss"));
var mainTheme = normalizeHref(require("../themes/MetroMumbleLight/main.scss"));

function useStyle(url) {
  var style = document.createElement("link");
  style.rel = "stylesheet";
  style.type = "text/css";
  style.href = url;
  document.getElementsByTagName("head")[0].appendChild(style);
}
useStyle(loadingTheme);
useStyle(mainTheme);
