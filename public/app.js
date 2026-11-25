"use strict";

const $ = (id) => document.getElementById(id);
const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[character]));
const formatNumber = (value) => Number(value || 0).toLocaleString("en-US");
const compactNumber = (value) => new Intl.NumberFormat("en", {
  notation: "compact", maximumFractionDigits: 1
}).format(Number(value || 0));
const formatDateTime = (value) => value
  ? new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
  : "—";
const formatTime = (value) => new Date(value).toLocaleTimeString("en-GB", {
  hour: "2-digit", minute: "2-digit", hour12: false
});
const dateKey = (value) => new Date(value).toDateString();
const dateLabel = (value) => (dateKey(value) === new Date().toDateString() ? "Today" : new Date(value)
  .toLocaleDateString("en-GB", { day: "numeric", month: "short" }));
const hueFor = (value) => [...String(value)].reduce((total, character) =>
  (total * 31 + character.charCodeAt(0)) % 360, 7);
const normalizeName = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, "").replace(/s$/, "");
const normalizeMap = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, "");

let runs = [];
let rewards = [];
let itemIcons = [];
let mapIcons = [];
let currentFilter = "All";
let expandedRewards = false;
let latestReportAt = null;
let latestPlayer = null;
let latestBalances = "";
let latestRewards = [];
let periodTotal = 0;

const hiddenReward = /holiday star/i;
const hiddenRun = {
  test: (run) => /test notification/i.test(run.map || ""),
  unreadable: (run) => /^unknown$/i.test(run.map || "") && run.result !== "Defeat"
};
const balanceSlots = [
  { pattern: /^gems?$/i, label: "Gems", icon: "Gems" },
  { pattern: /^(gold|money|coins?)$/i, label: "Gold", icon: "Gold" },
  { pattern: /summer ?pearls?/i, label: "Summer Pearls", icon: "Summer Pearls" },
  { pattern: /trait.*reroll/i, label: "Trait Reroll", icon: "Trait Reroll" }
];
const fallbackIcons = [
  ["summer pearl", "pearl"], ["dawn coin", "coin"], ["coin", "coin"],
  ["gem", "gem"], ["money", "coin"], ["ore", "ore"],
  ["remnant", "shard"], ["portal", "portal"], ["potion", "potion"], ["talisman", "talisman"],
  ["sprig", "sprig"], ["tome", "tome"], ["ring", "ring"]
];

function lookupIcon(entries, label, normalizer) {
  const key = normalizer(label);
  return entries.find(([name]) => name === key)
    || entries.find(([name]) => key.length >= 4 && (
      (key.length >= 5 && name.includes(key)) || (name.length >= 5 && key.includes(name))
    ));
}

function itemImage(name) {
  const match = lookupIcon(itemIcons, name === "Money" ? "Gold" : name, normalizeName);
  if (match) return "/assets/items/" + match[1];
  const fallback = fallbackIcons.find(([term]) => String(name).toLowerCase().includes(term));
  return "/assets/" + (fallback ? fallback[1] : "chest") + ".svg";
}

function mapImage(name) {
  const fullName = normalizeMap(name);
  const baseName = normalizeMap(String(name).split("(")[0]);
  const match = mapIcons.find(([key]) => key === fullName) || mapIcons.find(([key]) => key === baseName);
  return match ? "/assets/maps/" + match[1] : "";
}

function selectedPeriodStart() {
  const period = $("periodFilter").value;
  if (period === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start;
  }
  if (period === "7d") return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return null;
}

function updateFilterOptions(id, values, label) {
  const select = $(id);
  const previous = select.value;
  const uniqueValues = [...new Set(values.filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  );
  select.innerHTML = '<option value="all">' + label + '</option>' +
    uniqueValues.map((value) => '<option value="' + escapeHTML(value) + '">' +
      escapeHTML(value) + '</option>').join("");
  select.value = uniqueValues.includes(previous) ? previous : "all";
}

function balanceFromReport(slot) {
  if (slot.icon === "Gems" || slot.icon === "Gold") {
    const emoji = slot.icon === "Gems" ? "💎" : "🪙";
    const match = String(latestBalances || "").match(new RegExp(emoji + "\\s*([\\d,]+)"));
    if (match) return Number(match[1].replace(/,/g, ""));
  }
  const latestReward = latestRewards.find((entry) =>
    slot.pattern.test(entry.item) && entry.total != null
  );
  if (latestReward) return Number(latestReward.total);
  return rewards.filter(([name]) => slot.pattern.test(name))
    .reduce((total, [, amount]) => total + Number(amount || 0), 0);
}

function renderBalances() {
  $("tiles").innerHTML = balanceSlots.map((slot) => {
    const amount = formatNumber(balanceFromReport(slot));
    return '<div class="balance-item"><img src="' + itemImage(slot.icon) +
      '" alt=""><div><strong>' + amount + '</strong><span>' + escapeHTML(slot.label) +
      '</span></div></div>';
  }).join("");
  attachImageFallbacks($("tiles"));
}

function renderStats(stats) {
  const total = Number(stats.total || 0);
  const wins = Number(stats.wins || 0);
  const losses = Number(stats.losses || 0);
  const winRate = total ? (100 * wins / total) : 0;
  $("total").textContent = formatNumber(total);
  $("wins").textContent = formatNumber(wins);
  $("losses").textContent = formatNumber(losses);
  $("rate").textContent = winRate.toFixed(1) + "%";
  $("rateSub").textContent = formatNumber(wins) + " / " + formatNumber(total);
  $("rateBar").style.width = Math.min(100, winRate) + "%";
}

function renderRewards() {
  const inventory = rewards.filter(([name]) =>
    !balanceSlots.some((slot) => slot.pattern.test(name))
  );
  $("itemCount").textContent = inventory.length + (inventory.length === 1 ? " item" : " items");
  $("items").hidden = inventory.length === 0;
  const visibleItems = expandedRewards ? inventory : inventory.slice(0, 9);
  $("rewards").innerHTML = visibleItems.map(([name, amount]) =>
    '<div class="reward-item" style="--item-color:hsl(' + hueFor(name) + ' 70% 62%)">' +
      '<strong>' + compactNumber(amount) + '</strong>' +
      '<img loading="lazy" src="' + itemImage(name) + '" alt="">' +
      '<span title="' + escapeHTML(name) + '">' + escapeHTML(name) + '</span></div>'
  ).join("") || '<div class="loading-state">No reward items recorded yet.</div>';
  $("moreItems").hidden = inventory.length <= 9;
  $("moreItems").textContent = expandedRewards ? "Show fewer rewards" : "View all rewards";
  attachImageFallbacks($("rewards"));
}

function renderEmptyState(title, message, hint) {
  return '<div class="empty-state"><span class="empty-mark" aria-hidden="true">✦</span>' +
    '<h3>' + title + '</h3><p>' + message + '</p>' +
    (hint ? '<span class="empty-hint">' + hint + '</span>' : "") + '</div>';
}

function renderRuns() {
  const query = $("search").value.trim().toLowerCase();
  const selectedMap = $("mapFilter").value;
  const selectedMode = $("modeFilter").value;
  const unreadCount = runs.filter((run) => hiddenRun.test(run) || hiddenRun.unreadable(run)).length;
  $("hiddenNote").textContent = unreadCount
    ? unreadCount + " unreadable or test reports are hidden from the timeline."
    : "";

  const visibleRuns = runs.filter((run) =>
    !hiddenRun.test(run) &&
    !(hiddenRun.unreadable(run) && run.result !== "Defeat") &&
    (currentFilter === "All" || run.result === currentFilter) &&
    (selectedMap === "all" || run.map === selectedMap) &&
    (selectedMode === "all" || run.mode === selectedMode) &&
    (String(run.map) + " " + String(run.player)).toLowerCase().includes(query)
  );
  const victories = visibleRuns.filter((run) => run.result === "Victory").length;
  const filtersActive = query || selectedMap !== "all" || selectedMode !== "all" || currentFilter !== "All";
  $("runCount").textContent = filtersActive
    ? visibleRuns.length + " matches · " + victories + " wins · " + periodTotal + " runs in period"
    : runs.length + " recent reports shown · " + periodTotal + " runs in period";

  if (runs.length === 0) {
    $("runs").innerHTML = renderEmptyState(
      "No farm reports yet",
      "When your Discord webhook posts a run report, it will appear here automatically.",
      "The dashboard is connected and waiting for its first report."
    );
    return;
  }
  if (visibleRuns.length === 0) {
    $("runs").innerHTML = renderEmptyState(
      "No matching runs",
      "Try a different search or switch the result filter to see more activity."
    );
    return;
  }

  let previousDay = "";
  const markup = visibleRuns.map((run) => {
    const isVictory = run.result === "Victory";
    const currentDay = dateKey(run.created_at);
    const divider = currentDay !== previousDay
      ? '<div class="day-divider">' + dateLabel(run.created_at) + '</div>'
      : "";
    previousDay = currentDay;

    const map = run.map || "Unknown map";
    const image = mapImage(map);
    const background = image
      ? 'background-image:linear-gradient(0deg,rgba(21,48,69,.74),rgba(21,48,69,.04) 76%),url(&quot;' +
        image + '&quot;)'
      : "";
    const mapArt = '<div class="map-art" role="img" aria-label="' + escapeHTML(map) +
      '" style="--map-hue:' + hueFor(map) + ';' + background + '"><span>' +
      escapeHTML(map) + '</span></div>';
    const resultLabel = isVictory ? "Victory" : "Defeat";
    const resultClass = isVictory ? "win" : "loss";
    const tags = [
      run.mode ? '<span class="run-tag">' + escapeHTML(run.mode) + '</span>' : "",
      run.difficulty ? '<span class="run-tag">' + escapeHTML(run.difficulty) + '</span>' : ""
    ].filter(Boolean).join("");
    const metadata = [
      run.wave ? "Wave " + escapeHTML(run.wave) : "",
      run.duration ? escapeHTML(run.duration) : "",
      formatTime(run.created_at)
    ].filter(Boolean).map((value) => "<span>" + value + "</span>").join("");
    const dropMarkup = (run.rewards || []).filter((entry) => !hiddenReward.test(entry.item))
      .slice(0, 4).map((entry) =>
        '<span class="reward-chip"><img src="' + itemImage(entry.item) + '" alt="">' +
        '<span>' + escapeHTML(entry.item) + '</span><b>×' +
        formatNumber(entry.amount) + '</b></span>'
      ).join("") || '<span class="reward-chip">No rewards recorded</span>';

    return divider + '<article class="run-card">' + mapArt + '<div class="run-content">' +
      '<div class="run-heading"><span class="run-result ' + resultClass + '">' +
      resultLabel + '</span><span class="run-map-name" title="' + escapeHTML(map) + '">' +
      escapeHTML(map) + '</span>' + tags + '</div>' +
      '<div class="run-meta">' + metadata + '</div>' +
      '<div class="reward-chips">' + dropMarkup + '</div></div></article>';
  }).join("");
  $("runs").innerHTML = markup;
  attachImageFallbacks($("runs"));
}

function renderChart() {
  const recentRuns = runs.slice(0, 40).reverse();
  if (recentRuns.length === 0) {
    $("chart").innerHTML = '<div class="chart-empty">Run results will appear here.</div>';
    return;
  }
  const step = 700 / recentRuns.length;
  const bars = recentRuns.map((run, index) => {
    const height = run.result === "Victory" ? 74 : 38;
    const fill = run.result === "Victory" ? "#58b190" : "#e18a91";
    return '<rect x="' + (index * step + 3) + '" y="' + (96 - height) +
      '" width="' + Math.max(3, step - 3) + '" height="' + height +
      '" rx="3" fill="' + fill + '" opacity=".92"></rect>';
  }).join("");
  $("chart").innerHTML =
    '<svg viewBox="0 0 700 104" preserveAspectRatio="none" role="img" aria-label="Recent run results">' +
    '<line x1="0" y1="96" x2="700" y2="96" stroke="#e2edf5"></line>' +
    '<line x1="0" y1="48" x2="700" y2="48" stroke="#edf3f8" stroke-dasharray="4 6"></line>' +
    bars + '</svg>';
}

const staleAfterMinutes = 40;
function renderReportAge() {
  if (!latestReportAt) {
    $("age").textContent = "Waiting for the first Discord report";
    $("age").classList.remove("stale");
    $("reportDot").className = "report-dot waiting";
    return;
  }
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(latestReportAt)) / 60000));
  const ageText = minutes < 1 ? "just now"
    : minutes < 60 ? minutes + (minutes === 1 ? " minute ago" : " minutes ago")
    : Math.floor(minutes / 60) + " hr " + (minutes % 60) + " min ago";
  const isStale = minutes > staleAfterMinutes;
  $("age").textContent = (isStale ? "No report for " : "Latest report ") + ageText;
  $("age").classList.toggle("stale", isStale);
  $("reportDot").className = "report-dot " + (isStale ? "stale" : "recent");
}

function renderFarmingPace() {
  const card = $("ratesCard");
  const hours = runs.length > 1
    ? (new Date(runs[0].created_at) - new Date(runs[runs.length - 1].created_at)) / 3600000
    : 0;
  card.hidden = hours < .25;
  if (card.hidden) return;

  $("rateNote").textContent = "Based on " + runs.length + " runs · " + hours.toFixed(1) + " hr";
  const amountFor = (pattern) => runs.reduce((sum, run) =>
    sum + (run.rewards || []).filter((entry) => pattern.test(entry.item))
      .reduce((runSum, entry) => runSum + Number(entry.amount || 0), 0), 0);
  const pace = ['<div class="pace-item"><strong>' + (runs.length / hours).toFixed(1) +
    '</strong><span>runs / hr</span></div>'];
  balanceSlots.forEach((slot) => {
    const amount = amountFor(slot.pattern);
    if (amount > 0) pace.push('<div class="pace-item"><strong>' +
      formatNumber(Math.round(amount / hours)) + '</strong><span>' +
      escapeHTML(slot.label) + ' / hr</span></div>');
  });
  $("rates").innerHTML = pace.join("");
}

function attachImageFallbacks(root) {
  root.querySelectorAll("img").forEach((image) => {
    image.onerror = () => {
      image.onerror = null;
      image.src = "/assets/chest.svg";
    };
  });
}

function renderDashboard(stats) {
  renderStats(stats);
  renderBalances();
  renderRewards();
  renderRuns();
  renderChart();
  renderFarmingPace();
}

async function loadDashboard() {
  try {
    const params = new URLSearchParams();
    const since = selectedPeriodStart();
    if (since) params.set("since", since.toISOString());
    const query = params.toString();
    const response = await fetch("/api/dashboard" + (query ? "?" + query : ""), {
      cache: "no-store"
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    runs = (data.runs || []).map((run) => ({
      ...run,
      map: String(run.map ?? "").replace(/^[#\s]+/, "").trim(),
      player: String(run.player ?? "").split(" · ")[0].trim()
    }));
    const mergedRewards = {};
    Object.entries(data.totals || {}).forEach(([name, amount]) => {
      if (hiddenReward.test(name)) return;
      const normalizedName = name.replace(/\s*\(limited\)\s*$/i, "");
      mergedRewards[normalizedName] = (mergedRewards[normalizedName] || 0) + Number(amount || 0);
    });
    rewards = Object.entries(mergedRewards).sort((left, right) => right[1] - left[1]);
    periodTotal = Number(data.stats?.total || 0);
    latestReportAt = data.lastReport || null;
    latestPlayer = data.lastPlayer || runs[0]?.player || null;
    latestBalances = data.lastBalances || "";
    latestRewards = Array.isArray(data.lastRewards) ? data.lastRewards : [];
    $("player").textContent = latestPlayer || "—";
    updateFilterOptions("mapFilter", runs.map((run) => run.map), "All maps");
    updateFilterOptions("modeFilter", runs.map((run) => run.mode), "All modes");
    renderReportAge();
    renderDashboard(data.stats || {});
  } catch (error) {
    $("age").textContent = "Report status unavailable";
    $("reportDot").className = "report-dot stale";
    $("runs").innerHTML = '<div class="empty-state compact"><h3>Could not load dashboard</h3><p>' +
      escapeHTML(error.message) + '</p><span class="empty-hint">Try refreshing in a moment.</span></div>';
    $("chart").innerHTML = '<div class="chart-empty">Activity data is unavailable.</div>';
  }
}

async function loadManifests() {
  const [itemResponse, mapResponse] = await Promise.all([
    fetch("/assets/items/manifest.json").catch(() => null),
    fetch("/assets/maps/manifest.json").catch(() => null)
  ]);
  if (itemResponse?.ok) {
    const manifest = await itemResponse.json().catch(() => ({}));
    itemIcons = Object.entries(manifest).map(([name, file]) => [normalizeName(name), file]);
  }
  if (mapResponse?.ok) {
    const manifest = await mapResponse.json().catch(() => ({}));
    mapIcons = Object.entries(manifest).map(([name, file]) => [normalizeMap(name), file]);
  }
  renderBalances();
  renderRewards();
  renderRuns();
  renderChart();
  renderFarmingPace();
}

$("search").addEventListener("input", renderRuns);
$("periodFilter").addEventListener("change", loadDashboard);
$("mapFilter").addEventListener("change", renderRuns);
$("modeFilter").addEventListener("change", renderRuns);
$("chips").addEventListener("click", (event) => {
  const button = event.target.closest(".filter-chip");
  if (!button) return;
  currentFilter = button.dataset.f;
  document.querySelectorAll(".filter-chip").forEach((chip) => {
    const selected = chip === button;
    chip.classList.toggle("on", selected);
    chip.setAttribute("aria-pressed", String(selected));
  });
  renderRuns();
});
$("refresh").addEventListener("click", loadDashboard);
$("moreItems").addEventListener("click", () => {
  expandedRewards = !expandedRewards;
  renderRewards();
});
$("clear").addEventListener("click", async () => {
  if (!confirm("Clear all run history and statistics? This cannot be undone.")) return;
  if (!confirm("Confirm once more: all run data will be permanently deleted.")) return;
  try {
    const response = await fetch("/api/clear", {
      method: "POST", headers: { "x-confirm": "clear" }
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    await loadDashboard();
  } catch (error) {
    alert("Could not clear history: " + error.message);
  }
});

function setConnection(label, state) {
  $("connection").textContent = label;
  $("dot").className = "connection-dot" + (state ? " " + state : "");
}
const socket = typeof io === "function" ? io() : null;
if (socket) {
  socket.on("connect", () => { setConnection("Live updates on", "online"); loadDashboard(); });
  socket.on("disconnect", () => setConnection("Live updates offline", "offline"));
  socket.on("connect_error", () => setConnection("API mode", ""));
} else {
  setConnection("API mode", "");
}
loadManifests();
loadDashboard();
setInterval(renderReportAge, 30000);
setInterval(loadDashboard, 60000);

