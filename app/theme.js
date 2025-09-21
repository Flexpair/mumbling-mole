// Direct SCSS imports; MiniCssExtractPlugin will emit proper CSS files.
import "../themes/MetroMumbleLight/loading.scss";
import "../themes/MetroMumbleLight/main.scss";
// Prevent tree-shaking to an empty module so smart-build sees a non-zero theme.js
// (CSS side-effects already extracted; this log runs once and is tiny in output.)
console && console.debug && console.debug('[theme] styles loaded');
