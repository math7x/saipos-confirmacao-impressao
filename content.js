(() => {
  "use strict";

  const CONFIG = {
    modalTitle: "Configurar confirmações de impressão",
    menuText: "Confirmações de Impressão",
    saveText: "SALVAR"
  };

  const preferencesStore = globalThis.SaiposPrintPreferences;
  const SESSION_KEY = "saipos-print-confirmations-configured-v2";
  const LOGIN_HASH = "#/access/login";
  const TARGET_HASHES = [
    "#/app/sale/delivery/kanban/search-customer",
    "#/app/sale/service-ticket/main",
    "#/app/sale/table-order/new-main"
  ];
  const LOGIN_DELAY_MS = 4000;
  const RETRY_DELAY_MS = 5000;
  let running = false;
  let automaticTimer = null;
  let routeRevision = 0;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function normalized(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      // A interface antiga da Saipos inclui ícones como caracteres de fonte
      // privada dentro do texto dos links (perfil, impressora etc.).
      .replace(/[\uE000-\uF8FF]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function visible(element) {
    if (!(element instanceof Element)) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity) !== 0 &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  function clickable(element) {
    if (!(element instanceof Element)) return null;
    return element.closest(
      "button, a, [role='button'], [role='menuitem'], md-list-item, mat-list-item, .md-button, .mat-mdc-button, .mat-button"
    );
  }

  function elementsWithText(text, root = document) {
    const wanted = normalized(text);
    const elements = root.querySelectorAll(
      "button, a, label, strong, span, div, p, h1, h2, h3, h4, md-option, mat-option, [role='button'], [role='menuitem'], [role='option']"
    );

    return [...elements]
      .filter(visible)
      .filter((element) => normalized(element.textContent) === wanted)
      .sort((a, b) => a.childElementCount - b.childElementCount);
  }

  function findExactText(text, root = document) {
    return elementsWithText(text, root)[0] || null;
  }

  function loginIsVisible() {
    return [...document.querySelectorAll("input[type='password']")].some(visible);
  }

  function blockingDialogIsVisible() {
    const printTitle = normalized(CONFIG.modalTitle);
    const dialogs = document.querySelectorAll(
      "[role='dialog'], .modal.in, .modal[style*='display: block']"
    );

    return [...dialogs].some((dialog) => {
      if (!visible(dialog)) return false;
      // A própria janela de impressão pode continuar caso já tenha sido aberta.
      return !normalized(dialog.textContent).includes(printTitle);
    });
  }

  function toast(message, type = "info") {
    document.getElementById("saipos-print-helper-toast")?.remove();
    const element = document.createElement("div");
    element.id = "saipos-print-helper-toast";
    element.textContent = message;
    Object.assign(element.style, {
      position: "fixed",
      top: "18px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: "2147483647",
      maxWidth: "520px",
      padding: "12px 18px",
      borderRadius: "5px",
      color: "#fff",
      background: type === "error" ? "#b3261e" : type === "success" ? "#137333" : "#303134",
      boxShadow: "0 4px 18px rgba(0,0,0,.35)",
      font: "600 14px Arial, sans-serif",
      textAlign: "center"
    });
    document.documentElement.appendChild(element);
    setTimeout(() => element.remove(), type === "error" ? 9000 : 5000);
  }

  async function waitFor(getter, timeoutMs = 7000, intervalMs = 120) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      const value = getter();
      if (value) return value;
      await sleep(intervalMs);
    }
    return null;
  }

  function profileButton() {
    const explicitSelectors = [
      "[aria-label*='perfil' i]",
      "[aria-label*='minha conta' i]",
      "[aria-label*='usuário' i]",
      "[aria-label*='usuario' i]",
      "[title*='perfil' i]",
      "[title*='minha conta' i]"
    ];

    for (const selector of explicitSelectors) {
      const found = [...document.querySelectorAll(selector)].find(visible);
      if (found) {
        const internalToggle = found.querySelector?.(
          "[uib-dropdown-toggle], .dropdown-toggle, button, a, [role='button']"
        );
        return clickable(internalToggle) || internalToggle || clickable(found) || found;
      }
    }

    const saiposAccount = [...document.querySelectorAll("li[title]")].find(
      (element) => visible(element) && normalized(element.getAttribute("title")) === "minha conta"
    );
    if (saiposAccount) {
      return saiposAccount.querySelector("[uib-dropdown-toggle], .dropdown-toggle, a, button");
    }

    const materialIcons = [...document.querySelectorAll("i, md-icon, mat-icon")]
      .filter(visible)
      .filter((element) => {
        const text = normalized(element.textContent).replace(/ /g, "_");
        return ["person", "account_circle", "account_box", "perm_identity"].includes(text);
      });

    if (materialIcons.length) {
      return clickable(materialIcons[materialIcons.length - 1]) || materialIcons[materialIcons.length - 1];
    }

    const candidates = [...document.querySelectorAll("header button, nav button, [class*='header'] button, [class*='toolbar'] button")]
      .filter(visible)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.top < Math.max(100, innerHeight * 0.18) && rect.left > innerWidth * 0.7;
      })
      .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right);

    return candidates[0] || null;
  }

  async function openPrintDialog(checkReady = () => {}) {
    checkReady();
    const alreadyOpenTitle = findExactText(CONFIG.modalTitle);
    if (alreadyOpenTitle) {
      return (
        alreadyOpenTitle.closest("[role='dialog'], md-dialog, mat-dialog-container, .modal, .modal-content") ||
        alreadyOpenTitle.parentElement?.parentElement ||
        document
      );
    }

    let menuItem = findExactText(CONFIG.menuText);

    if (!menuItem) {
      const profile = profileButton();
      if (!profile) return null;
      profile.click();
      menuItem = await waitFor(() => findExactText(CONFIG.menuText), 5000);
    }

    if (!menuItem) return null;
    checkReady();
    (clickable(menuItem) || menuItem).click();

    const title = await waitFor(() => findExactText(CONFIG.modalTitle), 7000);
    if (!title) return null;
    return (
      title.closest("[role='dialog'], md-dialog, mat-dialog-container, .modal, .modal-content") ||
      title.parentElement?.parentElement ||
      document
    );
  }

  function fieldContainer(labelElement, modal) {
    const knownContainer = labelElement.closest(
      "md-input-container, mat-form-field, .mat-mdc-form-field, .form-group, [class*='select-container'], [class*='form-field']"
    );
    if (knownContainer) return knownContainer;

    let node = labelElement.parentElement;
    while (node && node !== modal) {
      if (node.querySelector("select, md-select, mat-select, [role='combobox']")) return node;
      node = node.parentElement;
    }
    return labelElement.parentElement;
  }

  function selectControl(container) {
    if (!container) return null;
    if (container.matches?.("select, md-select, mat-select, [role='combobox']")) return container;
    return container.querySelector("select, md-select, mat-select, [role='combobox']");
  }

  function currentSelectText(control) {
    if (control instanceof HTMLSelectElement) {
      return control.options[control.selectedIndex]?.textContent || control.value;
    }
    return control.textContent || control.getAttribute("aria-label") || "";
  }

  async function chooseOption(modal, labelText, desiredText) {
    const label = findExactText(labelText, modal);
    if (!label) throw new Error(`Campo não encontrado: ${labelText}`);

    const container = fieldContainer(label, modal);
    const control = selectControl(container);
    if (!control) throw new Error(`Seletor não encontrado: ${labelText}`);

    // Comparação exata: "Não Imprimir Neste Computador" contém o texto
    // "Imprimir neste Computador", mas é uma escolha diferente.
    if (normalized(currentSelectText(control)) === normalized(desiredText)) return;

    if (control instanceof HTMLSelectElement) {
      const option = [...control.options].find(
        (item) => normalized(item.textContent) === normalized(desiredText)
      );
      if (!option || option.disabled || control.disabled) {
        throw new Error(`Opção indisponível: ${desiredText}`);
      }
      control.value = option.value;
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    control.scrollIntoView({ block: "center", inline: "nearest" });
    control.click();

    const option = await waitFor(() => {
      const matches = elementsWithText(desiredText);
      return matches.find((element) => {
        if (!visible(element)) return false;
        if (element.closest("md-option, mat-option, [role='option']")) return true;
        return Boolean(clickable(element));
      });
    }, 5000);

    if (!option) {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      throw new Error(`Opção não encontrada: ${desiredText}`);
    }

    const target = option.closest("md-option, mat-option, [role='option']") || clickable(option) || option;
    target.click();
    await sleep(250);
  }

  function findSaveButton(modal) {
    const match = findExactText(CONFIG.saveText, modal);
    return match ? clickable(match) || match : null;
  }

  async function configure({ manual = false } = {}) {
    if (running) return { ok: false, message: "A configuração já está em andamento." };
    if (loginIsVisible()) {
      sessionStorage.removeItem(SESSION_KEY);
      return { ok: false, skipped: true, message: "Aguardando o login." };
    }
    if (blockingDialogIsVisible()) {
      return {
        ok: false,
        skipped: true,
        message: "Aguardando a janela atual da Saipos ser concluída."
      };
    }

    running = true;
    if (manual) clearAutomaticTimer();
    const revision = routeRevision;
    function checkReady() {
      if (revision !== routeRevision || loginIsVisible() || (!manual && !isTargetPage())) {
        throw new Error("A página mudou. Aguardando a próxima execução.");
      }
      if (blockingDialogIsVisible()) {
        throw new Error("Aguardando a janela atual da Saipos ser concluída.");
      }
    }
    try {
      const preferences = await preferencesStore.load();
      const fingerprint = preferencesStore.fingerprint(preferences);
      if (!manual && sessionStorage.getItem(SESSION_KEY) === fingerprint) {
        return { ok: true, skipped: true, message: "Preferências já aplicadas nesta sessão." };
      }
      checkReady();
      const targets = preferencesStore.targets(preferences);
      if (!targets.length) {
        sessionStorage.setItem(SESSION_KEY, fingerprint);
        return { ok: true, message: "Todos os campos estão em Não alterar. Nada foi modificado." };
      }
      const modal = await openPrintDialog(checkReady);
      if (!modal) throw new Error("Não foi possível abrir as confirmações de impressão.");

      const available = targets.filter(([label]) => findExactText(label, modal));
      if (!available.length) {
        throw new Error("Nenhum dos campos escolhidos está disponível nesta janela.");
      }

      for (const [label, desired] of available) {
        // Nem todas as lojas possuem Delivery, Fichas e Mesas habilitados.
        checkReady();
        await chooseOption(modal, label, desired);
      }

      checkReady();
      for (const [label, desired] of available) {
        const labelElement = findExactText(label, modal);
        const control = labelElement && selectControl(fieldContainer(labelElement, modal));
        if (!control || normalized(currentSelectText(control)) !== normalized(desired)) {
          throw new Error(`Não foi possível confirmar a escolha em: ${label}. Nada foi salvo.`);
        }
      }

      const save = findSaveButton(modal);
      if (!save || save.disabled || save.getAttribute("aria-disabled") === "true") {
        throw new Error("Botão SALVAR indisponível.");
      }
      save.click();
      const closed = await waitFor(() => !findExactText(CONFIG.modalTitle), 7000);
      if (!closed) throw new Error("A janela não fechou após salvar. Confira a mensagem da Saipos.");
      checkReady();

      sessionStorage.setItem(SESSION_KEY, fingerprint);
      const summary = `${available.length} preferências de impressão aplicadas e salvas.`;
      toast(summary, "success");
      return { ok: true, message: summary };
    } catch (error) {
      console.warn("[Saipos Impressão]", error);
      if (manual) toast(error.message, "error");
      return { ok: false, message: error.message };
    } finally {
      running = false;
    }
  }

  function currentHash() {
    return location.hash.split("?")[0].replace(/\/$/, "");
  }

  function isTargetPage() {
    return TARGET_HASHES.includes(currentHash());
  }

  function clearAutomaticTimer() {
    if (automaticTimer) clearTimeout(automaticTimer);
    automaticTimer = null;
  }

  function scheduleTargetRun(delayMs) {
    clearAutomaticTimer();
    automaticTimer = setTimeout(async () => {
      automaticTimer = null;

      if (!isTargetPage()) return;

      if (blockingDialogIsVisible()) {
        scheduleTargetRun(RETRY_DELAY_MS);
        return;
      }

      const result = await configure();
      if (!result.ok && isTargetPage()) {
        scheduleTargetRun(RETRY_DELAY_MS);
      }
    }, delayMs);
  }

  function handleRouteChange() {
    routeRevision += 1;
    const hash = currentHash();

    if (hash === LOGIN_HASH) {
      clearAutomaticTimer();
      sessionStorage.removeItem(SESSION_KEY);
      return;
    }

    if (TARGET_HASHES.includes(hash)) {
      scheduleTargetRun(LOGIN_DELAY_MS);
      return;
    }

    clearAutomaticTimer();
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "SAIPOS_CONFIGURE_PRINTING") return;
    configure({ manual: true }).then(sendResponse);
    return true;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[preferencesStore.key]) return;
    sessionStorage.removeItem(SESSION_KEY);
    handleRouteChange();
  });

  window.addEventListener("hashchange", handleRouteChange);
  handleRouteChange();
})();
