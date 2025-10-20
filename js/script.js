const URL_COINS = "https://api.coinlore.net/api/tickers/";
const URL_EXCHANGES = "https://api.coinlore.net/api/exchanges/";

let coinsData = [];
let exchangesData = [];
let chco = null;
let chex = null;

function formatUSD(value) {
  const n = Number(value || 0);
  if (n >= 1_000_000_000) return "$" + (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(2) + "K";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function loadData() {
  try {
    const [coinsRes, exchangesRes] = await Promise.all([
      axios.get(URL_COINS),
      axios.get(URL_EXCHANGES)
    ]);

    coinsData = Array.isArray(coinsRes.data?.data) ? coinsRes.data.data : [];

    //  Obj numerado lo convertimos a array
    const rawEx = exchangesRes.data;
    if (Array.isArray(rawEx)) {
      exchangesData = rawEx;
    } else if (rawEx && typeof rawEx === "object") {
      exchangesData = Object.values(rawEx);
    } else {
      exchangesData = [];
    }

    renderDashboard();
  } catch (err) {
    console.error("Error al cargar datos:", err);
  } finally {
    document.getElementById("lastUpdate").textContent = new Date().toLocaleString();
  }
}

function renderDashboard() {
  renderStats();
  renderTables(coinsData, exchangesData);
  drawCharts();
}

function renderStats() {
  document.getElementById("totex").textContent = exchangesData.length;

  const precios = coinsData.map(c => Number(c.price_usd || 0));
  const mean = precios.reduce((a, b) => a + b, 0) / (precios.length || 1);
  document.getElementById("pricee").textContent = formatUSD(mean);

  if (coinsData.length) {
    const top = coinsData.reduce((max, c) =>
      Number(c.price_usd) > Number(max.price_usd) ? c : max
    );
    document.getElementById("topcoin").textContent = top.name;
  } else {
    document.getElementById("topcoin").textContent = "-";
  }
}

function renderTables(coins, exchanges) {
  const tbodyCoins = document.getElementById("tablamoneda");
  const tbodyEx = document.getElementById("exchanges");

  const coinsSorted = [...coins].sort((a, b) => a.rank - b.rank);
  tbodyCoins.innerHTML = coinsSorted.map((c, i) => `
    <tr>
      <td>${c.rank ?? i + 1}</td>
      <td>${c.name}</td>
      <td>${c.symbol}</td>
      <td>${c.symbol}</td>
      <td>${formatUSD(c.price_usd)}</td>
    </tr>
  `).join("");

  const exWithVol = exchanges
    .map(e => ({
      name: e.name,
      pairs: Array.isArray(e.pairs) ? e.pairs.length : "-",
      volume_usd: Number(e.volume_usd || 0)
    }))
    .filter(e => e.volume_usd > 0)
    .sort((a, b) => b.volume_usd - a.volume_usd);

  tbodyEx.innerHTML = exWithVol.map((e, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${e.name}</td>
      <td>${e.pairs}</td>
      <td>${e.pairs}</td>
      <td>${formatUSD(e.volume_usd)}</td>
    </tr>
  `).join("");
}

function drawCharts() {
  // --- COINS ---
  const topCoins = [...coinsData]
    .filter(c => !isNaN(c.price_usd))
    .sort((a, b) => b.price_usd - a.price_usd)
    .slice(0, 10);

  const ctxC = document.getElementById("chco").getContext("2d");
  if (chco) chco.destroy();
  chco = new Chart(ctxC, {
    type: "bar",
    data: {
      labels: topCoins.map(c => c.name),
      datasets: [{
        label: "Precio (USD)",
        data: topCoins.map(c => c.price_usd),
        backgroundColor: generateColors(10)
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      maintainAspectRatio: false
    }
  });

  // --- EXCHANGES ---
  const topEx = [...exchangesData]
    .map(e => ({
      name: e.name,
      volume_usd: Number(e.volume_usd || 0)
    }))
    .filter(e => e.volume_usd > 0)
    .sort((a, b) => b.volume_usd - a.volume_usd)
    .slice(0, 10);

  const ctxE = document.getElementById("chex").getContext("2d");
  if (chex) chex.destroy();
  chex = new Chart(ctxE, {
    type: "bar",
    data: {
      labels: topEx.map(e => e.name),
      datasets: [{
        label: "Volumen (USD)",
        data: topEx.map(e => e.volume_usd),
        backgroundColor: generateColors(10)
      }]
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      maintainAspectRatio: false
    }
  });
}

function generateColors(n) {
  const colors = [
    "#06b6d4","#0ea5e9","#6366f1","#a855f7","#ec4899",
    "#f43f5e","#f97316","#facc15","#84cc16","#22c55e"
  ];
  return Array.from({ length: n }, (_, i) => colors[i % colors.length]);
}

function initSearchers() {
  document.getElementById("buscarmoneda").addEventListener("input", e => {
    const q = e.target.value.toLowerCase();
    const filtered = coinsData.filter(c =>
      c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q)
    );
    renderTables(filtered, exchangesData);
  });

  document.getElementById("buscar").addEventListener("input", e => {
    const q = e.target.value.toLowerCase();
    const filtered = exchangesData.filter(ex =>
      ex.name.toLowerCase().includes(q)
    );
    renderTables(coinsData, filtered);
  });
}

function initReloadButton() {
  document.getElementById("reload").addEventListener("click", () => {
    document.getElementById("buscarmoneda").value = "";
    document.getElementById("buscar").value = "";
    loadData();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initSearchers();
  initReloadButton();
  loadData();
});

const el = (id) => document.getElementById(id);

const refresh = async () => {
  try {
    const res = await axios.get("https://api.coinlore.net/api/tickers/");
    const coinsData = res.data.data;

    // Actualiza tabla, gráficos, etc.
    // ...

    // Actualizar fecha de última actualización en el footer usando el timestamp de la API
    if(res.data.info && res.data.info.coins_date_updated) {
      // si la API tuviera un campo global de actualización
      const ts = res.data.info.coins_date_updated * 1000;
      const formatted = new Date(ts).toLocaleString('es-MX', { hour12: true });
      el("lastUpdateTime").textContent = formatted;
    } else {
      // si no hay campo global, usamos timestamp de la primera coin
      const ts = coinsData[0]?.last_updated ? coinsData[0].last_updated * 1000 : Date.now();
      el("lastUpdateTime").textContent = new Date(ts).toLocaleString('es-MX', { hour12: true });
    }
    
  } catch (err) {
    console.error("Error al cargar la API:", err);
    el("lastUpdateTime").textContent = "Error al actualizar";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  refresh();
  el("reload").addEventListener("click", refresh);
});

