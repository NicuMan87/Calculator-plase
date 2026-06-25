const PROFILE_OPTIONS = [
  { length: 300, price: 39 },
  { length: 200, price: 28 },
  { length: 150, price: 23 }
];

const MESH_OPTIONS = [
  { length: 200, label: "100 x 200 cm", price: 27 },
  { length: 500, label: "100 x 500 cm", price: 40 },
  { length: 1000, label: "100 x 1000 cm", price: 75 }
];

const GASKET_LENGTH = 900;
const GASKET_PRICE = 7;
const CORNER_SET_PRICE = 10;
const ACCESSORY_SET_PRICE = 10;
const MAGNETIC_SET_PRICE = 14;

const form = document.querySelector("#netsForm");
const template = document.querySelector("#netTemplate");
const addNetBtn = document.querySelector("#addNetBtn");
const calculateBtn = document.querySelector("#calculateBtn");
const resetBtn = document.querySelector("#resetBtn");
const copyBtn = document.querySelector("#copyBtn");
const copyFeedback = document.querySelector("#copyFeedback");
const internalModeBtn = document.querySelector("#internalModeBtn");
const clientEls = {
  selectedClientLabel: document.querySelector("#selectedClientLabel"),
  newClientBtn: document.querySelector("#newClientBtn"),
  saveClientBtn: document.querySelector("#saveClientBtn"),
  deleteClientBtn: document.querySelector("#deleteClientBtn"),
  saveOfferToClientBtn: document.querySelector("#saveOfferToClientBtn"),
  exportDataBtn: document.querySelector("#exportDataBtn"),
  importDataBtn: document.querySelector("#importDataBtn"),
  importFileInput: document.querySelector("#importFileInput"),
  clientName: document.querySelector("#clientName"),
  clientPhone: document.querySelector("#clientPhone"),
  clientArea: document.querySelector("#clientArea"),
  measurementDate: document.querySelector("#measurementDate"),
  clientStatus: document.querySelector("#clientStatus"),
  clientNotes: document.querySelector("#clientNotes"),
  clientSearch: document.querySelector("#clientSearch"),
  statusFilter: document.querySelector("#statusFilter"),
  clientList: document.querySelector("#clientList"),
  offerList: document.querySelector("#offerList"),
  crmFeedback: document.querySelector("#crmFeedback")
};

const els = {
  recommendedPrice: document.querySelector("#recommendedPrice"),
  materialCost: document.querySelector("#materialCost"),
  estimatedProfit: document.querySelector("#estimatedProfit"),
  executionTime: document.querySelector("#executionTime"),
  profileList: document.querySelector("#profileList"),
  cutsList: document.querySelector("#cutsList"),
  materialsList: document.querySelector("#materialsList"),
  pricingList: document.querySelector("#pricingList"),
  wasteList: document.querySelector("#wasteList")
};

let lastResult = null;
let clients = [];
let selectedClientId = null;
let internalMode = false;
const CRM_STORAGE_KEY = "calculator-plase-nicu-crm-v1";

function ron(value) {
  return `${Math.round(value).toLocaleString("ro-RO")} RON`;
}

function cm(value) {
  return `${Math.round(value).toLocaleString("ro-RO")} cm`;
}

function hoursText(minutes) {
  const hours = minutes / 60;
  return `${hours.toLocaleString("ro-RO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`;
}

function roundOffer(value) {
  return Math.round(value / 10) * 10;
}

function addLine(container, label, value) {
  const row = document.createElement("div");
  row.className = "line-item";
  row.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
  container.append(row);
}

function clearResults() {
  Object.values(els).forEach((element) => {
    if (element instanceof HTMLElement && !["recommendedPrice", "materialCost", "estimatedProfit", "executionTime"].includes(element.id)) {
      element.innerHTML = "";
    }
  });
}

function addNet(defaults = {}) {
  const clone = template.content.cloneNode(true);
  const card = clone.querySelector(".net-card");
  const fields = {
    type: clone.querySelector('[name="type"]'),
    width: clone.querySelector('[name="width"]'),
    height: clone.querySelector('[name="height"]'),
    quantity: clone.querySelector('[name="quantity"]'),
    crossbar: clone.querySelector('[name="crossbar"]'),
    closing: clone.querySelector('[name="closing"]')
  };

  fields.type.value = defaults.type || "window";
  fields.width.value = defaults.width || 100;
  fields.height.value = defaults.height || 120;
  fields.quantity.value = defaults.quantity || 1;
  fields.crossbar.checked = Boolean(defaults.crossbar);
  fields.closing.value = defaults.closing || "clips";

  card.querySelector(".delete-btn").addEventListener("click", () => {
    card.remove();
    if (!form.children.length) addNet();
    updateNumbers();
    calculate();
  });

  card.addEventListener("input", calculate);
  card.addEventListener("change", calculate);
  form.append(card);
  updateNumbers();
}

function updateNumbers() {
  [...form.children].forEach((card, index) => {
    card.querySelector(".net-number").textContent = index + 1;
  });
}

function readNets() {
  const nets = [];
  [...form.children].forEach((card) => {
    const quantity = Math.max(1, Number(card.querySelector('[name="quantity"]').value) || 1);
    const base = {
      type: card.querySelector('[name="type"]').value,
      width: Math.max(1, Number(card.querySelector('[name="width"]').value) || 1),
      height: Math.max(1, Number(card.querySelector('[name="height"]').value) || 1),
      crossbar: card.querySelector('[name="crossbar"]').checked,
      closing: card.querySelector('[name="closing"]').value
    };
    for (let i = 0; i < quantity; i += 1) nets.push(base);
  });
  return nets;
}

function findBestProfilePlan(cuts) {
  const required = cuts.reduce((sum, cut) => sum + cut, 0);
  if (!required) return { bars: [], counts: {}, totalCost: 0, waste: 0 };

  const maxBars = Math.ceil(required / 150) + cuts.length;
  const sortedCuts = [...cuts].sort((a, b) => b - a);
  let best = null;

  for (let count300 = 0; count300 <= maxBars; count300 += 1) {
    for (let count200 = 0; count200 <= maxBars; count200 += 1) {
      for (let count150 = 0; count150 <= maxBars; count150 += 1) {
        const bars = [
          ...Array(count300).fill(300),
          ...Array(count200).fill(200),
          ...Array(count150).fill(150)
        ];
        if (!bars.length) continue;

        const totalLength = bars.reduce((sum, length) => sum + length, 0);
        if (totalLength < required) continue;

        const placement = placeCuts(sortedCuts, bars);
        if (!placement) continue;

        const totalCost = count300 * 39 + count200 * 28 + count150 * 23;
        const waste = totalLength - required;
        const candidate = {
          bars: placement,
          counts: { 300: count300, 200: count200, 150: count150 },
          totalCost,
          waste
        };

        if (
          !best ||
          totalCost < best.totalCost ||
          (totalCost === best.totalCost && waste < best.waste) ||
          (totalCost === best.totalCost && waste === best.waste && candidate.bars.length < best.bars.length)
        ) {
          best = candidate;
        }
      }
    }
  }

  return best;
}

function placeCuts(cuts, bars) {
  const preparedBars = bars
    .map((length) => ({ length, remaining: length, cuts: [] }))
    .sort((a, b) => a.length - b.length);

  function backtrack(index) {
    if (index === cuts.length) return true;
    const cut = cuts[index];
    const tried = new Set();

    for (const bar of preparedBars) {
      const stateKey = `${bar.length}-${bar.remaining}`;
      if (tried.has(stateKey) || bar.remaining < cut) continue;
      tried.add(stateKey);
      bar.cuts.push(cut);
      bar.remaining -= cut;
      if (backtrack(index + 1)) return true;
      bar.remaining += cut;
      bar.cuts.pop();
    }
    return false;
  }

  return backtrack(0) ? preparedBars.filter((bar) => bar.cuts.length) : null;
}

function findBestMeshPlan(nets) {
  const panels = nets.map((net) => ({
    width: Math.min(net.width, net.height),
    length: Math.max(net.width, net.height),
    area: net.width * net.height
  }));

  if (!panels.length) return { rolls: [], counts: {}, cost: 0, usedArea: 0, remainingArea: 0, wastePercent: 0 };

  const usedArea = panels.reduce((sum, panel) => sum + panel.area, 0);
  const requiredLength = panels.reduce((sum, panel) => sum + panel.length, 0);
  const maxRolls = Math.ceil(requiredLength / 200) + panels.length;
  const sortedPanels = panels.sort((a, b) => b.length - a.length);
  let best = null;

  for (let count2 = 0; count2 <= maxRolls; count2 += 1) {
    for (let count5 = 0; count5 <= maxRolls; count5 += 1) {
      for (let count10 = 0; count10 <= maxRolls; count10 += 1) {
        const rolls = [
          ...Array(count2).fill(MESH_OPTIONS[0]),
          ...Array(count5).fill(MESH_OPTIONS[1]),
          ...Array(count10).fill(MESH_OPTIONS[2])
        ];
        if (!rolls.length) continue;

        const totalLength = rolls.reduce((sum, roll) => sum + roll.length, 0);
        if (totalLength < requiredLength) continue;

        const placement = placeMeshPanels(sortedPanels, rolls);
        if (!placement) continue;

        const cost = count2 * 27 + count5 * 40 + count10 * 75;
        const remainingArea = (totalLength * 100) - usedArea;
        const candidate = {
          rolls: placement,
          counts: { 200: count2, 500: count5, 1000: count10 },
          cost,
          usedArea,
          remainingArea,
          wastePercent: totalLength ? (remainingArea / (totalLength * 100)) * 100 : 0
        };

        if (
          !best ||
          cost < best.cost ||
          (cost === best.cost && remainingArea < best.remainingArea)
        ) {
          best = candidate;
        }
      }
    }
  }

  return best;
}

function placeMeshPanels(panels, rolls) {
  const preparedRolls = rolls
    .map((roll) => ({ ...roll, remaining: roll.length, panels: [] }))
    .sort((a, b) => a.length - b.length);

  function backtrack(index) {
    if (index === panels.length) return true;
    const panel = panels[index];
    const tried = new Set();

    if (panel.width > 100) return false;

    for (const roll of preparedRolls) {
      const stateKey = `${roll.length}-${roll.remaining}`;
      if (tried.has(stateKey) || roll.remaining < panel.length) continue;
      tried.add(stateKey);
      roll.panels.push(panel);
      roll.remaining -= panel.length;
      if (backtrack(index + 1)) return true;
      roll.remaining += panel.length;
      roll.panels.pop();
    }
    return false;
  }

  return backtrack(0) ? preparedRolls.filter((roll) => roll.panels.length) : null;
}

function buildNetCutDetails(net, index) {
  const horizontalCut = Math.max(0, net.width - 5);
  const verticalCut = Math.max(0, net.height - 5);
  const profileCuts = [horizontalCut, horizontalCut, verticalCut, verticalCut];

  if (net.crossbar) profileCuts.push(horizontalCut);

  return {
    index,
    type: net.type === "door" ? "Ușă balcon" : "Geam",
    finalWidth: net.width,
    finalHeight: net.height,
    horizontalCut,
    verticalCut,
    crossbarCut: net.crossbar ? horizontalCut : 0,
    hasCrossbar: net.crossbar,
    profileCuts,
    profileLength: profileCuts.reduce((sum, cut) => sum + cut, 0)
  };
}

function calculate() {
  const nets = readNets();
  const profileCuts = [];
  const cutDetails = [];
  let totalProfileCutLength = 0;
  let accessorySets = 0;
  let cornerSets = 0;
  let magneticSets = 0;
  let laborMinutes = 0;

  nets.forEach((net, index) => {
    const cutDetail = buildNetCutDetails(net, index + 1);
    cutDetails.push(cutDetail);
    profileCuts.push(...cutDetail.profileCuts);
    totalProfileCutLength += cutDetail.profileLength;

    if (net.crossbar) {
      laborMinutes += 15;
    }

    cornerSets += 1;
    if (net.type === "door") {
      accessorySets += 1;
      laborMinutes += 75;
    } else {
      laborMinutes += 45;
    }
    if (net.closing === "magnetic") magneticSets += 1;
  });

  const profilePlan = findBestProfilePlan(profileCuts) || {
    bars: [],
    counts: {},
    totalCost: 0,
    waste: 0,
    error: "Există debitări mai mari decât profilul de 300 cm."
  };
  const meshPlan = findBestMeshPlan(nets) || {
    rolls: [],
    counts: {},
    cost: 0,
    usedArea: 0,
    remainingArea: 0,
    wastePercent: 0,
    error: "Există plase care depășesc lățimea rolei de 100 cm."
  };
  const gasketQty = Math.ceil(totalProfileCutLength / GASKET_LENGTH);
  const gasketCost = gasketQty * GASKET_PRICE;
  const accessoriesCost =
    cornerSets * CORNER_SET_PRICE +
    accessorySets * ACCESSORY_SET_PRICE +
    magneticSets * MAGNETIC_SET_PRICE;
  const materialCost = profilePlan.totalCost + meshPlan.cost + gasketCost + accessoriesCost;
  const recommendedOffer = roundOffer(materialCost * 2.2);
  const minOffer = roundOffer(materialCost * 2);
  const premiumOffer = roundOffer(materialCost * 2.5);
  const profit = recommendedOffer - materialCost;
  const margin = recommendedOffer ? (profit / recommendedOffer) * 100 : 0;
  const hours = laborMinutes / 60;
  const profitPerHour = hours ? profit / hours : 0;

  lastResult = {
    nets,
    profilePlan,
    meshPlan,
    gasketQty,
    accessorySets,
    cornerSets,
    magneticSets,
    materialCost,
    recommendedOffer,
    minOffer,
    premiumOffer,
    profit,
    margin,
    laborMinutes,
    profitPerHour,
    cutDetails,
    totalProfileCutLength
  };

  render(lastResult);
}

function render(result) {
  clearResults();

  els.recommendedPrice.textContent = ron(result.recommendedOffer);
  els.materialCost.textContent = ron(result.materialCost);
  els.estimatedProfit.textContent = ron(result.profit);
  els.executionTime.textContent = hoursText(result.laborMinutes);

  PROFILE_OPTIONS.forEach((profile) => {
    const qty = result.profilePlan.counts[profile.length] || 0;
    addLine(els.profileList, `Profil ${profile.length} cm`, `${qty} buc.`);
  });

  if (result.cutDetails.length) {
    result.cutDetails.forEach((detail) => {
      const item = document.createElement("article");
      item.className = "cut-card";
      item.innerHTML = `
        <header><span>Plasa ${detail.index} - ${detail.type}</span><strong>${cm(detail.finalWidth)} x ${cm(detail.finalHeight)}</strong></header>
        <p>Dimensiuni finale client: ${cm(detail.finalWidth)} lățime x ${cm(detail.finalHeight)} înălțime</p>
        <p>Debitare reală: 2 x ${cm(detail.horizontalCut)} orizontal, 2 x ${cm(detail.verticalCut)} vertical${detail.hasCrossbar ? `, 1 x ${cm(detail.crossbarCut)} traversă` : ""}</p>
      `;
      els.cutsList.append(item);
    });
  }

  if (result.profilePlan.bars.length) {
    result.profilePlan.bars.forEach((bar, index) => {
      const item = document.createElement("article");
      item.className = "cut-card";
      item.innerHTML = `
        <header><span>Profil ${index + 1} (${bar.length} cm)</span><strong>Rest ${cm(bar.remaining)}</strong></header>
        <p>${bar.cuts.map(cm).join(" + ")}</p>
      `;
      els.cutsList.append(item);
    });
  } else if (!result.cutDetails.length) {
    els.cutsList.innerHTML = '<p class="empty-state">Adaugă dimensiuni pentru debitare.</p>';
  }

  MESH_OPTIONS.forEach((mesh) => {
    const qty = result.meshPlan.counts[mesh.length] || 0;
    addLine(els.materialsList, `Plasa ${mesh.label}`, `${qty} buc.`);
  });
  addLine(els.materialsList, "Cheder 900 cm", `${result.gasketQty} buc.`);
  addLine(els.materialsList, "Set coltare", `${result.cornerSets} buc.`);
  addLine(els.materialsList, "Set accesorii ușă balcon", `${result.accessorySets} buc.`);
  addLine(els.materialsList, "Set închidere magnetică", `${result.magneticSets} buc.`);

  addLine(els.pricingList, "Cost materiale", ron(result.materialCost));
  addLine(els.pricingList, "Oferta minimă", ron(result.minOffer));
  addLine(els.pricingList, "Oferta recomandată", ron(result.recommendedOffer));
  addLine(els.pricingList, "Oferta premium", ron(result.premiumOffer));
  addLine(els.pricingList, "Profit estimat", ron(result.profit));
  addLine(els.pricingList, "Profit %", `${result.margin.toFixed(1)}%`);
  addLine(els.pricingList, "Profit / ora", ron(result.profitPerHour));
  addLine(els.pricingList, "Timp execuție", hoursText(result.laborMinutes));

  addLine(els.wasteList, "Profil folosit efectiv", cm(result.totalProfileCutLength));
  addLine(els.wasteList, "Deșeu profile", cm(result.profilePlan.waste));
  if (result.profilePlan.error) addLine(els.wasteList, "Atenție profile", result.profilePlan.error);
  addLine(els.wasteList, "Suprafață plasă folosită", `${(result.meshPlan.usedArea / 10000).toFixed(2)} mp`);
  addLine(els.wasteList, "Suprafață plasă rămasă", `${(result.meshPlan.remainingArea / 10000).toFixed(2)} mp`);
  addLine(els.wasteList, "Deșeu plasă", `${result.meshPlan.wastePercent.toFixed(1)}%`);
  if (result.meshPlan.error) addLine(els.wasteList, "Atenție plasă", result.meshPlan.error);
}

function copyOffer() {
  if (!lastResult) calculate();
  const result = lastResult;
  if (!internalMode) {
    navigator.clipboard.writeText(buildClientOfferText(result)).then(() => {
      copyFeedback.textContent = "Oferta client a fost copiată.";
      setTimeout(() => {
        copyFeedback.textContent = "";
      }, 2200);
    }).catch(() => {
      copyFeedback.textContent = "Nu s-a putut copia automat.";
    });
    return;
  }
  const cutSummary = result.cutDetails.map((detail) => (
    `Plasa ${detail.index}: final ${cm(detail.finalWidth)} x ${cm(detail.finalHeight)}; debitare 2 x ${cm(detail.horizontalCut)} orizontal, 2 x ${cm(detail.verticalCut)} vertical${detail.hasCrossbar ? `, 1 x ${cm(detail.crossbarCut)} traversă` : ""}`
  ));
  const text = [
    "Calculator Plase Țânțari - Nicu",
    "",
    `Număr plase: ${result.nets.length}`,
    ...cutSummary,
    "",
    `Cost materiale: ${ron(result.materialCost)}`,
    `Oferta recomandată client: ${ron(result.recommendedOffer)}`,
    `Profit estimat: ${ron(result.profit)} (${result.margin.toFixed(1)}%)`,
    `Timp execuție: ${hoursText(result.laborMinutes)}`,
    `Profit / ora: ${ron(result.profitPerHour)}`,
    "",
    "Oferta include materiale, execuție și montaj."
  ].join("\n");

  navigator.clipboard.writeText(text).then(() => {
    copyFeedback.textContent = "Oferta a fost copiată.";
    setTimeout(() => {
      copyFeedback.textContent = "";
    }, 2200);
  }).catch(() => {
    copyFeedback.textContent = "Nu s-a putut copia automat. Selectează textul din browser și copiază manual.";
  });
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function setFeedback(message) {
  if (!clientEls.crmFeedback) return;
  clientEls.crmFeedback.textContent = message;
  setTimeout(() => {
    clientEls.crmFeedback.textContent = "";
  }, 2600);
}

function saveClients() {
  localStorage.setItem(CRM_STORAGE_KEY, JSON.stringify({ clients }));
}

function loadClients() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CRM_STORAGE_KEY) || "{}");
    clients = Array.isArray(parsed.clients) ? parsed.clients : [];
  } catch (error) {
    clients = [];
  }
}

function selectedClient() {
  return clients.find((client) => client.id === selectedClientId) || null;
}

function applyInternalMode(enabled) {
  internalMode = enabled;
  document.body.classList.toggle("internal-mode", internalMode);
  if (internalModeBtn) internalModeBtn.textContent = internalMode ? "Mod intern activ" : "Mod intern";
  renderClients();
  renderOffers();
}

function requestInternalMode() {
  if (internalMode) {
    applyInternalMode(false);
    return;
  }
  const pin = window.prompt("PIN mod intern");
  if (pin === "1987") {
    applyInternalMode(true);
    setFeedback("Mod intern activat.");
  } else if (pin !== null) {
    setFeedback("PIN incorect.");
  }
}

function readClientForm() {
  return {
    clientName: clientEls.clientName.value.trim(),
    phone: clientEls.clientPhone.value.trim(),
    addressOrArea: clientEls.clientArea.value.trim(),
    measurementDate: clientEls.measurementDate.value,
    status: clientEls.clientStatus.value,
    notes: clientEls.clientNotes.value.trim()
  };
}

function fillClientForm(client) {
  clientEls.clientName.value = client?.clientName || "";
  clientEls.clientPhone.value = client?.phone || "";
  clientEls.clientArea.value = client?.addressOrArea || "";
  clientEls.measurementDate.value = client?.measurementDate || "";
  clientEls.clientStatus.value = client?.status || "De măsurat";
  clientEls.clientNotes.value = client?.notes || "";
}

function newClient() {
  selectedClientId = null;
  fillClientForm(null);
  renderClients();
  renderOffers();
  setFeedback("Client nou pregătit.");
}

function saveClient() {
  const data = readClientForm();
  if (!data.clientName) {
    setFeedback("Completează numele clientului.");
    return;
  }

  if (selectedClientId) {
    const client = selectedClient();
    if (client) Object.assign(client, data, { updatedAt: new Date().toISOString() });
  } else {
    const client = {
      id: uid("client"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      offers: [],
      ...data
    };
    clients.unshift(client);
    selectedClientId = client.id;
  }

  saveClients();
  renderClients();
  renderOffers();
  setFeedback("Client salvat.");
}

function deleteClient() {
  const client = selectedClient();
  if (!client) {
    setFeedback("Selectează un client.");
    return;
  }
  if (!window.confirm(`Ștergi clientul ${client.clientName} și ofertele salvate?`)) return;
  clients = clients.filter((item) => item.id !== client.id);
  selectedClientId = null;
  fillClientForm(null);
  saveClients();
  renderClients();
  renderOffers();
  setFeedback("Client șters.");
}

function selectClient(clientId) {
  selectedClientId = clientId;
  fillClientForm(selectedClient());
  renderClients();
  renderOffers();
}

function getShoppingList(result) {
  return {
    profiles: PROFILE_OPTIONS.map((profile) => ({
      length: profile.length,
      quantity: result.profilePlan.counts[profile.length] || 0
    })),
    mesh: MESH_OPTIONS.map((mesh) => ({
      label: mesh.label,
      quantity: result.meshPlan.counts[mesh.length] || 0
    })),
    gasket900cm: result.gasketQty,
    cornerSets: result.cornerSets,
    accessorySets: result.accessorySets,
    magneticSets: result.magneticSets
  };
}

function getCutList(result) {
  return {
    nets: result.cutDetails.map((detail) => ({
      netNumber: detail.index,
      type: detail.type,
      finalWidth: detail.finalWidth,
      finalHeight: detail.finalHeight,
      horizontalCuts: [detail.horizontalCut, detail.horizontalCut],
      verticalCuts: [detail.verticalCut, detail.verticalCut],
      crossbarCut: detail.hasCrossbar ? detail.crossbarCut : null
    })),
    bars: result.profilePlan.bars.map((bar, index) => ({
      profileNumber: index + 1,
      length: bar.length,
      cuts: [...bar.cuts],
      remaining: bar.remaining
    }))
  };
}

function getWasteValues(result) {
  return {
    profileUsedCm: result.totalProfileCutLength,
    profileWasteCm: result.profilePlan.waste,
    meshUsedSqm: Number((result.meshPlan.usedArea / 10000).toFixed(2)),
    meshRemainingSqm: Number((result.meshPlan.remainingArea / 10000).toFixed(2)),
    meshWastePercent: Number(result.meshPlan.wastePercent.toFixed(1))
  };
}

function createOfferSnapshot(result, status) {
  return {
    id: uid("offer"),
    dateCreated: new Date().toISOString(),
    status,
    nets: result.nets.map((net) => ({
      type: net.type === "door" ? "Ușă balcon" : "Geam",
      finalWidth: net.width,
      finalHeight: net.height,
      crossbar: net.crossbar,
      closingType: net.closing === "magnetic" ? "Închidere magnetică" : "Clips"
    })),
    materialCost: result.materialCost,
    recommendedCustomerPrice: result.recommendedOffer,
    minimumOffer: result.minOffer,
    premiumOffer: result.premiumOffer,
    estimatedProfit: result.profit,
    profitMargin: result.margin,
    executionTimeMinutes: result.laborMinutes,
    profitPerHour: result.profitPerHour,
    shoppingList: getShoppingList(result),
    cutList: getCutList(result),
    wasteValues: getWasteValues(result)
  };
}

function saveOfferToClient() {
  const client = selectedClient();
  if (!client) {
    setFeedback("Selectează sau salvează mai întâi un client.");
    return;
  }
  calculate();
  const offer = createOfferSnapshot(lastResult, client.status);
  client.offers = Array.isArray(client.offers) ? client.offers : [];
  client.offers.unshift(offer);
  if (client.status === "De măsurat") client.status = "Ofertat";
  client.updatedAt = new Date().toISOString();
  fillClientForm(client);
  saveClients();
  renderClients();
  renderOffers();
  setFeedback("Oferta a fost salvată la client.");
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ro-RO");
}

function renderClients() {
  const search = (clientEls.clientSearch?.value || "").trim().toLowerCase();
  const status = clientEls.statusFilter?.value || "all";
  const filtered = clients.filter((client) => {
    const matchesSearch = !search ||
      (client.clientName || "").toLowerCase().includes(search) ||
      (client.phone || "").toLowerCase().includes(search);
    const matchesStatus = status === "all" || client.status === status;
    return matchesSearch && matchesStatus;
  });

  const selected = selectedClient();
  clientEls.selectedClientLabel.textContent = selected ? `Client selectat: ${selected.clientName}` : "Niciun client selectat";
  clientEls.clientList.innerHTML = "";

  if (!filtered.length) {
    clientEls.clientList.innerHTML = '<p class="empty-state">Nu există clienți pentru filtrul ales.</p>';
    return;
  }

  filtered.forEach((client) => {
    const offers = Array.isArray(client.offers) ? client.offers : [];
    const lastOffer = offers[0];
    const card = document.createElement("article");
    card.className = `client-card${client.id === selectedClientId ? " selected" : ""}`;
    card.innerHTML = `
      <header>
        <h3>${escapeHtml(client.clientName)}</h3>
        <span class="badge">${escapeHtml(client.status)}</span>
      </header>
      <div class="card-meta">
        <span>Telefon: <strong>${escapeHtml(client.phone || "-")}</strong></span>
        <span>Zonă: <strong>${escapeHtml(client.addressOrArea || "-")}</strong></span>
        <span>Data măsurătorii: <strong>${escapeHtml(formatDate(client.measurementDate))}</strong></span>
        <span>Oferte salvate: <strong>${offers.length}</strong></span>
        <span>Ultima ofertă: <strong>${lastOffer ? ron(lastOffer.recommendedCustomerPrice) : "-"}</strong></span>
      </div>
      <div class="card-buttons">
        <button class="small-btn green" type="button" data-action="select" data-client-id="${client.id}">Editează client</button>
      </div>
    `;
    clientEls.clientList.append(card);
  });
}

function renderOffers() {
  const client = selectedClient();
  clientEls.offerList.innerHTML = "";
  if (!client) {
    clientEls.offerList.innerHTML = '<p class="empty-state">Selectează un client pentru ofertele salvate.</p>';
    return;
  }

  const offers = Array.isArray(client.offers) ? client.offers : [];
  if (!offers.length) {
    clientEls.offerList.innerHTML = '<p class="empty-state">Clientul nu are oferte salvate.</p>';
    return;
  }

  offers.forEach((offer) => {
    const card = document.createElement("article");
    card.className = "offer-card";
    card.innerHTML = `
      <header>
        <h3>${formatDate(offer.dateCreated)}</h3>
        <span class="badge">${escapeHtml(offer.status || client.status)}</span>
      </header>
      <div class="card-meta">
        <span>Total ofertă: <strong>${ron(offer.recommendedCustomerPrice)}</strong></span>
        <span>Număr plase: <strong>${offer.nets.length}</strong></span>
        <span class="internal-only">Cost materiale: <strong>${ron(offer.materialCost)}</strong></span>
        <span class="internal-only">Profit: <strong>${ron(offer.estimatedProfit)} (${offer.profitMargin.toFixed(1)}%)</strong></span>
      </div>
      <div class="card-buttons">
        <button class="small-btn green" type="button" data-action="copy-client-offer" data-offer-id="${offer.id}">Copiază ofertă client</button>
        <button class="small-btn internal-only" type="button" data-action="copy-internal-offer" data-offer-id="${offer.id}">Copiază calcul intern</button>
        <button class="small-btn danger" type="button" data-action="delete-offer" data-offer-id="${offer.id}">Șterge ofertă</button>
      </div>
    `;
    clientEls.offerList.append(card);
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildClientOfferText(result) {
  const lines = [
    "Oferta plase țânțari - Nicu",
    "",
    `Număr plase: ${result.nets.length}`,
    `Preț recomandat client: ${ron(result.recommendedOffer)}`,
    `Timp estimat execuție: ${hoursText(result.laborMinutes)}`,
    "",
    "Dimensiuni:"
  ];

  result.nets.forEach((net, index) => {
    lines.push(`${index + 1}. ${net.type === "door" ? "Ușă balcon" : "Geam"} - ${cm(net.width)} x ${cm(net.height)}, traversă: ${net.crossbar ? "Da" : "Nu"}, închidere: ${net.closing === "magnetic" ? "magnetică" : "clips"}`);
  });

  lines.push("", "Oferta include materiale, execuție și montaj.");
  return lines.join("\n");
}

function buildInternalOfferText(result) {
  const cutSummary = result.cutDetails.map((detail) => (
    `Plasa ${detail.index}: final ${cm(detail.finalWidth)} x ${cm(detail.finalHeight)}; debitare 2 x ${cm(detail.horizontalCut)} orizontal, 2 x ${cm(detail.verticalCut)} vertical${detail.hasCrossbar ? `, 1 x ${cm(detail.crossbarCut)} traversă` : ""}`
  ));
  return [
    "Calculator Plase Țânțari - Nicu",
    "",
    `Număr plase: ${result.nets.length}`,
    ...cutSummary,
    "",
    `Cost materiale: ${ron(result.materialCost)}`,
    `Oferta minimă: ${ron(result.minOffer)}`,
    `Oferta recomandată client: ${ron(result.recommendedOffer)}`,
    `Oferta premium: ${ron(result.premiumOffer)}`,
    `Profit estimat: ${ron(result.profit)} (${result.margin.toFixed(1)}%)`,
    `Timp execuție: ${hoursText(result.laborMinutes)}`,
    `Profit / ora: ${ron(result.profitPerHour)}`,
    `Deșeu profile: ${cm(result.profilePlan.waste)}`,
    `Deșeu plasă: ${result.meshPlan.wastePercent.toFixed(1)}%`,
    "",
    "Oferta include materiale, execuție și montaj."
  ].join("\n");
}

function buildClientOfferTextFromSaved(client, offer) {
  const lines = [
    `Ofertă pentru ${client.clientName}`,
    "",
    `Telefon: ${client.phone || "-"}`,
    `Adresă / zonă: ${client.addressOrArea || "-"}`,
    `Data ofertei: ${formatDate(offer.dateCreated)}`,
    `Preț recomandat client: ${ron(offer.recommendedCustomerPrice)}`,
    `Timp estimat execuție: ${hoursText(offer.executionTimeMinutes)}`,
    "",
    "Dimensiuni:"
  ];
  offer.nets.forEach((net, index) => {
    lines.push(`${index + 1}. ${net.type} - ${cm(net.finalWidth)} x ${cm(net.finalHeight)}, traversă: ${net.crossbar ? "Da" : "Nu"}, închidere: ${net.closingType}`);
  });
  lines.push("", "Oferta include materiale, execuție și montaj.");
  return lines.join("\n");
}

function buildInternalOfferTextFromSaved(client, offer) {
  const cutLines = offer.cutList.nets.map((item) => {
    const crossbar = item.crossbarCut ? `, 1 x ${cm(item.crossbarCut)} traversă` : "";
    return `Plasa ${item.netNumber}: ${item.type}, final ${cm(item.finalWidth)} x ${cm(item.finalHeight)}, debitare 2 x ${cm(item.horizontalCuts[0])} orizontal, 2 x ${cm(item.verticalCuts[0])} vertical${crossbar}`;
  });
  return [
    `Calcul intern - ${client.clientName}`,
    "",
    `Data ofertei: ${formatDate(offer.dateCreated)}`,
    `Cost materiale: ${ron(offer.materialCost)}`,
    `Oferta minimă: ${ron(offer.minimumOffer)}`,
    `Oferta recomandată: ${ron(offer.recommendedCustomerPrice)}`,
    `Oferta premium: ${ron(offer.premiumOffer)}`,
    `Profit estimat: ${ron(offer.estimatedProfit)} (${offer.profitMargin.toFixed(1)}%)`,
    `Timp execuție: ${hoursText(offer.executionTimeMinutes)}`,
    `Profit / ora: ${ron(offer.profitPerHour)}`,
    "",
    "Debitare:",
    ...cutLines,
    "",
    `Deșeu profile: ${cm(offer.wasteValues.profileWasteCm)}`,
    `Deșeu plasă: ${offer.wasteValues.meshWastePercent}%`
  ].join("\n");
}

function findOffer(offerId) {
  const client = selectedClient();
  if (!client) return null;
  const offer = (client.offers || []).find((item) => item.id === offerId);
  return offer ? { client, offer } : null;
}

function copySavedOffer(offerId, internal) {
  const found = findOffer(offerId);
  if (!found) return;
  if (internal && !internalMode) {
    setFeedback("Activează Mod intern cu PIN pentru calculul intern.");
    return;
  }
  const text = internal
    ? buildInternalOfferTextFromSaved(found.client, found.offer)
    : buildClientOfferTextFromSaved(found.client, found.offer);
  navigator.clipboard.writeText(text).then(() => {
    setFeedback(internal ? "Calcul intern copiat." : "Oferta client copiată.");
  }).catch(() => {
    setFeedback("Nu s-a putut copia automat.");
  });
}

function deleteOffer(offerId) {
  const client = selectedClient();
  if (!client) return;
  if (!window.confirm("Ștergi oferta selectată?")) return;
  client.offers = (client.offers || []).filter((offer) => offer.id !== offerId);
  client.updatedAt = new Date().toISOString();
  saveClients();
  renderClients();
  renderOffers();
  setFeedback("Oferta a fost ștearsă.");
}

function exportData() {
  const data = JSON.stringify({ exportedAt: new Date().toISOString(), clients }, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `clienti-oferte-plase-nicu-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  setFeedback("Export JSON pregătit.");
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!Array.isArray(parsed.clients)) throw new Error("missing clients");
      clients = parsed.clients;
      selectedClientId = clients[0]?.id || null;
      fillClientForm(selectedClient());
      saveClients();
      renderClients();
      renderOffers();
      setFeedback("Date importate cu succes.");
    } catch (error) {
      setFeedback("Fișier JSON invalid.");
    }
  };
  reader.readAsText(file);
}

function initCrm() {
  loadClients();
  els.wasteList?.closest(".result-block")?.classList.add("internal-only");
  applyInternalMode(false);
  renderClients();
  renderOffers();

  internalModeBtn?.addEventListener("click", requestInternalMode);
  clientEls.newClientBtn?.addEventListener("click", newClient);
  clientEls.saveClientBtn?.addEventListener("click", saveClient);
  clientEls.deleteClientBtn?.addEventListener("click", deleteClient);
  clientEls.saveOfferToClientBtn?.addEventListener("click", saveOfferToClient);
  clientEls.exportDataBtn?.addEventListener("click", exportData);
  clientEls.importDataBtn?.addEventListener("click", () => clientEls.importFileInput.click());
  clientEls.importFileInput?.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) importData(file);
    event.target.value = "";
  });
  clientEls.clientSearch?.addEventListener("input", renderClients);
  clientEls.statusFilter?.addEventListener("change", renderClients);
  clientEls.clientList?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "select") selectClient(button.dataset.clientId);
  });
  clientEls.offerList?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "copy-client-offer") copySavedOffer(button.dataset.offerId, false);
    if (button.dataset.action === "copy-internal-offer") copySavedOffer(button.dataset.offerId, true);
    if (button.dataset.action === "delete-offer") deleteOffer(button.dataset.offerId);
  });
}

function resetApp() {
  form.innerHTML = "";
  addNet({ type: "window", width: 100, height: 120, quantity: 1, crossbar: false, closing: "clips" });
  addNet({ type: "door", width: 90, height: 210, quantity: 1, crossbar: true, closing: "magnetic" });
  calculate();
}

addNetBtn.addEventListener("click", () => {
  addNet();
  calculate();
});
calculateBtn.addEventListener("click", calculate);
resetBtn.addEventListener("click", resetApp);
copyBtn.addEventListener("click", copyOffer);

initCrm();
resetApp();
