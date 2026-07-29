// ---------- Data ----------
const CROP_TYPES = [
  { name: "Wheat", color: "#C9A227" },
  { name: "Barley", color: "#B8860B" },
  { name: "White Clover", color: "#3D6B4A" },
  { name: "Ryegrass", color: "#5A7D3C" },
  { name: "Grass Seed", color: "#7A9D54" },
  { name: "Peas", color: "#4F7942" },
  { name: "Lucerne", color: "#6E8B3D" },
  { name: "Quinoa", color: "#A6693B" },
  { name: "Fallow", color: "#8A8375" },
  { name: "Other", color: "#6B5B4F" },
];
const CROP_COLOR = Object.fromEntries(CROP_TYPES.map((c) => [c.name, c.color]));

const EXPENSE_CATEGORIES = [
  "Seed", "Fertiliser", "Nitrogen", "Chemical/Spray", "Irrigation", "Fuel", "Contractor",
  "Harvesting", "Repairs & Maintenance", "Freight", "Other",
];

const GST_RATE = 0.15;
const STORAGE_KEY = "farm-ledger-data";

// ---------- State ----------
let state = { paddocks: [], expenses: [] };
let tab = "overview";
let filterPaddock = "all";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = JSON.parse(raw);
  } catch (e) {
    console.error("Failed to load saved data:", e);
  }
}
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setSaveStatus(true);
  } catch (e) {
    console.error("Failed to save data:", e);
    setSaveStatus(false);
  }
}
function setSaveStatus(ok) {
  const el = document.getElementById("save-banner");
  if (!el) return;
  el.style.display = ok ? "none" : "block";
}

const uid = () => Math.random().toString(36).slice(2, 10);
const fmtMoney = (n) =>
  (n || 0).toLocaleString("en-NZ", { style: "currency", currency: "NZD", maximumFractionDigits: 0 });
const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-NZ", { day: "2-digit", month: "short", year: "numeric" });
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- Derived ----------
function totalHa() { return state.paddocks.reduce((s, p) => s + Number(p.hectares || 0), 0); }
function totalSpend() { return state.expenses.reduce((s, e) => s + Number(e.amountExGst || 0) * (1 + GST_RATE), 0); }
function totalGst() { return state.expenses.reduce((s, e) => s + Number(e.amountExGst || 0) * GST_RATE, 0); }
function spendByPaddock() {
  const m = {};
  for (const e of state.expenses) m[e.paddockId] = (m[e.paddockId] || 0) + Number(e.amountExGst || 0) * (1 + GST_RATE);
  return m;
}
function spendByCategory() {
  const m = {};
  for (const e of state.expenses) m[e.category] = (m[e.category] || 0) + Number(e.amountExGst || 0) * (1 + GST_RATE);
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

// ---------- Mutations ----------
function addPaddock(p) { state.paddocks.push({ id: uid(), ...p }); saveState(); render(); }
function updatePaddock(id, changes) {
  state.paddocks = state.paddocks.map((p) => (p.id === id ? { ...p, ...changes } : p));
  saveState(); render();
}
function deletePaddock(id) {
  state.paddocks = state.paddocks.filter((p) => p.id !== id);
  state.expenses = state.expenses.filter((e) => e.paddockId !== id);
  saveState(); render();
}
function addExpense(e) { state.expenses.push({ id: uid(), ...e }); saveState(); render(); }
function updateExpense(id, changes) {
  state.expenses = state.expenses.map((e) => (e.id === id ? { ...e, ...changes } : e));
  saveState(); render();
}
function deleteExpense(id) { state.expenses = state.expenses.filter((e) => e.id !== id); saveState(); render(); }

// ---------- Rendering ----------
function render() {
  document.getElementById("total-ha").textContent = totalHa().toFixed(1) + " ha";
  document.getElementById("total-spend").textContent = fmtMoney(totalSpend());
  renderStrip();
  renderTabs();
  document.getElementById("main").innerHTML =
    tab === "overview" ? renderOverview() :
    tab === "paddocks" ? renderPaddocks() :
    renderExpenses();
  attachMainListeners();
}

function renderStrip() {
  const wrap = document.getElementById("strip-wrap");
  if (state.paddocks.length === 0) { wrap.innerHTML = ""; return; }
  const bars = state.paddocks.map((p) =>
    `<div title="${esc(p.name)} — ${p.hectares} ha — ${esc(p.crop)}" style="flex-grow:${Number(p.hectares) || 1}; background:${CROP_COLOR[p.crop] || "#3A3F3F"}; min-width:24px;"></div>`
  ).join("");
  const usedCrops = CROP_TYPES.filter((c) => state.paddocks.some((p) => p.crop === c.name));
  const legend = usedCrops.map((c) =>
    `<div style="display:flex;align-items:center;gap:6px;font-family:var(--data-font);font-size:11px;color:#6B6656;">
      <div style="width:9px;height:9px;background:${c.color};border-radius:2px;"></div>${esc(c.name)}
    </div>`
  ).join("");
  wrap.innerHTML = `
    <div style="display:flex;height:40px;border-radius:3px;overflow:hidden;border:1px solid var(--line);">${bars}</div>
    <div style="display:flex;gap:16px;margin-top:8px;flex-wrap:wrap;">${legend}</div>`;
}

function renderTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    const active = btn.dataset.tab === tab;
    btn.style.borderBottom = active ? "2px solid #2F4A3C" : "2px solid transparent";
    btn.style.color = active ? "#2F4A3C" : "#8A8578";
  });
}

function cropOptions(selected) {
  return CROP_TYPES.map((c) => `<option value="${esc(c.name)}" ${c.name === selected ? "selected" : ""}>${esc(c.name)}</option>`).join("");
}
function catOptions(selected) {
  return EXPENSE_CATEGORIES.map((c) => `<option value="${esc(c)}" ${c === selected ? "selected" : ""}>${esc(c)}</option>`).join("");
}
function paddockOptions(selected) {
  return state.paddocks.map((p) => `<option value="${p.id}" ${p.id === selected ? "selected" : ""}>${esc(p.name)}</option>`).join("");
}

function emptyState(text) {
  return `<div class="card" style="text-align:center;padding:40px;color:#8A8578;">
    <div style="font-size:22px;margin-bottom:10px;">🌱</div>
    <div style="font-size:14px;">${esc(text)}</div>
  </div>`;
}

function renderOverview() {
  if (state.paddocks.length === 0) return emptyState("No paddocks yet. Add one from the Paddocks tab to start tracking costs.");
  const sbp = spendByPaddock();
  const cards = state.paddocks.map((p) => {
    const spend = sbp[p.id] || 0;
    const perHa = p.hectares > 0 ? spend / p.hectares : 0;
    return `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="font-family:var(--display-font);font-size:19px;">${esc(p.name)}</div>
          <div style="font-family:var(--data-font);font-size:11px;color:#8A8578;margin-top:2px;">${p.hectares} ha · ${esc(p.crop)}</div>
        </div>
        <div style="width:10px;height:10px;border-radius:2px;background:${CROP_COLOR[p.crop]};margin-top:4px;"></div>
      </div>
      <div style="margin-top:16px;font-family:var(--data-font);">
        <div style="font-size:22px;">${fmtMoney(perHa)}<span style="font-size:12px;color:#8A8578;"> /ha</span></div>
        <div style="font-size:12px;color:#8A8578;margin-top:2px;">${fmtMoney(spend)} total (incl GST)</div>
      </div>
    </div>`;
  }).join("");

  const cats = spendByCategory();
  const maxCat = cats[0]?.[1] || 1;
  const catRows = cats.length === 0
    ? `<div style="font-size:13px;color:#8A8578;">No expenses logged yet.</div>`
    : cats.map(([cat, amt]) => `
      <div>
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
          <span>${esc(cat)}</span><span style="font-family:var(--data-font);">${fmtMoney(amt)}</span>
        </div>
        <div style="background:var(--line);height:6px;border-radius:3px;">
          <div style="width:${(amt / maxCat) * 100}%;background:#2F4A3C;height:6px;border-radius:3px;"></div>
        </div>
      </div>`).join("");

  return `
    <div style="display:grid;gap:16px;">
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:16px;">${cards}</div>
      <div class="card">
        <div style="font-family:var(--data-font);font-size:11px;letter-spacing:0.1em;color:#8A8578;text-transform:uppercase;margin-bottom:14px;">Spend by category</div>
        <div style="display:grid;gap:10px;">${catRows}</div>
        <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--line);display:flex;justify-content:space-between;font-family:var(--data-font);font-size:13px;color:#8A8578;">
          <span>GST component</span><span>${fmtMoney(totalGst())}</span>
        </div>
      </div>
    </div>`;
}

function renderPaddocks() {
  const header = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
    <div style="font-family:var(--display-font);font-size:20px;">Paddocks</div>
    <button class="btn-add" id="add-paddock-btn">+ Add paddock</button>
  </div>`;
  if (state.paddocks.length === 0) return header + emptyState("No paddocks recorded. Add your first one to begin allocating costs.");
  const sbp = spendByPaddock();
  const rows = state.paddocks.map((p) => `
    <div class="card edit-paddock" data-id="${p.id}" style="display:flex;align-items:center;justify-content:space-between;padding:16px;cursor:pointer;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:10px;height:10px;border-radius:2px;background:${CROP_COLOR[p.crop]};"></div>
        <div>
          <div style="font-size:15px;">${esc(p.name)}</div>
          <div style="font-family:var(--data-font);font-size:11px;color:#8A8578;">${p.hectares} ha · ${esc(p.crop)}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:16px;">
        <div style="font-family:var(--data-font);font-size:13px;">${fmtMoney(sbp[p.id] || 0)}</div>
        <button class="icon-btn delete-paddock" data-id="${p.id}" aria-label="Delete ${esc(p.name)}">✕</button>
      </div>
    </div>`).join("");
  return header + `<div style="display:grid;gap:8px;">${rows}</div>`;
}

function renderExpenses() {
  const header = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
    <div style="font-family:var(--display-font);font-size:20px;">Expenses</div>
    <div style="display:flex;gap:10px;align-items:center;">
      <select id="filter-paddock" class="field" style="width:auto;">
        <option value="all" ${filterPaddock === "all" ? "selected" : ""}>All paddocks</option>
        ${paddockOptions(filterPaddock === "all" ? null : filterPaddock)}
      </select>
      <button class="btn-add" id="add-expense-btn" ${state.paddocks.length === 0 ? "disabled" : ""}>+ Add expense</button>
    </div>
  </div>`;

  if (state.paddocks.length === 0) return header + emptyState("Add a paddock first — expenses need somewhere to be allocated.");

  const list = filterPaddock === "all" ? state.expenses : state.expenses.filter((e) => e.paddockId === filterPaddock);
  const sorted = [...list].sort((a, b) => new Date(b.date) - new Date(a.date));
  if (sorted.length === 0) return header + emptyState("No expenses logged yet.");

  const rows = sorted.map((e) => {
    const p = state.paddocks.find((pp) => pp.id === e.paddockId);
    const exGst = Number(e.amountExGst || 0);
    const gst = exGst * GST_RATE;
    return `<tr class="edit-expense" data-id="${e.id}" style="cursor:pointer;">
      <td>${fmtDate(e.date)}</td>
      <td>${esc(p ? p.name : "—")}</td>
      <td>${esc(e.category)}</td>
      <td class="mono">${fmtMoney(exGst)}</td>
      <td class="mono" style="color:#8A8578;">${fmtMoney(gst)}</td>
      <td class="mono">${fmtMoney(exGst + gst)}</td>
      <td style="color:#6B6656;max-width:160px;">${esc(e.notes)}</td>
      <td><button class="icon-btn delete-expense" data-id="${e.id}" aria-label="Delete expense">✕</button></td>
    </tr>`;
  }).join("");

  return header + `
    <div class="card" style="padding:0;overflow-x:auto;">
      <table class="expenses-table">
        <thead><tr>
          <th>Date</th><th>Paddock</th><th>Category</th><th>Ex GST</th><th>GST</th><th>Total</th><th>Notes</th><th></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ---------- Modals ----------
function openPaddockModal(existing) {
  const isEdit = !!existing;
  document.getElementById("modal-root").innerHTML = `
    <div class="modal-overlay" id="overlay">
      <div class="modal" onclick="event.stopPropagation()">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
          <div style="font-family:var(--display-font);font-size:19px;">${isEdit ? "Edit paddock" : "Add paddock"}</div>
          <button class="icon-btn" id="close-modal">✕</button>
        </div>
        <div style="display:grid;gap:14px;">
          <label class="label">Name<input class="field" id="p-name" placeholder="e.g. Home Block" value="${isEdit ? esc(existing.name) : ""}" /></label>
          <label class="label">Hectares<input class="field" id="p-ha" type="number" min="0" step="0.1" placeholder="e.g. 24.5" value="${isEdit ? existing.hectares : ""}" /></label>
          <label class="label">Crop<select class="field" id="p-crop">${cropOptions(isEdit ? existing.crop : CROP_TYPES[0].name)}</select></label>
          <button class="btn-primary" id="save-paddock">${isEdit ? "Save changes" : "Save paddock"}</button>
        </div>
      </div>
    </div>`;
  document.getElementById("overlay").addEventListener("click", closeModal);
  document.getElementById("close-modal").addEventListener("click", closeModal);
  document.getElementById("save-paddock").addEventListener("click", () => {
    const name = document.getElementById("p-name").value.trim();
    const hectares = Number(document.getElementById("p-ha").value);
    const crop = document.getElementById("p-crop").value;
    if (!name || !hectares) return;
    if (isEdit) updatePaddock(existing.id, { name, hectares, crop });
    else addPaddock({ name, hectares, crop });
    closeModal();
  });
}

function openExpenseModal(existing) {
  const isEdit = !!existing;
  const today = new Date().toISOString().slice(0, 10);
  const startAmount = isEdit ? existing.amountExGst : "";
  document.getElementById("modal-root").innerHTML = `
    <div class="modal-overlay" id="overlay">
      <div class="modal" onclick="event.stopPropagation()">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
          <div style="font-family:var(--display-font);font-size:19px;">${isEdit ? "Edit expense" : "Add expense"}</div>
          <button class="icon-btn" id="close-modal">✕</button>
        </div>
        <div style="display:grid;gap:14px;">
          <label class="label">Paddock<select class="field" id="e-paddock">${paddockOptions(isEdit ? existing.paddockId : state.paddocks[0]?.id)}</select></label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <label class="label">Date<input class="field" id="e-date" type="date" value="${isEdit ? existing.date : today}" /></label>
            <label class="label">Category<select class="field" id="e-cat">${catOptions(isEdit ? existing.category : EXPENSE_CATEGORIES[0])}</select></label>
          </div>
          <label class="label">Amount (excl. GST, NZD)<input class="field" id="e-amount" type="number" min="0" step="0.01" placeholder="0.00" value="${startAmount}" /></label>
          <div id="gst-preview" style="font-family:var(--data-font);font-size:12px;color:#8A8578;display:${startAmount ? "flex" : "none"};justify-content:space-between;">
            ${startAmount ? `<span>GST (15%): ${fmtMoney(startAmount * GST_RATE)}</span><span>Total: ${fmtMoney(startAmount * (1 + GST_RATE))}</span>` : ""}
          </div>
          <label class="label">Notes<input class="field" id="e-notes" placeholder="Optional" value="${isEdit ? esc(existing.notes || "") : ""}" /></label>
          <button class="btn-primary" id="save-expense">${isEdit ? "Save changes" : "Save expense"}</button>
        </div>
      </div>
    </div>`;
  document.getElementById("overlay").addEventListener("click", closeModal);
  document.getElementById("close-modal").addEventListener("click", closeModal);
  document.getElementById("e-amount").addEventListener("input", (ev) => {
    const exGst = Number(ev.target.value || 0);
    const preview = document.getElementById("gst-preview");
    if (exGst > 0) {
      const gst = exGst * GST_RATE;
      preview.style.display = "flex";
      preview.innerHTML = `<span>GST (15%): ${fmtMoney(gst)}</span><span>Total: ${fmtMoney(exGst + gst)}</span>`;
    } else {
      preview.style.display = "none";
    }
  });
  document.getElementById("save-expense").addEventListener("click", () => {
    const paddockId = document.getElementById("e-paddock").value;
    const date = document.getElementById("e-date").value;
    const category = document.getElementById("e-cat").value;
    const amountExGst = Number(document.getElementById("e-amount").value);
    const notes = document.getElementById("e-notes").value.trim();
    if (!paddockId || !amountExGst) return;
    if (isEdit) updateExpense(existing.id, { paddockId, date, category, amountExGst, notes });
    else addExpense({ paddockId, date, category, amountExGst, notes });
    closeModal();
  });
}

function closeModal() { document.getElementById("modal-root").innerHTML = ""; }

// ---------- Event wiring ----------
function attachMainListeners() {
  const addPaddockBtn = document.getElementById("add-paddock-btn");
  if (addPaddockBtn) addPaddockBtn.addEventListener("click", () => openPaddockModal());
  const addExpenseBtn = document.getElementById("add-expense-btn");
  if (addExpenseBtn) addExpenseBtn.addEventListener("click", () => openExpenseModal());
  const filterSel = document.getElementById("filter-paddock");
  if (filterSel) filterSel.addEventListener("change", (e) => { filterPaddock = e.target.value; render(); });

  document.querySelectorAll(".delete-paddock").forEach((btn) =>
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (confirm("Delete this paddock and its expenses?")) deletePaddock(btn.dataset.id);
    }));
  document.querySelectorAll(".edit-paddock").forEach((row) =>
    row.addEventListener("click", () => {
      const p = state.paddocks.find((pp) => pp.id === row.dataset.id);
      if (p) openPaddockModal(p);
    }));

  document.querySelectorAll(".delete-expense").forEach((btn) =>
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      deleteExpense(btn.dataset.id);
    }));
  document.querySelectorAll(".edit-expense").forEach((row) =>
    row.addEventListener("click", () => {
      const e = state.expenses.find((ee) => ee.id === row.dataset.id);
      if (e) openExpenseModal(e);
    }));
}

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => { tab = btn.dataset.tab; render(); });
});

// ---------- Init ----------
loadState();
render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((e) => console.error("SW registration failed:", e));
  });
}
