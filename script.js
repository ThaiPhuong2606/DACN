function updateTime() {
    document.getElementById("time").innerText =
        new Date().toLocaleString("vi-VN");
}

setInterval(updateTime, 1000);
updateTime();

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

    // Nội dung mặc định ban đầu
    const defaultTitle = "CHĂM SÓC MẸ VÀ BÉ";
    const defaultDesc = "Tư vấn dinh dưỡng và lịch khám thai đầy đủ.";

    thumbs.forEach(thumb => {
        thumb.addEventListener("mouseenter", () => {
            const imgSrc = thumb.querySelector("img").src;
            const text = thumb.querySelector("p").innerText;

            // Hiện ảnh thumbnail lên main-slide
            mainImage.src = imgSrc;
            mainImage.style.display = "block";

            // Hiện nội dung tương ứng
            slideContent.innerHTML = `
                <h2>${text}</h2>
                <p>Thông tin chi tiết về: ${text}</p>
            `;

            mainSlide.style.background = "white";
        });

        thumb.addEventListener("mouseleave", () => {
            // Trả về mặc định
            mainImage.style.display = "none";

            slideContent.innerHTML = `
                ${defaultTitle}
                <br>
                <span>${defaultDesc}</span>
            `;

            mainSlide.style.background =
                "linear-gradient(135deg,#fff8c4,#fffde7)";
        });
    });
});