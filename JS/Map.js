const txtBtn = document.getElementById("textBtn");

if (txtBtn) {
    txtBtn.addEventListener("click", () => {
        StickyApp.saveProject();
        window.location.href = "index.html";
    });
}