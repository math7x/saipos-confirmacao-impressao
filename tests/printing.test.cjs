const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const prefSource = fs.readFileSync(path.join(root, "preferences.js"), "utf8");
const contentSource = fs.readFileSync(path.join(root, "content.js"), "utf8");

function harness(saved = {}, route = "#/app/sale/table-order/new-main", stored = {}) {
  const pending = new Map();
  const session = new Map();
  const listeners = {};
  const state = {
    opened: 0, saved: 0, blocked: false, closed: true, toasts: [], fields: new Map(),
    categoryDialog: null, categoryWaits: 0, confirmCategory: null
  };
  let timerId = 0;
  class Select {
    constructor(texts, current) {
      this.options = texts.map((text, index) => ({ textContent: text, value: String(index), disabled: false }));
      this.value = String(texts.indexOf(current));
      this.events = [];
    }
    get selectedIndex() { return this.options.findIndex((option) => option.value === this.value); }
    dispatchEvent(event) { this.events.push(event.type); return true; }
  }
  const context = vm.createContext({
    console: { warn() {} }, Event, HTMLSelectElement: Select, Element: class {},
    location: { hash: route },
    sessionStorage: {
      getItem: (key) => session.get(key) ?? null,
      setItem: (key, value) => session.set(key, value),
      removeItem: (key) => session.delete(key)
    },
    setTimeout: (fn, ms) => { pending.set(++timerId, { fn, ms }); return timerId; },
    clearTimeout: (id) => pending.delete(id),
    window: { addEventListener: (name, fn) => { listeners[name] = fn; } },
    chrome: {
      storage: {
        local: {
          get: async (key) => ({ [key]: stored[key] }),
          set: async (values) => Object.assign(stored, values)
        },
        onChanged: { addListener: (fn) => { listeners.storage = fn; } }
      },
      runtime: { onMessage: { addListener: (fn) => { listeners.message = fn; } } }
    }
  });
  vm.runInContext(prefSource, context);
  const prefs = context.SaiposPrintPreferences;
  if (!stored[prefs.key]) stored[prefs.key] = prefs.normalize(saved);
  // Expose hooks in the in-memory test copy only. Production files stay unchanged.
  const instrumented = contentSource.replace(/\}\)\(\);\s*$/, `
    globalThis.testApi = {
      configure, handleRouteChange, isTargetPage, chooseOption,
      install(hooks) {
        loginIsVisible = hooks.login;
        blockingDialogIsVisible = hooks.blocked;
        openPrintDialog = hooks.open;
        findExactText = hooks.find;
        fieldContainer = hooks.container;
        selectControl = hooks.control;
        findSaveButton = hooks.save;
        toast = hooks.toast;
        categoryCreationDialog = hooks.category;
        waitForCategoryConfirmation = hooks.categoryWait;
      }
    };
  })();`);
  vm.runInContext(instrumented, context);
  for (const field of prefs.fields) {
    const texts = field.options.filter(([value]) => value !== "keep").map(([, text]) => text);
    state.fields.set(field.label, new Select(texts, texts[2]));
  }
  context.testApi.install({
    login: () => context.location.hash.startsWith("#/access/login"),
    blocked: () => state.blocked,
    open: async () => { state.opened++; return {}; },
    find: (label) => label === "Configurar confirmações de impressão"
      ? (state.closed ? null : {}) : state.fields.get(label),
    container: (label) => label,
    control: (container) => container,
    save: () => ({ click() { state.saved++; }, getAttribute() { return null; } }),
    toast: (text) => state.toasts.push(text),
    category: () => state.categoryDialog,
    categoryWait: (_dialog, onConfirmed) => {
      state.categoryWaits++;
      state.confirmCategory = onConfirmed;
    }
  });
  return { context, prefs, state, pending, session, listeners, stored,
    api: context.testApi,
    text: (label) => { const s = state.fields.get(label); return s.options[s.selectedIndex].textContent; },
    fire: async () => {
      const [id, timer] = [...pending][0];
      pending.delete(id);
      await timer.fn();
    }
  };
}

test("Mesas, Fichas e Kanban agendam após 4s; rotas não atendidas não agendam", () => {
  for (const route of ["#/app/sale/table-order/new-main", "#/app/sale/service-ticket/main", "#/app/sale/delivery/kanban/search-customer", "#/app/sale/table-order/new-main/?x=1"]) {
    const h = harness({}, route);
    assert.equal(h.pending.size, 1);
    assert.equal([...h.pending.values()][0].ms, 4000);
  }
  assert.equal(harness({}, "#/app/store/customers").pending.size, 0);
});

test("preferências persistem em outro contexto, incluindo Nunca nas Mesas e Sempre nas Fichas", async () => {
  const h = harness();
  await h.prefs.save({ ticketSale: "always", ticketFiscal: "always", tableSale: "never", tableFiscal: "never" });
  const reopened = harness({}, undefined, h.stored);
  const loaded = await reopened.prefs.load();
  assert.equal(loaded.tableSale, "never");
  assert.equal(loaded.tableFiscal, "never");
  await reopened.fire();
  assert.equal(reopened.text("Atendimento de Mesa - Venda"), "Nunca imprimir");
  assert.equal(reopened.text("Atendimento por Fichas - Venda"), "Sempre Imprimir");
  assert.equal(reopened.state.saved, 1);
});

test("conta com apenas Fichas ignora módulos ausentes e salva os três campos", async () => {
  const h = harness();
  for (const label of h.state.fields.keys()) if (/Delivery|Mesa/.test(label)) h.state.fields.delete(label);
  const result = await h.api.configure();
  assert.equal(result.ok, true);
  assert.match(result.message, /3 preferências/);
  assert.equal(h.state.saved, 1);
});

test("Não alterar preserva campo e todos em Não alterar não abrem janela", async () => {
  const h = harness({ tableSale: "keep" });
  await h.api.configure();
  assert.equal(h.text("Atendimento de Mesa - Venda"), "Sempre Perguntar");
  const allKeep = Object.fromEntries(h.prefs.fields.map((f) => [f.id, "keep"]));
  const untouched = harness(allKeep);
  assert.equal((await untouched.api.configure()).ok, true);
  assert.equal(untouched.state.opened, 0);
  assert.equal(untouched.state.saved, 0);
});

test("Não Imprimir Neste Computador não é confundido com Imprimir neste Computador", async () => {
  const h = harness();
  const printer = h.state.fields.get("Impressora Saipos Printer");
  printer.value = "1";
  await h.api.configure();
  assert.equal(h.text("Impressora Saipos Printer"), "Imprimir neste Computador");
  assert.deepEqual(printer.events, ["input", "change"]);
  await h.prefs.save({ printer: "disabled" });
  await h.api.configure();
  assert.equal(h.text("Impressora Saipos Printer"), "Não Imprimir Neste Computador");
});

test("janela de caixa bloqueia a execução e retoma após fechar sem mudar URL", async () => {
  const h = harness();
  h.state.blocked = true;
  await h.fire();
  assert.equal(h.state.opened, 0);
  assert.equal(h.state.saved, 0);
  assert.equal([...h.pending.values()][0].ms, 5000);
  h.state.blocked = false;
  await h.fire();
  assert.equal(h.state.saved, 1);
});

test("criação de categoria aguarda Confirmar e retoma a impressão ao fechar", async () => {
  const h = harness();
  h.state.categoryDialog = {};
  await h.fire();
  assert.equal(h.state.opened, 0);
  assert.equal(h.state.categoryWaits, 1);

  h.state.categoryDialog = null;
  h.state.confirmCategory();
  assert.equal([...h.pending.values()][0].ms, 600);
  await h.fire();
  assert.equal(h.state.saved, 1);
});

test("não repete na sessão; novo login e novas preferências permitem reaplicar", async () => {
  const h = harness();
  await h.fire();
  h.context.location.hash = "#/app/sale/service-ticket/main";
  h.api.handleRouteChange();
  await h.fire();
  assert.equal(h.state.saved, 1);
  h.context.location.hash = "#/access/login";
  h.api.handleRouteChange();
  h.context.location.hash = "#/app/sale/table-order/new-main";
  h.api.handleRouteChange();
  await h.fire();
  assert.equal(h.state.saved, 2);
  await h.prefs.save({ tableSale: "never" });
  h.listeners.storage({ [h.prefs.key]: { newValue: h.stored[h.prefs.key] } }, "local");
  await h.fire();
  assert.equal(h.state.saved, 3);
  assert.equal(h.text("Atendimento de Mesa - Venda"), "Nunca imprimir");
});

test("campo visível sem opção solicitada não salva nem marca sucesso", async () => {
  const h = harness({ tableSale: "never" });
  h.state.fields.get("Atendimento de Mesa - Venda").options =
    [{ value: "0", textContent: "Sempre Perguntar" }];
  assert.equal((await h.api.configure()).ok, false);
  assert.equal(h.state.saved, 0);
  assert.equal(h.session.size, 0);
});

test("falha ao ler preferências não usa o padrão silenciosamente", async () => {
  const h = harness();
  h.context.chrome.storage.local.get = async () => { throw new Error("storage unavailable"); };
  assert.equal((await h.api.configure()).ok, false);
  assert.equal(h.state.opened, 0);
  assert.equal(h.state.saved, 0);
});

test("mudança para login durante leitura cancela ações pendentes", async () => {
  const h = harness();
  let resolve;
  h.context.chrome.storage.local.get = () => new Promise((done) => { resolve = done; });
  const applying = h.api.configure();
  h.context.location.hash = "#/access/login";
  h.api.handleRouteChange();
  resolve({});
  assert.equal((await applying).ok, false);
  assert.equal(h.state.opened, 0);
});

test("valores inválidos são normalizados; configuração padrão mantém comportamento anterior", () => {
  const h = harness();
  const normalized = h.prefs.normalize({ tableSale: "invalid", printer: "never", unknown: "x" });
  assert.equal(normalized.tableSale, "always");
  assert.equal(normalized.printer, "computer");
  assert.equal(Object.keys(normalized).length, 7);
  assert.equal(h.prefs.targets({}).length, 7);
});
