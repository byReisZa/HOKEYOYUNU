// Sayfa geçiş
function showSection(id) {
    document.querySelectorAll("section").forEach(sec => {
        sec.classList.remove("active");
    });
    document.getElementById(id).classList.add("active");
}

// YKS Sayaç
function updateCountdown() {
    const examDate = new Date("2026-06-21");
    const now = new Date();
    const diff = examDate - now;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    document.getElementById("countdown").innerText = days + " gün kaldı";
}
setInterval(updateCountdown, 1000);

// Deneme
function addDeneme() {
    let input = document.getElementById("denemeInput");
    let value = input.value;

    if (value === "") return;

    let li = document.createElement("li");
    li.innerText = "Net: " + value;

    document.getElementById("denemeList").appendChild(li);

    input.value = "";
}

// Ders Programı (LocalStorage)
function saveProgram() {
    let data = document.getElementById("programInput").value;
    localStorage.setItem("program", data);
    alert("Kaydedildi!");
}

window.onload = function () {
    document.getElementById("programInput").value =
        localStorage.getItem("program") || "";
};

// Not Ortalaması
let notlar = [];

function addNot() {
    let val = document.getElementById("notInput").value;
    if (val === "") return;

    notlar.push(Number(val));

    let toplam = notlar.reduce((a, b) => a + b, 0);
    let ort = toplam / notlar.length;

    document.getElementById("ortalama").innerText =
        "Ortalama: " + ort.toFixed(2);

    document.getElementById("notInput").value = "";
}
