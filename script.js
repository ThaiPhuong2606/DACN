function updateTime() {
    document.getElementById("time").innerText =
        new Date().toLocaleString("vi-VN");
}

setInterval(updateTime, 1000);
updateTime();

const loginBtn = document.querySelector(".login");
const authModal = document.getElementById("authModal");
const closeAuthModalBtn = document.getElementById("closeAuthModal");

function openAuthModal() {
    if (!authModal) return;
    authModal.classList.add("is-open");
    authModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
}

function closeAuthModal() {
    if (!authModal) return;
    authModal.classList.remove("is-open");
    authModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
}

if (loginBtn && authModal) {
    loginBtn.addEventListener("click", openAuthModal);

    if (closeAuthModalBtn) {
        closeAuthModalBtn.addEventListener("click", closeAuthModal);
    }

    authModal.addEventListener("click", (event) => {
        if (event.target === authModal) {
            closeAuthModal();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && authModal.classList.contains("is-open")) {
            closeAuthModal();
        }
    });
}

function scrollThumb(dir) {
    const row = document.getElementById("thumbRow");
    const card = row.querySelector(".thumb").offsetWidth + 10;

    row.scrollBy({
        left: dir * card * 2,
        behavior: "smooth"
    });
}

const news = [
    {
        img: "img/tin1.jpg",
        title: "Tin số 1",
        desc: "Mô tả tin số 1"
    },
    {
        img: "img/tin2.jpg",
        title: "Tin số 2",
        desc: "Mô tả tin số 2"
    },
    {
        img: "img/tin3.jpg",
        title: "Tin số 3",
        desc: "Mô tả tin số 3"
    },
    {
        img: "img/tin4.jpg",
        title: "Mô tả tin số 4",
        desc: "Mô tả tin số 4"
    }
];

window.addEventListener("load", () => {
    const thumbs = document.querySelectorAll(".thumb");
    const mainImage = document.getElementById("mainImage");
    const slideContent = document.getElementById("slideContent");
    const mainSlide = document.getElementById("slideText");

    // Lấy ảnh và tiêu đề từ thumbnail đầu tiên
    if (thumbs.length > 0) {
        const firstThumb = thumbs[0];
        const firstImgSrc = firstThumb.querySelector("img").src;
        const firstText = firstThumb.querySelector("p").innerText;

        mainImage.src = firstImgSrc;
        mainImage.style.display = "block";
        slideContent.innerHTML = `
            <h2>${firstText}</h2>
            <p>Thông tin chi tiết về ${firstText}</p>
        `;
    }

    thumbs.forEach(thumb => {
        thumb.addEventListener("mouseenter", () => {
    const imgSrc = thumb.querySelector("img").src;
    const text = thumb.querySelector("p").innerText;

    mainImage.src = imgSrc;
    mainImage.style.display = "block";

    slideContent.innerHTML = `
        <h2>${text}</h2>
        <p>Thông tin chi tiết về ${text}</p>
    `;
});

        thumb.addEventListener("mouseleave", () => {
    // Quay lại thumbnail đầu tiên khi rời chuột
    if (thumbs.length > 0) {
        const firstThumb = thumbs[0];
        const firstImgSrc = firstThumb.querySelector("img").src;
        const firstText = firstThumb.querySelector("p").innerText;
        
        mainImage.src = firstImgSrc;
        mainImage.style.display = "block";
        slideContent.innerHTML = `
            <h2>${firstText}</h2>
            <p>Thông tin chi tiết về ${firstText}</p>
        `;
    }
});
    });

    const dateInput = document.querySelector('input[type="date"]');
    const timeInput = document.querySelector('input[type="time"]');

    const disableKeyboardEntry = (input) => {
        if (!input) return;
        input.addEventListener('keydown', (e) => {
            const allowKeys = ['Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Escape'];
            if (!allowKeys.includes(e.key)) {
                e.preventDefault();
            }
        });
        input.addEventListener('keypress', (e) => {
            e.preventDefault();
        });
        input.addEventListener('paste', (e) => e.preventDefault());
        input.addEventListener('drop', (e) => e.preventDefault());
    };

    disableKeyboardEntry(dateInput);
    disableKeyboardEntry(timeInput);

    const familySelect = document.getElementById("family");
    const nameInput = document.getElementById("name");
    const phoneInput = document.getElementById("phone");
    const emailInput = document.getElementById("email");

    if (familySelect) {
        familySelect.addEventListener("change", (e) => {
            if (e.target.value === "self") {
                const userProfile = JSON.parse(localStorage.getItem("userProfile") || "{}");
                
                if (userProfile.name) {
                    nameInput.value = userProfile.name;
                    nameInput.disabled = true;
                } else {
                    nameInput.value = "";
                    nameInput.disabled = true;
                }

                if (userProfile.phone) {
                    phoneInput.value = userProfile.phone;
                    phoneInput.disabled = true;
                } else {
                    phoneInput.value = "";
                    phoneInput.disabled = true;
                }

                if (userProfile.email) {
                    emailInput.value = userProfile.email;
                    emailInput.disabled = true;
                } else {
                    emailInput.value = "";
                    emailInput.disabled = true;
                }
            } else {
                nameInput.value = "";
                nameInput.disabled = false;
                phoneInput.value = "";
                phoneInput.disabled = false;
                emailInput.value = "";
                emailInput.disabled = false;
            }
        });
    }
});