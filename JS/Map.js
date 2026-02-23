const txtBtn = document.getElementById("textBtn");

if (txtBtn) {
    txtBtn.addEventListener("click", () => {
        StickyApp.saveProject();
        window.location.href = "index.html";
    });
}

function showDeleteToolbar(showNote = false) {

  const mediaToolbar   = document.getElementById("mediaToolbar");
  const deleteToolbar  = document.getElementById("deleteToolbar");
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

  const mediaToolbar   = document.getElementById("mediaToolbar");
  const deleteToolbar  = document.getElementById("deleteToolbar");
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

});