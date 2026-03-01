const txtBtn = document.getElementById("textBtn");

if (txtBtn) {
  txtBtn.addEventListener("click", () => {
    StickyApp.saveProject();
    window.location.href = "index.html";
  });
}

function showDeleteToolbar(showNote = false) {

  const mediaToolbar = document.getElementById("mediaToolbar");
  const deleteToolbar = document.getElementById("deleteToolbar");
  const actionToolbars = document.getElementById("actionToolbars");

  // Nascondo tutto
  mediaToolbar?.classList.add("hidden");
  deleteToolbar?.classList.add("hidden");
  actionToolbars?.classList.add("hidden");

  if (!showNote) {
    // ORA: false = NOTA
    deleteToolbar?.classList.remove("hidden");
  } else {
    // ORA: true = NODO
    actionToolbars?.classList.remove("hidden");
  }
}
function hideDeleteToolbar() {

  const mediaToolbar = document.getElementById("mediaToolbar");
  const deleteToolbar = document.getElementById("deleteToolbar");
  const actionToolbars = document.getElementById("actionToolbars");

  deleteToolbar?.classList.add("hidden");
  actionToolbars?.classList.add("hidden");

  mediaToolbar?.classList.remove("hidden");
}

document.addEventListener("DOMContentLoaded", () => {

  const deleteTb = document.getElementById("deleteToolbar");
  const noteTb = document.getElementById("NoteToolbar");

  if (!window.StickyApp) return;

  // 🔹 Quando trascini un nodo → mostra entrambe
  document.addEventListener("dragstart", (e) => {

    if (!e.target.classList.contains("map-node")) return;

    if (deleteTb) deleteTb.classList.remove("hidden");
    if (noteTb) noteTb.classList.remove("hidden");
  });

  // 🔹 Quando finisci di trascinare → nascondi tutto
  document.addEventListener("dragend", (e) => {

    if (!e.target.classList.contains("map-node")) return;

    if (deleteTb) deleteTb.classList.add("hidden");
    if (noteTb) noteTb.classList.add("hidden");
  });

  const settingsBtn = document.getElementById("settingsBtn");
  const overlay = document.getElementById("settingsOverlay");
  const closeBtn = document.getElementById("closeSettings");

  if (!settingsBtn || !overlay) return;

  // 🔵 Apri overlay
  settingsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    overlay.classList.remove("hidden");
  });

  // 🔴 Chiudi con X
  closeBtn?.addEventListener("click", () => {
    overlay.classList.add("hidden");
  });

  // 🔴 Chiudi cliccando fuori dal pannello
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlay.classList.add("hidden");
    }
  });

  const saveBtn = document.getElementById("save");

  if (!saveBtn || !window.StickyApp) return;

  saveBtn.addEventListener("click", async () => {

    StickyApp.saveProject();

    const raw = localStorage.getItem(StickyApp.projectKey);
    if (!raw) return;

    try {

      const handle = await window.showSaveFilePicker({
        suggestedName: "mappa.json",
        types: [{
          description: "JSON File",
          accept: { "application/json": [".json"] }
        }]
      });

      const writable = await handle.createWritable();
      await writable.write(raw);
      await writable.close();

    } catch (err) {
      console.log("Salvataggio annullato");
    }

  });


  const importBtn = document.getElementById("import");

  if (!importBtn || !window.StickyApp) return;

  importBtn.addEventListener("click", () => {

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";

    input.addEventListener("change", (e) => {

      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();

      reader.onload = (event) => {

        try {

          const json = JSON.parse(event.target.result);

          // 🔥 Validazione minima
          if (!json.mapNodes && !json.textNotes) {
            alert("File non valido");
            return;
          }

          // Salva nel localStorage
          localStorage.setItem(
            StickyApp.projectKey,
            JSON.stringify(json)
          );

          // Chiudi overlay
          overlay?.classList.add("hidden");

          // 🔄 Ricarica pagina per applicare
          location.reload();

        } catch (err) {
          alert("Errore nel file JSON");
        }
      };

      reader.readAsText(file);
    });

    input.click();
  });


  const exportBtn = document.getElementById("export");

  if (exportBtn && window.StickyApp) {

    exportBtn.addEventListener("click", async () => {

      if (!window.showSaveFilePicker) return;

      const canvasElement = document.getElementById("canvas");
      if (!canvasElement) return;

      try {

        // 🔥 Apri direttamente file system
        const handle = await window.showSaveFilePicker({
          suggestedName: "mappa",
          types: [
            {
              description: "PDF File",
              accept: { "application/pdf": [".pdf"] }
            },
            {
              description: "PNG Image",
              accept: { "image/png": [".png"] }
            }
          ]
        });

        const fileName = handle.name.toLowerCase();

        // 🔥 Nascondi toolbar temporaneamente
        document.querySelectorAll(".toolbar")
          .forEach(t => t.classList.add("hidden"));

        const canvasImage = await html2canvas(canvasElement, {
          backgroundColor: "#ffffff",
          scale: 2
        });

        document.querySelectorAll(".toolbar")
          .forEach(t => t.classList.remove("hidden"));

        let blob;

        // 🔥 Se termina con .pdf → crea PDF
        if (fileName.endsWith(".pdf")) {

          const { jsPDF } = window.jspdf;

          const pdf = new jsPDF({
            orientation: "landscape",
            unit: "px",
            format: [canvasImage.width, canvasImage.height]
          });

          const imgData = canvasImage.toDataURL("image/png");

          pdf.addImage(
            imgData,
            "PNG",
            0,
            0,
            canvasImage.width,
            canvasImage.height
          );

          blob = pdf.output("blob");

        } else {
          // 🔥 Default PNG
          blob = await new Promise(resolve =>
            canvasImage.toBlob(resolve, "image/png")
          );
        }

        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();

      } catch (err) {
        // Utente ha annullato → non fare nulla
      }

    });
  }

});