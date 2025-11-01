const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzxD92OEse2JY2kOKVqkogzHiCnmullDghB6sPsJCL8iRe48lRlTxYMFFMbU7tUzOUqFA/exec";

const form = document.getElementById("candidatura-form");
const messageContainer = document.getElementById("message-container");

function showMessage(msg, type = "error") {
  messageContainer.textContent = msg;
  messageContainer.className = `alert alert-${type}`;
  messageContainer.style.display = "block";
}

function hideMessage() {
  messageContainer.style.display = "none";
}

form.addEventListener("submit", async function (e) {
  e.preventDefault();
  hideMessage();

  const profissional = document.getElementById("form-profissional").value.trim();
  const paciente = document.getElementById("form-paciente").value.trim();
  const mesReferencia = document.getElementById("form-mes").value.trim();
  const fileInput = document.getElementById("form-arquivo");

  if (!profissional || !paciente || !mesReferencia || !fileInput.files.length) {
    showMessage("Todos os campos são obrigatórios!");
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = async function () {
    const fileData = reader.result.split(",")[1]; // base64

    const payload = {
      profissional,
      paciente,
      mesReferencia,
      fileName: file.name,
      mimeType: file.type,
      fileData
    };

    try {
      const response = await fetch(WEB_APP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.status === "success") {
        showMessage(`Candidatura enviada com sucesso! Link do arquivo: ${result.fileUrl}`, "success");
        form.reset();
      } else {
        throw new Error(result.message || "Erro desconhecido no servidor.");
      }

    } catch (err) {
      console.error(err);
      showMessage("Falha no envio: " + err.message);
    }
  };

  reader.onerror = function () {
    showMessage("Não foi possível ler o arquivo anexado.");
  };

  reader.readAsDataURL(file);
});
