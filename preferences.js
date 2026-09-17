(() => {
  "use strict";
  const key = "saiposPrintPreferencesV1";
  const printingOptions = [
    ["always", "Sempre Imprimir"], ["never", "Nunca imprimir"],
    ["ask", "Sempre Perguntar"], ["keep", "Não alterar"]
  ];
  const fields = [
    { id: "printer", label: "Impressora Saipos Printer", group: "Computador",
      defaultValue: "computer", options: [
        ["computer", "Imprimir neste Computador"],
        ["disabled", "Não Imprimir Neste Computador"],
        ["ask", "Perguntar ao Iniciar"], ["keep", "Não alterar"]
      ] },
    { id: "deliverySale", label: "Delivery - Venda", group: "Delivery" },
    { id: "deliveryFiscal", label: "Delivery - Cupom fiscal", group: "Delivery" },
    { id: "ticketSale", label: "Atendimento por Fichas - Venda", group: "Fichas" },
    { id: "ticketFiscal", label: "Atendimento por Fichas - Cupom fiscal", group: "Fichas" },
    { id: "tableSale", label: "Atendimento de Mesa - Venda", group: "Mesas" },
    { id: "tableFiscal", label: "Atendimento de Mesa - Cupom fiscal", group: "Mesas" }
  ].map((field) => ({ defaultValue: "always", options: printingOptions, ...field }));

  function normalize(input) {
    const candidate = input && typeof input === "object" ? input : {};
    return Object.fromEntries(fields.map((field) => [
      field.id,
      field.options.some(([value]) => value === candidate[field.id])
        ? candidate[field.id] : field.defaultValue
    ]));
  }
  async function load() {
    const stored = await chrome.storage.local.get(key);
    return normalize(stored[key]);
  }
  async function save(input) {
    const preferences = normalize(input);
    await chrome.storage.local.set({ [key]: preferences });
    return preferences;
  }
  function targets(input) {
    const preferences = normalize(input);
    return fields.filter((field) => preferences[field.id] !== "keep")
      .map((field) => [field.label,
        field.options.find(([value]) => value === preferences[field.id])[1]]);
  }
  globalThis.SaiposPrintPreferences = {
    key, fields, normalize, load, save, targets,
    fingerprint: (input) => JSON.stringify(normalize(input))
  };
})();
