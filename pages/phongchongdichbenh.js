// ===== HIỂN THỊ GIỜ =====
function updateTime() {
    const now = new Date();

    document.getElementById("time").innerText =
        now.toLocaleString("vi-VN");
}

setInterval(updateTime, 1000);

// ===== DATA =====
let data = [
    {
        name: "Sốt xuất huyết",
        area: "Khu phố 4",
        cases: 5,
        date: "15/04/2024",
        status: "processing"
    },
    {
        name: "Tay chân miệng",
        area: "Khu phố 1",
        cases: 2,
        date: "10/04/2024",
        status: "done"
    }
];

// ===== RENDER TABLE =====
function renderTable(list) {

    const tbody = document.querySelector("tbody");

    tbody.innerHTML = "";

    list.forEach((item, index) => {

        tbody.innerHTML += `
        <tr>

            <td>${item.name}</td>

            <td>${item.area}</td>

            <td>${item.cases}</td>

            <td>${item.date}</td>

            <td>
                <span class="status ${item.status}">
                    ${item.status === "done"
                        ? "Hoàn thành"
                        : "Đang xử lý"}
                </span>
            </td>

            <td>
                <button onclick="deleteItem(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>

        </tr>
        `;
    });

    updateStats();
}

// ===== XÓA =====
function deleteItem(index) {

    if (confirm("Bạn muốn xóa dữ liệu này?")) {

        data.splice(index, 1);

        renderTable(data);
    }
}

// ===== THỐNG KÊ =====
function updateStats() {

    document.getElementById("totalCases").innerText =
        data.reduce((sum, item) => sum + item.cases, 0);

    document.getElementById("activeOutbreaks").innerText =
        data.filter(i => i.status === "processing").length;

    document.getElementById("processedCases").innerText =
        data.filter(i => i.status === "done").length;
}

// ===== FILTER =====
document.getElementById("filterStatus")
.addEventListener("change", function () {

    const value = this.value;

    if (value === "all") {
        renderTable(data);
    }
    else {

        const filtered =
            data.filter(i => i.status === value);

        renderTable(filtered);
    }
});

// ===== MODAL =====
const modal = document.getElementById("caseModal");

document.querySelector(".btn-add")
.addEventListener("click", () => {

    modal.classList.add("active");
});

document.getElementById("closeModal")
.addEventListener("click", () => {

    modal.classList.remove("active");
});

// CLICK NGOÀI ĐỂ ĐÓNG
window.addEventListener("click", (e) => {

    if (e.target === modal) {
        modal.classList.remove("active");
    }
});

// ===== THÊM DỮ LIỆU =====
document.getElementById("saveCase")
.addEventListener("click", () => {

    const name =
        document.getElementById("diseaseName").value;

    const area =
        document.getElementById("diseaseArea").value;

    const cases =
        document.getElementById("diseaseCases").value;

    const status =
        document.getElementById("diseaseStatus").value;

    if (!name || !area || !cases || !status) {

        alert("Vui lòng nhập đầy đủ thông tin!");

        return;
    }

    data.unshift({
        name,
        area,
        cases: parseInt(cases),
        date: new Date().toLocaleDateString("vi-VN"),
        status: status
    });

    renderTable(data);

    modal.classList.remove("active");

    // RESET INPUT
    document.getElementById("diseaseName").value = "";
    document.getElementById("diseaseArea").value = "";
    document.getElementById("diseaseCases").value = "";
    document.getElementById("diseaseStatus").value = "";

    // HIỆN TOAST
    showToast();
});

// ===== TOAST =====
function showToast() {

    const toast = document.getElementById("toast");

    toast.classList.add("show");

    setTimeout(() => {

        toast.classList.remove("show");

    }, 3000);
}

// ===== INIT =====
renderTable(data);

updateTime();