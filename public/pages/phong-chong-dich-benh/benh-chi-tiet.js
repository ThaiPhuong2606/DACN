const diseaseContent = {
  "sot-xuat-huyet": {
    tag: "Cảnh báo cao",
    title: "Dịch Sốt Xuất Huyết",
    intro:
      "Sốt xuất huyết là bệnh truyền nhiễm do virus Dengue gây ra, lây qua muỗi vằn. Bệnh có thể diễn tiến nhanh nếu không theo dõi sát.",
    image:
      "https://www.startpage.com/av/proxy-image?piurl=https%3A%2F%2Ftse1.explicit.bing.net%2Fth%2Fid%2FOIP.34kfkceVDMO9e60qsFQWMAHaEo%3Fpid%3DApi&sp=1781531388T472f2f5ed1398c00ed813d991fd39674edccd6ac0848fefeb99878705434de71",
    symptoms: [
      "Sốt cao đột ngột 39-40 độ C kéo dài.",
      "Đau đầu, đau sau hốc mắt, đau mỏi cơ khớp.",
      "Có thể có chấm xuất huyết dưới da, chảy máu chân răng."
    ],
    prevention: [
      "Dọn dẹp vật dụng chứa nước đọng, thay nước bình hoa thường xuyên.",
      "Ngủ màn cả ban ngày và ban đêm, mặc quần áo dài tay.",
      "Phối hợp phun thuốc diệt muỗi theo hướng dẫn của địa phương."
    ],
    warning: [
      "Nôn ói liên tục, đau bụng nhiều, vật vã hoặc li bì.",
      "Chảy máu mũi, chảy máu chân răng, tiểu ít.",
      "Sốt cao không hạ sau 48 giờ cần đến cơ sở y tế ngay."
    ]
  },
  "tay-chan-mieng": {
    tag: "Theo dõi chặt",
    title: "Bệnh Tay Chân Miệng",
    intro:
      "Bệnh tay chân miệng thường gặp ở trẻ nhỏ, lây qua đường tiêu hóa và tiếp xúc với dịch tiết. Cần cách ly và vệ sinh đúng cách để hạn chế lây lan.",
    image:
      "https://images.unsplash.com/photo-1584515933487-779824d29309?q=80&w=1400&auto=format&fit=crop",
    symptoms: [
      "Sốt nhẹ hoặc sốt vừa, mệt mỏi.",
      "Loét miệng gây đau, biếng ăn, chảy nước bọt.",
      "Nổi bóng nước ở lòng bàn tay, lòng bàn chân, mông."
    ],
    prevention: [
      "Rửa tay bằng xà phòng trước khi chăm sóc trẻ và trước bữa ăn.",
      "Vệ sinh đồ chơi, sàn nhà, tay nắm cửa bằng dung dịch khử khuẩn.",
      "Không cho trẻ dùng chung khăn, ly, muỗng với trẻ đang bệnh."
    ],
    warning: [
      "Trẻ giật mình, ngủ gà, nôn nhiều, thở mệt.",
      "Sốt cao không đáp ứng thuốc hạ sốt.",
      "Trẻ bỏ ăn, bỏ uống, có dấu hiệu mất nước."
    ]
  },
  "cum-ho-hap": {
    tag: "Mùa đông xuân",
    title: "Cúm Mùa và Bệnh Hô Hấp",
    intro:
      "Cúm mùa là bệnh nhiễm virus đường hô hấp, lây nhanh qua giọt bắn. Người già, trẻ nhỏ và người bệnh nền cần được bảo vệ chủ động.",
    image:
      "https://images.unsplash.com/photo-1584118624012-df056829fbd0?q=80&w=1400&auto=format&fit=crop",
    symptoms: [
      "Ho, sổ mũi, đau họng, hắt hơi liên tục.",
      "Sốt, lạnh run, đau mỏi cơ.",
      "Mệt mỏi, khó tập trung, có thể khó thở nhẹ."
    ],
    prevention: [
      "Đeo khẩu trang nơi đông người, rửa tay thường xuyên.",
      "Tiêm vắc xin cúm định kỳ hằng năm cho nhóm nguy cơ.",
      "Giữ không gian thông thoáng, hạn chế tiếp xúc gần khi có triệu chứng."
    ],
    warning: [
      "Khó thở tăng dần, đau ngực, tím tái.",
      "Sốt cao trên 3 ngày không giảm.",
      "Người có bệnh nền nhưng xuất hiện mệt lả và lừ đừ."
    ]
  }
};

const params = new URLSearchParams(window.location.search);
const key = params.get("benh") || "sot-xuat-huyet";
const selected = diseaseContent[key] || diseaseContent["sot-xuat-huyet"];

document.title = `${selected.title} - Trạm Y Tế Phường 10`;
document.getElementById("diseaseTag").textContent = selected.tag;
document.getElementById("diseaseTitle").textContent = selected.title;
document.getElementById("diseaseIntro").textContent = selected.intro;

const imageEl = document.getElementById("diseaseImage");
imageEl.src = selected.image;
imageEl.alt = selected.title;

function renderList(id, items) {
  const root = document.getElementById(id);
  root.innerHTML = "";
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    root.appendChild(li);
  });
}

renderList("symptomList", selected.symptoms);
renderList("preventionList", selected.prevention);
renderList("warningList", selected.warning);
