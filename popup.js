(() => {
  "use strict";
  const store = globalThis.SaiposPrintPreferences;
  const form = document.getElementById("preferences");
  const fieldsRoot = document.getElementById("fields");
  const runButton = document.getElementById("run");
  const status = document.getElementById("status");
  const controls = new Map();
  let busy = false;

  function show(message, type = "") {
    status.className = type;
    status.textContent = message;
  }

  function setBusy(value) {
    busy = value;
    for (const element of form.querySelectorAll("button, select")) element.disabled = value;
  }

  function render(preferences) {
    const groups = new Map();
    for (const field of store.fields) {
      if (!groups.has(field.group)) {
        const fieldset = document.createElement("fieldset");
        const legend = document.createElement("legend");
        legend.textContent = field.group;
        const grid = document.createElement("div");
        grid.className = field.id === "printer" ? "fields single" : "fields";
        fieldset.append(legend, grid);
        fieldsRoot.append(fieldset);
        groups.set(field.group, grid);
      }
      const label = document.createElement("label");
      label.htmlFor = field.id;
      label.textContent = field.id === "printer" ? "Impressora Saipos Printer"
        : field.id.endsWith("Fiscal") ? "Cupom fiscal" : "Venda";
      const select = document.createElement("select");
      select.id = field.id;
      select.name = field.id;
      for (const [value, text] of field.options) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = text;
        select.append(option);
      }
      select.value = preferences[field.id];
      label.append(select);
      groups.get(field.group).append(label);
      controls.set(field.id, select);
    }
  }

  async function persist(applyNow) {
    if (busy) return;
    setBusy(true);
    let saved = false;
    show("Salvando preferências...");
    try {
      await store.save(Object.fromEntries([...controls].map(([id, select]) => [id, select.value])));
      saved = true;
      if (!applyNow) {
        show("Preferências salvas. Serão aplicadas automaticamente ao entrar; se a Saipos já estiver aberta, a execução será agendada.", "ok");
        return;
      }
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !/^https:\/\/([^.]+\.)*saipos\.com\//i.test(tab.url || "")) {
        throw new Error("Abra a aba da Saipos para aplicar agora.");
      }
      show("Preferências salvas. Aplicando na Saipos...");
      let result;
      try {
        result = await chrome.tabs.sendMessage(tab.id, { type: "SAIPOS_CONFIGURE_PRINTING" });
      } catch {
        throw new Error("Atualize a página da Saipos e tente novamente.");
      }
      if (!result?.ok) throw new Error(result?.message || "Não foi possível aplicar agora.");
      show(result.message, "ok");
    } catch (error) {
      show((saved ? "Preferências salvas. " : "Não foi possível salvar. ") + error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void persist(false);
  });
  runButton.addEventListener("click", () => void persist(true));
  form.addEventListener("change", () => show("Há alterações não salvas."));

  store.load().then((preferences) => {
    render(preferences);
    setBusy(false);
    show("Escolha o comportamento de cada campo e salve.");
  }).catch(() => {
    show("Não foi possível carregar as preferências. Recarregue a extensão.", "error");
  });
})();
