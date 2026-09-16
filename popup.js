const button = document.getElementById("run");
const status = document.getElementById("status");

button.addEventListener("click", async () => {
  button.disabled = true;
  status.className = "";
  status.textContent = "Aplicando...";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https:\/\/([^.]+\.)*saipos\.com\//i.test(tab.url || "")) {
      throw new Error("Abra o sistema Saipos nesta aba.");
    }

    const result = await chrome.tabs.sendMessage(tab.id, {
      type: "SAIPOS_CONFIGURE_PRINTING"
    });

    if (!result?.ok) throw new Error(result?.message || "Não foi possível aplicar.");
    status.className = "ok";
    status.textContent = result.message;
  } catch (error) {
    status.className = "error";
    status.textContent = error.message || "Não foi possível acessar a página.";
  } finally {
    button.disabled = false;
  }
});
