

window.scrollThumb = function(dir) {
    const row = document.getElementById("thumbRow");
    if (!row) return;

    const firstThumb = row.querySelector(".thumb");
    if (!firstThumb) return;

    const cardWidth = firstThumb.offsetWidth + 10;
    row.scrollBy({
        left: dir * cardWidth * 2,
        behavior: "smooth"
    });
};

import { loginWithGoogle, login, register, isEmailRegistered, saveData, logout, onAuthStateChanged, auth, db } from "./app.js";
import { translations } from "./translations.js";
import {
  collection, query, where,
  onSnapshot, doc, runTransaction, getDocs,
  serverTimestamp, Timestamp, addDoc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const ALL_SLOTS = ['07:30','08:00','08:30','09:00','09:30','10:00',
                   '10:30','11:00','13:30','14:00','14:30','15:00'];

let currentLang = "VI";
const LANG_STORAGE_KEY = "siteLang";
const GOOGLE_TRANSLATE_COOKIE = "googtrans";
const LANG_RELOAD_GUARD = "langReloadGuard";

function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function setGoogleTranslateCookie(targetLang) {
  const value = `/vi/${targetLang}`;
  document.cookie = `${GOOGLE_TRANSLATE_COOKIE}=${encodeURIComponent(value)};path=/;max-age=31536000`;
}

function ensureGoogleTranslateBootstrapped() {
  if (!document.getElementById("google_translate_element")) {
    const holder = document.createElement("div");
    holder.id = "google_translate_element";
    holder.style.display = "none";
    document.body.appendChild(holder);
  }

  if (!document.getElementById("google-translate-script")) {
    window.googleTranslateElementInit = function () {
      if (window.google && window.google.translate) {
        new google.translate.TranslateElement(
          { pageLanguage: "vi", autoDisplay: false },
          "google_translate_element"
        );
      }
    };

    const script = document.createElement("script");
    script.id = "google-translate-script";
    script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    script.async = true;
    document.head.appendChild(script);
  }
}

function protectIconsFromTranslation() {
  const iconSelectors = [
    ".material-symbols-outlined",
    ".ti",
    ".fa-solid",
    ".fa-regular",
    ".fa-brands",
    ".lang svg"
  ];

  document.querySelectorAll(iconSelectors.join(",")).forEach((el) => {
    el.classList.add("notranslate");
    el.setAttribute("translate", "no");
  });
}

function syncGlobalLanguage(lang, shouldReload) {
  const targetLang = lang === "EN" ? "en" : "vi";
  const desiredCookie = `/vi/${targetLang}`;
  const currentCookie = getCookie(GOOGLE_TRANSLATE_COOKIE);

  localStorage.setItem(LANG_STORAGE_KEY, lang);

  if (currentCookie === desiredCookie) {
    sessionStorage.removeItem(LANG_RELOAD_GUARD);
    return;
  }

  setGoogleTranslateCookie(targetLang);

  if (!shouldReload) return;

  const guardValue = sessionStorage.getItem(LANG_RELOAD_GUARD);
  if (guardValue === desiredCookie) return;
  sessionStorage.setItem(LANG_RELOAD_GUARD, desiredCookie);
  window.location.reload();
}

function applyLanguage(lang) {
  const t = translations[lang];
  currentLang = lang;

  document.querySelector(".menu_about") && (document.querySelector(".menu_about").textContent = t.menu_about);
  document.querySelector(".menu_vaccine") && (document.querySelector(".menu_vaccine").textContent = t.menu_vaccine);
  document.querySelector(".menu_health") && (document.querySelector(".menu_health").textContent = t.menu_health);
  document.querySelector(".menu_disease") && (document.querySelector(".menu_disease").textContent = t.menu_disease);
  document.querySelector(".menu_child") && (document.querySelector(".menu_child").textContent = t.menu_child);
  document.querySelector(".search")?.setAttribute("placeholder", t.search_placeholder);

  document.querySelector(".VN").style.opacity = lang === "VI" ? "1" : "0.5";
  document.querySelector(".EN").style.opacity = lang === "EN" ? "1" : "0.5";

  // Dịch select options
  const family = document.getElementById("family");
  if (family) {
    family.options[0].text = t.form_select_default;
    family.options[1].text = t.form_self;
    family.options[2].text = t.form_spouse;
    family.options[3].text = t.form_child;
    family.options[4].text = t.form_parent;
    family.options[5].text = t.form_siblings;
  }
}

async function loadUserProfile(user) {
  const userRef = doc(db, 'users', user.uid);
  let userData = null;

  try {
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      userData = snap.data();
    } else {
      const patientCode = '#BN-' + Math.floor(10000 + Math.random() * 90000);
      userData = {
        name: user.displayName || user.email.split('@')[0],
        email: user.email,
        phone: 'Chưa cập nhật',
        address: 'Chưa cập nhật',
        patientCode: patientCode,
        role: 'patient',
        year: new Date().getFullYear() - 30,
        gender: 'nam',
        height: 0,
        weight: 0,
        blood: '',
        insurance: '',
        allergy: '',
        createdAt: new Date().toISOString(),
      };
      await setDoc(userRef, userData);
    }

    // Cập nhật member[0] là bản thân từ Firestore
    members = [{
      id: 0,
      name: userData.name || 'Chưa cập nhật',
      year: userData.year || new Date().getFullYear() - 30,
      gender: userData.gender || 'nam',
      rel: 'Bản thân',
      height: userData.height || 0,
      weight: userData.weight || 0,
      blood: userData.blood || '',
      phone: userData.phone || 'Chưa cập nhật',
      address: userData.address || 'Chưa cập nhật',
      patientCode: userData.patientCode || '',
      self: true,
      allergy: userData.allergy || '',
      insurance: userData.insurance || '',
      history: userData.history || [],
    }];

    // Load thành viên gia đình từ Firestore
    const familySnap = await getDocs(
      collection(db, 'users', user.uid, 'family')
    );
    familySnap.forEach((d, idx) => {
      const f = d.data();
      members.push({
        id: idx + 1,
        firestoreId: d.id,
        name: f.name || '',
        year: f.year || 2000,
        gender: f.gender || 'nam',
        rel: f.rel || 'Khác',
        height: f.height || 0,
        weight: f.weight || 0,
        blood: f.blood || '',
        phone: f.phone || '',
        address: f.address || '',
        patientCode: f.patientCode || '#BN-' + Math.floor(10000 + Math.random() * 90000),
        self: false,
        allergy: f.allergy || '',
        insurance: f.insurance || '',
        history: f.history || [],
      });
    });

    nextId = members.length;

    // Cập nhật header
    const nameEl = document.getElementById('patientName');
    const metaEl = document.getElementById('patientMeta');
    const codeEl = document.getElementById('patientCode');
    const avatarEl = document.getElementById('patientAvatar');
    const addressEl = document.getElementById('patientAddress');

    if (nameEl) nameEl.textContent = userData.name;
    if (metaEl) metaEl.textContent = `SĐT: ${userData.phone} · Nhóm máu: ${userData.blood || 'Chưa rõ'}`;
    if (codeEl) codeEl.textContent = userData.patientCode;
    if (addressEl) addressEl.innerHTML = `<i class="ti ti-map-pin" style="font-size:11px"></i> ${userData.address}`;
    if (avatarEl) {
      avatarEl.textContent = userData.name
        .trim().split(/\s+/).slice(-2)
        .map(p => p[0].toUpperCase()).join('');
    }

    renderPatients();

    // Kiểm tra role
    if (userData.role === 'doctor') {
      const patientPanel = document.getElementById('patientPanel');
      const doctorPanel = document.getElementById('doctorPanel');
      if (patientPanel) patientPanel.style.display = 'none';
      if (doctorPanel) doctorPanel.style.display = 'block';
      openDoctorModal(userData);
    } else {
      const patientHeader = document.getElementById('patientHeader');
      const mainFlow = document.getElementById('mainFlow');
      const loginPrompt = document.getElementById('loginPrompt');
      if (patientHeader) patientHeader.style.display = 'block';
      if (mainFlow) mainFlow.style.display = 'block';
      if (loginPrompt) loginPrompt.style.display = 'none';
    }

  } catch (err) {
    console.error('Lỗi load profile:', err);
  }
}

//     // ── KIỂM TRA ROLE ──
//     if (userData.role === 'doctor') {
//       // Ẩn patient panel, hiện doctor panel
//       const patientPanel = document.getElementById('patientPanel');
//       const doctorPanel = document.getElementById('doctorPanel');
//       if (patientPanel) patientPanel.style.display = 'none';
//       if (doctorPanel) doctorPanel.style.display = 'block';
//       openDoctorModal(userData);
//     } else {
//       // Hiện patient panel bình thường
//       const patientHeader = document.getElementById('patientHeader');
//       const mainFlow = document.getElementById('mainFlow');
//       const loginPrompt = document.getElementById('loginPrompt');
//       if (patientHeader) patientHeader.style.display = 'block';
//       if (mainFlow) mainFlow.style.display = 'block';
//       if (loginPrompt) loginPrompt.style.display = 'none';
//     }

//   } catch (err) {
//     console.error('Lỗi load profile:', err);
//   }
// }

function updateUI(user) {
  const btnLogin = document.querySelector(".login");
  const loginPrompt = document.getElementById("loginPrompt");
  const doctorPanel = document.getElementById("doctorPanel");
  const patientPanel = document.getElementById("patientPanel");
  const patientHeader = document.getElementById("patientHeader");
  const mainFlow = document.getElementById("mainFlow");

  if (user) {
    btnLogin.style.display = "none";

    // Reset về trạng thái mặc định, loadUserProfile sẽ tự điều chỉnh
    if (loginPrompt) loginPrompt.style.display = "none";
    if (doctorPanel) doctorPanel.style.display = "none";
    if (patientPanel) patientPanel.style.display = "block";
    if (patientHeader) patientHeader.style.display = "none";
    if (mainFlow) mainFlow.style.display = "none";

    // Load profile — tự quyết định hiện doctor hay patient
    loadUserProfile(user);

    let userInfo = document.getElementById("user-info");
    if (!userInfo) {
      userInfo = document.createElement("div");
      userInfo.id = "user-info";
      btnLogin.parentNode.insertBefore(userInfo, btnLogin);
    }
    userInfo.innerHTML = `
      <span>Xin chào, ${user.displayName || user.email}</span>
      <button id="btn-logout" class="btn-logout-modern" aria-label="Đăng xuất">
        <i class="material-symbols-outlined">logout</i>
        <span>Đăng xuất</span>
      </button>
    `;
    document.getElementById("btn-logout").addEventListener("click", async () => {
      const btn = document.getElementById("btn-logout");
      btn.disabled = true;
      btn.style.opacity = "0.7";
      await logout();
    });

  } else {
    btnLogin.style.display = "block";
    if (loginPrompt) loginPrompt.style.display = "block";
    if (doctorPanel) doctorPanel.style.display = "none";
    if (patientPanel) patientPanel.style.display = "block";
    if (patientHeader) patientHeader.style.display = "none";
    if (mainFlow) mainFlow.style.display = "none";

    const userInfo = document.getElementById("user-info");
    if (userInfo) userInfo.remove();
  }
}

function updateTime() {
  const el = document.getElementById("time");
  if (el) el.innerText = new Date().toLocaleString("vi-VN");
}

function init() {

  protectIconsFromTranslation();
  ensureGoogleTranslateBootstrapped();

  // Đồng hồ
  setInterval(updateTime, 1000);
  updateTime();

  // Ngôn ngữ
  document.querySelector(".VN").addEventListener("click", () => {
    applyLanguage("VI");
    syncGlobalLanguage("VI", true);
  });
  document.querySelector(".EN").addEventListener("click", () => {
    applyLanguage("EN");
    syncGlobalLanguage("EN", true);
  });

  const savedLang = localStorage.getItem(LANG_STORAGE_KEY) || "VI";
  applyLanguage(savedLang);
  syncGlobalLanguage(savedLang, true);

  // Thumbnail slider
  const thumbs = document.querySelectorAll(".thumb");
  const mainImage = document.getElementById("mainImage");
  const slideContent = document.getElementById("slideContent");

  if (thumbs.length > 0 && mainImage && slideContent) {
    const first = thumbs[0];
    mainImage.src = first.querySelector("img").src;
    mainImage.style.display = "block";
    slideContent.innerHTML = `<h2>${first.querySelector("p").innerText}</h2>`;

    thumbs.forEach(thumb => {
      thumb.addEventListener("mouseenter", () => {
        mainImage.src = thumb.querySelector("img").src;
        slideContent.innerHTML = `<h2>${thumb.querySelector("p").innerText}</h2>`;
      });
      thumb.addEventListener("mouseleave", () => {
        mainImage.src = thumbs[0].querySelector("img").src;
        slideContent.innerHTML = `<h2>${thumbs[0].querySelector("p").innerText}</h2>`;
      });
    });
  }

  // Disable keyboard trên date/time input
  [document.querySelector('input[type="date"]'), document.querySelector('input[type="time"]')].forEach(input => {
    if (!input) return;
    input.addEventListener('keydown', e => {
      if (!['Tab','Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Escape'].includes(e.key)) e.preventDefault();
    });
    input.addEventListener('keypress', e => e.preventDefault());
    input.addEventListener('paste', e => e.preventDefault());
    input.addEventListener('drop', e => e.preventDefault());
  });

  // Form đặt lịch - tự điền thông tin
  const familySelect = document.getElementById("family");
  if (familySelect) {
    familySelect.addEventListener("change", (e) => {
      const nameInput = document.getElementById("name");
      const phoneInput = document.getElementById("phone");
      const emailInput = document.getElementById("email");
      if (e.target.value === "self") {
        const p = JSON.parse(localStorage.getItem("userProfile") || "{}");
        nameInput.value = p.name || ""; nameInput.disabled = true;
        phoneInput.value = p.phone || ""; phoneInput.disabled = true;
        emailInput.value = p.email || ""; emailInput.disabled = true;
      } else {
        ["name","phone","email"].forEach(id => {
          document.getElementById(id).value = "";
          document.getElementById(id).disabled = false;
        });
      }
    });
  }

  // Popup đăng nhập
  document.querySelector(".login").addEventListener("click", () => {
    document.getElementById("popup-overlay").style.display = "block";
    const em = document.getElementById("error-msg");
    if (em) { em.style.color = 'red'; em.textContent = ""; }
  });

  document.getElementById("popup-close").addEventListener("click", () => {
    document.getElementById("popup-overlay").style.display = "none";
  });

  document.getElementById("popup-overlay").addEventListener("click", (e) => {
    if (e.target === document.getElementById("popup-overlay"))
      document.getElementById("popup-overlay").style.display = "none";
  });

  document.getElementById("btn-email-login").addEventListener("click", async () => {
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    if (!email || !password) {
      document.getElementById("error-msg").textContent = "Vui lòng nhập email và mật khẩu!";
      return;
    }
    try {
      await login(email, password);
      document.getElementById("popup-overlay").style.display = "none";
    } catch {
      const em = document.getElementById("error-msg");
      if (em) { em.style.color = 'red'; em.textContent = "Sai email hoặc mật khẩu!"; }
    }
  });

  document.getElementById("btn-google").addEventListener("click", async () => {
    try {
      await loginWithGoogle();
      document.getElementById("popup-overlay").style.display = "none";
    } catch {
      const em = document.getElementById("error-msg");
      if (em) { em.style.color = 'red'; em.textContent = "Đăng nhập Google thất bại!"; }
    }
  });

  document.getElementById("btn-register").addEventListener("click", () => {
    document.getElementById("popup-overlay").style.display = "none";
    document.getElementById("popup-register").style.display = "block";
    document.getElementById("register-error").textContent = "";
  });

  // Popup đăng ký
  document.getElementById("register-close").addEventListener("click", () => {
    document.getElementById("popup-register").style.display = "none";
  });

  document.getElementById("popup-register").addEventListener("click", (e) => {
    if (e.target === document.getElementById("popup-register"))
      document.getElementById("popup-register").style.display = "none";
  });

  document.getElementById("back-to-login").addEventListener("click", () => {
    document.getElementById("popup-register").style.display = "none";
    document.getElementById("popup-overlay").style.display = "block";
  });

  document.getElementById("btn-submit-register").addEventListener("click", async () => {
    const name = document.getElementById("register-name").value;
    const email = document.getElementById("register-email").value;
    const password = document.getElementById("register-password").value;
    const confirm = document.getElementById("register-confirm").value;

    if (!name || !email || !password || !confirm) {
      document.getElementById("register-error").textContent = "Vui lòng điền đầy đủ thông tin!"; return;
    }
    if (password !== confirm) {
      document.getElementById("register-error").textContent = "Mật khẩu xác nhận không khớp!"; return;
    }
    // Password rules: minimum 8, maximum 16 characters
    const minLen = 8;
    const maxLen = 16;
    if (password.length < minLen) {
      document.getElementById("register-error").textContent = `Mật khẩu phải có ít nhất ${minLen} ký tự!`; return;
    }
    if (password.length > maxLen) {
      document.getElementById("register-error").textContent = `Mật khẩu chỉ được tối đa ${maxLen} ký tự!`; return;
    }
    if (/\s/.test(password)) {
      document.getElementById("register-error").textContent = "Mật khẩu không được chứa khoảng trắng!"; return;
    }

    // Pre-check email existence to provide immediate feedback
    try {
      const exists = await isEmailRegistered(email);
      if (exists) {
        document.getElementById("register-error").textContent = "Email này đã được dùng!"; return;
      }
    } catch (e) {
      // If check fails, continue and rely on server-side error handling
      console.warn('Email check failed, falling back to createUser:', e);
    }

    try {
      const user = await register(email, password);
      await saveData("users", user.uid, { name, email, createdAt: new Date().toISOString() });
      // Đăng ký thành công: sign out ngay để yêu cầu người dùng đăng nhập thủ công
      await logout();
      document.getElementById("popup-register").style.display = "none";
      // Hiện popup đăng nhập và điền trước email (thông báo xanh lá)
      const overlay = document.getElementById("popup-overlay");
      if (overlay) overlay.style.display = "block";
      const loginEmailEl = document.getElementById("login-email");
      if (loginEmailEl) loginEmailEl.value = email;
      const loginPwdEl = document.getElementById("login-password");
      if (loginPwdEl) loginPwdEl.value = "";
      const em = document.getElementById("error-msg");
      if (em) { em.style.color = 'green'; em.textContent = "Đăng ký thành công — vui lòng đăng nhập."; }
    } catch (err) {
      document.getElementById("register-error").textContent =
        err.code === "auth/email-already-in-use" ? "Email này đã được dùng!" : (err.message || 'Lỗi đăng ký');
    }
  });

  // Theo dõi trạng thái đăng nhập
  onAuthStateChanged(auth, updateUI);
    
    }

    if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
    } else {
    init();
    }

    window._init = init;

  /* ── DATA ── */
  let members = [];
  let nextId = 0;
 
  const services = [
    { id: 'gp',     icon: '🩺', name: 'Khám tổng quát',   sub: 'Đa khoa' },
    { id: 'blood',  icon: '🩸', name: 'Xét nghiệm máu',   sub: 'Huyết học' },
    { id: 'refill', icon: '💊', name: 'Tái khám & thuốc', sub: 'Nội khoa' },
    { id: 'ecg',    icon: '❤️', name: 'Điện tim (ECG)',    sub: 'Tim mạch' },
    { id: 'vac',    icon: '💉', name: 'Tiêm chủng',        sub: 'Phòng ngừa' },
    { id: 'dental', icon: '🦷', name: 'Răng miệng',        sub: 'Nha khoa' },
  ];
 
  
 
  let sel = { patient: 0, date: null, dateLabel: null, time: null };
  let confirmed = false;
  let slotStatusMap = {};
  let unsubscribeSlots = null;
 
  /* ── HELPERS ── */
  function getDays() {
    const DAY_LABELS = ['CN','T2','T3','T4','T5','T6','T7'];
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return {
        day: DAY_LABELS[d.getDay()],
        num: d.getDate(),
        iso: d.toISOString().split('T')[0],
        full: d.toLocaleDateString('vi-VN'),
        hasSlots: i < 5,
      };
    });
  }
 
  function calcBMI(h, w) {
    if (!h || !w) return '';
    return 'BMI ' + (w / Math.pow(h / 100, 2)).toFixed(1);
  }

  function getInitials(name) {
    return name
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map(part => part.charAt(0).toUpperCase())
      .join('');
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getSelectedMember() {
    return members.find(x => x.id === sel.patient);
  }

  function updatePatientHeader() {
    const member = getSelectedMember();
    if (!member) return;

    const avatar = document.getElementById('patientAvatar');
    const name = document.getElementById('patientName');
    const address = document.getElementById('patientAddress');
    const meta = document.getElementById('patientMeta');
    const code = document.getElementById('patientCode');

    if (avatar) avatar.textContent = getInitials(member.name);
    if (name) name.textContent = member.name;
    if (address) {
      address.innerHTML = `<i class="ti ti-map-pin" style="font-size:11px"></i> ${member.address || 'Chưa cập nhật địa chỉ'}`;
    }
    if (meta) {
      const phone = member.phone || 'Chưa cập nhật';
      const blood = member.blood || 'Chưa rõ';
      meta.textContent = `SĐT: ${phone} · Nhóm máu: ${blood}`;
    }
    if (code) code.textContent = member.patientCode || `#BN-${String(member.id).padStart(5, '0')}`;
  }

  function buildPatientFacts(member) {
  const currentYear = new Date().getFullYear();

  const fields = [
    { label: 'Quan hệ',              key: 'rel',       value: member.rel,                                            editable: false },
    { label: 'Tuổi',                 key: 'year',      value: String(currentYear - member.year),                     editable: true, type: 'select', options: Array.from({ length: 100 }, (_, i) => String(i + 1)) },
    { label: 'Giới tính',            key: 'gender',    value: member.gender || '',                                   editable: true, type: 'select', options: ['Nam','Nữ','Khác'] },
    { label: 'Chiều cao / Cân nặng', key: '_hw',       value: `${member.height||'?'} cm / ${member.weight||'?'} kg`, editable: false },
    { label: 'Nhóm máu',             key: 'blood',     value: member.blood || 'Chưa rõ',                             editable: true, type: 'select', options: ['','A+','A-','B+','B-','AB+','AB-','O+','O-'] },
    { label: 'Liên hệ',              key: 'phone',     value: member.phone || '',                                    editable: true, type: 'text' },
    { label: 'Địa chỉ',              key: 'address',   value: member.address || '',                                  editable: true, type: 'text' },
    { label: 'Bảo hiểm',             key: 'insurance', value: member.insurance || '',                                editable: true, type: 'text' },
    { label: 'Dị ứng / Bệnh nền',    key: 'allergy',   value: member.allergy || '',                                  editable: true, type: 'text' },
  ];

  function cardHTML(f) {
    const isWide = f.key === 'allergy';
    const spanStyle = isWide ? 'grid-column:span 2' : '';

    if (!f.editable) {
      return `
        <div class="detail-fact" style="${spanStyle}">
          <span class="detail-fact-label">${escapeHtml(f.label)}</span>
          <span class="detail-fact-value">${escapeHtml(String(f.value))}</span>
        </div>`;
    }

    if (f.type === 'select') {
      return `
        <div class="detail-fact" style="${spanStyle}">
          <span class="detail-fact-label">${escapeHtml(f.label)}</span>
          <select
            id="edit_${f.key}"
            onchange="autoSaveFact('${f.key}', this.value)"
            style="border:none;background:transparent;font-size:15px;font-weight:700;
                   color:#1a3a5c;width:100%;outline:none;cursor:pointer;padding:0"
          >
            ${f.options.map(o => `
              <option value="${o}" ${f.value === o ? 'selected' : ''}>
                ${o || 'Chưa rõ'}
              </option>`).join('')}
          </select>
        </div>`;
    }

    return `
      <div class="detail-fact" style="${spanStyle}" onclick="focusEdit('${f.key}')">
        <span class="detail-fact-label">${escapeHtml(f.label)}</span>
        <input
          id="edit_${f.key}"
          type="${f.type}"
          value="${escapeHtml(String(f.value))}"
          onchange="autoSaveFact('${f.key}', this.value)"
          style="border:none;background:transparent;font-size:15px;font-weight:700;
                 color:#1a3a5c;width:100%;outline:none;cursor:pointer;padding:0"
          placeholder="${escapeHtml(f.label)}..."
        >
      </div>`;
  }

  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      ${fields.map(f => cardHTML(f)).join('')}
    </div>
    <div style="display:flex;justify-content:center;margin-top:14px">
      <button onclick="saveAllFacts()" style="
        padding:10px 24px;border-radius:12px;
        border:none;background:rgb(97, 168, 255);color:#fff;
        font-size:14px;font-weight:600;cursor:pointer;
        display:flex;align-items:center;justify-content:center;gap:6px;
      ">
        <i class="ti ti-device-floppy" style="font-size:16px"; background:rgb(97, 168, 255)></i> Lưu thay đổi
      </button>
    </div>
  `;
}

function focusEdit(key) {
  const el = document.getElementById('edit_' + key);
  if (el) el.focus();
}
window.focusEdit = focusEdit;

  function buildPatientHistory(member) {
  if (!member.history || !member.history.length) {
    return '<div class="history-item"><div class="history-note">Chưa có lịch sử khám cho bệnh nhân này.</div></div>';
  }

  return member.history.map(item => `
    <div class="history-item">
      <div class="history-top">
        <div>
          <div class="history-title">${escapeHtml(item.department || item.methods?.join(', ') || 'Khám bệnh')}</div>
          <div class="history-date">${escapeHtml(item.date)} · ${escapeHtml(item.doctor || item.doctorName || 'Bác sĩ')}</div>
        </div>
        <span class="history-status">${escapeHtml(item.status || 'Đã hoàn tất')}</span>
      </div>
      <div class="history-meta">Chẩn đoán: ${escapeHtml(item.diagnosis || 'Chưa có')}</div>
      <div class="history-note">Ghi chú: ${escapeHtml(item.note || item.treatmentNote || 'Không có')}</div>
    </div>`).join('');
}

  function getPrescriptionItemsByDiagnosis(diagnosis) {
    const text = String(diagnosis || '').toLowerCase();
    if (text.includes('viêm họng') || text.includes('hô hấp')) {
      return [
        { name: 'Paracetamol 500mg', qty: '10 viên', usage: '1 viên x 3 lần/ngày sau ăn' },
        { name: 'Alpha Chymotrypsin', qty: '10 viên', usage: '1 viên x 2 lần/ngày' }
      ];
    }
    if (text.includes('viêm da')) {
      return [
        { name: 'Cetirizine 10mg', qty: '7 viên', usage: '1 viên buổi tối' },
        { name: 'Kem Hydrocortisone 1%', qty: '1 tuýp', usage: 'Bôi mỏng 2 lần/ngày' }
      ];
    }
    if (text.includes('tim') || text.includes('đau ngực')) {
      return [
        { name: 'Magie B6', qty: '20 viên', usage: '1 viên x 2 lần/ngày' },
        { name: 'Vitamin nhóm B', qty: '20 viên', usage: '1 viên/ngày sau ăn sáng' }
      ];
    }
    return [
      { name: 'Vitamin C 500mg', qty: '10 viên', usage: '1 viên/ngày sau ăn' },
      { name: 'Nước muối sinh lý 0.9%', qty: '1 chai', usage: 'Dùng theo hướng dẫn bác sĩ' }
    ];
  }

  function buildPrescriptionsFromHistory(member) {
    const history = Array.isArray(member?.history) ? member.history : [];
    return history.map((item, idx) => ({
      id: `DT-${String(idx + 1).padStart(3, '0')}`,
      date: item.date || '',
      doctor: item.doctor || 'Chưa cập nhật',
      diagnosis: item.diagnosis || 'Chưa cập nhật',
      note: item.note || 'Không có ghi chú',
      items: getPrescriptionItemsByDiagnosis(item.diagnosis)
    }));
  }

  function buildPrescriptionList(member) {
    const prescriptions = buildPrescriptionsFromHistory(member);
    if (!prescriptions.length) {
      return '<div class="history-item"><div class="history-note">Chưa có dữ liệu đơn thuốc cho bệnh nhân này.</div></div>';
    }

    return prescriptions.map((p, index) => `
      <button type="button" class="prescription-item" onclick="showPrescriptionDetail(${index})">
        <div>
          <div class="history-title">${escapeHtml(p.id)} - ${escapeHtml(p.diagnosis)}</div>
          <div class="prescription-meta">${escapeHtml(p.date)} · ${escapeHtml(p.doctor)}</div>
        </div>
        <span class="history-status">${p.items.length} thuốc</span>
      </button>
    `).join('');
  }

  function buildPrescriptionSupport(member) {
    const history = Array.isArray(member?.history) ? member.history : [];
    const latest = history[0] || null;
    const latestDate = latest?.date || 'Chưa có lịch khám';
    const reminder = latest
      ? `Tái khám sau 7-14 ngày kể từ ${latestDate} hoặc sớm hơn nếu triệu chứng nặng hơn.`
      : 'Hiện chưa có dữ liệu lịch khám để nhắc tái khám.';

    return `
      <div class="prescription-support-card">
        <div class="patient-detail-section-title">Lưu ý dùng thuốc</div>
        <ul class="prescription-support-list">
          <li>Dùng thuốc đúng liều, đúng giờ theo hướng dẫn trong đơn.</li>
          <li>Không tự ý ngưng thuốc kháng sinh khi chưa đủ liệu trình.</li>
          <li>Nếu có phản ứng bất thường (mẩn ngứa, khó thở), liên hệ cơ sở y tế ngay.</li>
        </ul>
        <div class="prescription-reminder">${escapeHtml(reminder)}</div>
      </div>
    `;
  }

  async function showPatientTab(tab) {
  const profilePanel = document.getElementById('patientTabProfile');
  const prescriptionPanel = document.getElementById('patientTabPrescriptions');
  document.querySelectorAll('.patient-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  if (tab === 'prescriptions') {
    if (profilePanel) profilePanel.style.display = 'none';
    if (prescriptionPanel) prescriptionPanel.style.display = 'block';

    const member = getSelectedMember();
    const list = document.getElementById('detailPrescriptions');
    const support = document.getElementById('prescriptionSupport');

    if (list) list.innerHTML = '<div class="history-note">Đang tải...</div>';

    // Load toa thuốc từ Firestore
    try {
      const userId = auth.currentUser?.uid;
      const snap = await getDocs(
        query(collection(db, 'prescriptions'), where('apptId', 'in',
          await getDocs(query(collection(db, 'appointments'), where('userId', '==', userId)))
            .then(s => s.docs.map(d => d.id).slice(0, 10))
        ))
      );

      const prescriptions = [];
      snap.forEach(d => prescriptions.push({ id: d.id, ...d.data() }));

      if (list) {
        if (!prescriptions.length) {
          list.innerHTML = '<div class="history-item"><div class="history-note">Chưa có toa thuốc.</div></div>';
        } else {
          list.innerHTML = prescriptions.map((p, idx) => `
            <button type="button" class="prescription-item" onclick="showFirestorePrescriptionDetail(${idx}, ${JSON.stringify(p).replace(/"/g, '&quot;')})">
              <div>
                <div class="history-title">DT-${String(idx+1).padStart(3,'0')} · ${escapeHtml(p.patientName || '')}</div>
                <div class="prescription-meta">${escapeHtml(p.createdAt?.toDate?.()?.toLocaleDateString('vi-VN') || '')} · BS. ${escapeHtml(p.doctorName || '')}</div>
              </div>
              <span class="history-status">${p.items?.length || 0} thuốc</span>
            </button>
          `).join('');
        }
      }
    } catch (err) {
      console.error('Lỗi load prescriptions:', err);
      if (member && list) list.innerHTML = buildPrescriptionList(member);
    }

    if (member && support) support.innerHTML = buildPrescriptionSupport(member);
    closePrescriptionDetail();
    return;
  }

  if (profilePanel) profilePanel.style.display = 'block';
  if (prescriptionPanel) prescriptionPanel.style.display = 'none';
}

function showFirestorePrescriptionDetail(idx, p) {
  const listEl = document.getElementById('detailPrescriptions');
  const detailEl = document.getElementById('prescriptionDetail');
  const dateEl = document.getElementById('prescDate');
  const doctorEl = document.getElementById('prescDoctor');
  const itemsEl = document.getElementById('prescItems');
  const noteEl = document.getElementById('prescNote');

  if (listEl) listEl.style.display = 'none';
  if (detailEl) detailEl.style.display = 'block';
  if (dateEl) dateEl.textContent = `Ngày: ${p.createdAt?.toDate?.()?.toLocaleDateString('vi-VN') || ''}`;
  if (doctorEl) doctorEl.textContent = `Bác sĩ: ${p.doctorName || ''}`;
  if (itemsEl) {
    itemsEl.innerHTML = (p.items || []).map(med => `
      <div class="prescription-item-row">
        <div>
          <strong>${escapeHtml(med.name)}</strong><br>
          <span class="prescription-meta">${escapeHtml(med.usage)}</span>
        </div>
        <div>${escapeHtml(med.qty)}</div>
      </div>
    `).join('');
  }
  if (noteEl) noteEl.textContent = '';
}


function showPrescriptionDetail(index) {
    const member = getSelectedMember();
    if (!member) return;
    const prescriptions = buildPrescriptionsFromHistory(member);
    const p = prescriptions[index];
    if (!p) return;

    const listEl = document.getElementById('detailPrescriptions');
    const detailEl = document.getElementById('prescriptionDetail');
    const dateEl = document.getElementById('prescDate');
    const doctorEl = document.getElementById('prescDoctor');
    const itemsEl = document.getElementById('prescItems');
    const noteEl = document.getElementById('prescNote');

    if (listEl) listEl.style.display = 'none';
    if (detailEl) detailEl.style.display = 'block';
    if (dateEl) dateEl.textContent = `Ngày: ${p.date}`;
    if (doctorEl) doctorEl.textContent = `Bác sĩ: ${p.doctor}`;
    if (itemsEl) {
      itemsEl.innerHTML = p.items.map(med => `
        <div class="prescription-item-row">
          <div>
            <strong>${escapeHtml(med.name)}</strong><br>
            <span class="prescription-meta">${escapeHtml(med.usage)}</span>
          </div>
          <div>${escapeHtml(med.qty)}</div>
        </div>
      `).join('');
    }
    if (noteEl) noteEl.textContent = `Ghi chú: ${p.note}`;
  }

  function closePrescriptionDetail() {
    const listEl = document.getElementById('detailPrescriptions');
    const detailEl = document.getElementById('prescriptionDetail');
    if (detailEl) detailEl.style.display = 'none';
    if (listEl) listEl.style.display = 'grid';
  }

  async function openPatientDetail() {
  const member = getSelectedMember();
  if (!member) return;

  const avatar = document.getElementById('detailAvatar');
  const name = document.getElementById('detailName');
  const code = document.getElementById('detailCode');
  const facts = document.getElementById('detailFacts');
  const history = document.getElementById('detailHistory');
  const modal = document.getElementById('patientDetailModal');

  if (avatar) avatar.textContent = getInitials(member.name);
  if (name) name.textContent = member.name;
  if (code) code.textContent = member.patientCode || '';
  if (facts) facts.innerHTML = buildPatientFacts(member);

  // Load lịch sử khám từ Firestore
  if (history) {
    history.innerHTML = '<div class="history-note">Đang tải...</div>';
    try {
      const userId = auth.currentUser?.uid;
      if (userId) {
        const q = query(
          collection(db, 'appointments'),
          where('userId', '==', userId)
        );
        const snap = await getDocs(q);
        const firestoreHistory = [];
        snap.forEach(d => {
          const data = d.data();
          if (data.status === 'examined' || data.status === 'completed') {
            firestoreHistory.push({
              date: data.date || '',
              doctor: data.doctorName || 'Bác sĩ',
              department: data.methods ? data.methods.join(', ') : 'Khám bệnh',
              diagnosis: data.diagnosis || 'Chưa có',
              note: data.treatmentNote || '',
              status: data.status === 'completed' ? 'Đã hoàn tất' : 'Đã khám',
            });
          }
        });

        // Gộp với history tĩnh nếu có
        const allHistory = [...firestoreHistory, ...(member.history || [])];
        member.history = allHistory;
        history.innerHTML = buildPatientHistory(member);
      }
    } catch (err) {
      console.error('Lỗi load history:', err);
      history.innerHTML = buildPatientHistory(member);
    }
  }

  showPatientTab('profile');
  if (modal) modal.classList.add('open');
}

async function loadPrescriptionsFromFirestore() {
  const userId = auth.currentUser?.uid;
  if (!userId) return [];

  try {
    const q = query(
      collection(db, 'prescriptions'),
      where('userId', '==', userId)
    );
    const snap = await getDocs(q);
    const prescriptions = [];
    snap.forEach(d => {
      prescriptions.push({ id: d.id, ...d.data() });
    });
    return prescriptions;
  } catch (err) {
    console.error('Lỗi load prescriptions:', err);
    return [];
  }
}

function closePatientDetail() {
    document.getElementById('patientDetailModal')?.classList.remove('open');
  }
 
  /* ── RENDER PATIENTS ── */
  function renderPatients() {
    const grid = document.getElementById('patientGrid');
    const currentYear = new Date().getFullYear();
    grid.innerHTML = members.map(m => {
      const age = currentYear - m.year;
      const bmi = calcBMI(m.height, m.weight);
      const isSel = sel.patient === m.id;
      return `
        <div class="patient-option${isSel ? ' selected' : ''}" onclick="selectPatient(${m.id})">
          <div class="po-top">
            <div>
              <div class="po-name">${m.name}</div>
              <div class="po-meta">${age} tuổi · ${m.gender}${m.blood ? ' · ' + m.blood : ''}</div>
              <div class="po-meta">${m.height ? m.height + 'cm' : ''}${m.weight ? ' · ' + m.weight + 'kg' : ''}${bmi ? ' · ' + bmi : ''}</div>
            </div>
            <div class="po-right">
              <span class="po-tag">${m.rel}</span>
              <div class="po-check">${isSel ? '<i class="ti ti-check" style="font-size:10px"></i>' : ''}</div>
            </div>
          </div>
        </div>`;
    }).join('');
  }
 
  /* ── RENDER SERVICES ── */
  function renderServices() {
    document.getElementById('serviceGrid').innerHTML = services.map(s => `
      <div class="service-card${sel.service === s.id ? ' selected' : ''}" onclick="selectService('${s.id}')">
        <span class="sc-icon">${s.icon}</span>
        <div>
          <div class="sc-name">${s.name}</div>
          <div class="sc-sub">${s.sub}</div>
        </div>
        ${sel.service === s.id ? '<i class="ti ti-check" style="margin-left:auto;font-size:16px;color:var(--green)"></i>' : ''}
      </div>`).join('');
  }
 
  /* ── RENDER DATES ── */
  function selectDate(iso, full) {
  sel.date = iso;
  sel.dateLabel = full;
  sel.time = null;
  renderDates();
  updateSummary();

  // Hủy listener ngày cũ
  if (unsubscribeSlots) {
    unsubscribeSlots();
    unsubscribeSlots = null;
  }

  slotStatusMap = {};
  renderTimes();

  // Lắng nghe real-time slots của ngày mới
  const q = query(collection(db, 'slots'), where('date', '==', iso));
  unsubscribeSlots = onSnapshot(q, (snapshot) => {
    slotStatusMap = {};
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      slotStatusMap[data.time] = {
        id: docSnap.id,
        status: data.status,
        lockedBy: data.lockedBy || null,
        expiresAt: data.expiresAt || null,
      };
    });
    renderTimes();
  });
}

const dates = [];

for (let i = 0; i < 7; i++) {
  const d = new Date();
  d.setDate(d.getDate() + i);

  dates.push({
    iso: d.toISOString().split('T')[0],
    label: `${d.getDate()}/${d.getMonth() + 1}`,
    full: d.toLocaleDateString('vi-VN')
  });
}

function renderDates() {
  const wrap = document.getElementById('dateRow');
  if (!wrap) return;

  const DAY_LABELS = ['CN','T2','T3','T4','T5','T6','T7'];
  const today = new Date();

  wrap.style.cssText = `
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 4px 2px 8px;
    scrollbar-width: none;
  `;

  wrap.innerHTML = dates.map((d, i) => {
    const dateObj = new Date(d.iso);
    const dayLabel = DAY_LABELS[dateObj.getDay()];
    const isToday = i === 0;
    const isSelected = sel.date === d.iso;

    return `
      <div onclick="selectDate('${d.iso}','${d.full}')" style="
        flex: 0 0 auto;
        width: 52px;
        padding: 10px 0;
        border-radius: 14px;
        border: 2px solid ${isSelected ? 'var(--primary, linear-gradient(135deg, #60A5FA, #1D4ED8))' : '#e0e0e0'};
        background: ${isSelected ? 'var(--primary, linear-gradient(135deg, #60A5FA, #1D4ED8))' : '#fff'};
        color: ${isSelected ? '#fff' : '#333'};
        text-align: center;
        cursor: pointer;
        transition: all .2s ease;
        box-shadow: ${isSelected ? '0 4px 12px rgba(74,155,142,0.3)' : '0 1px 3px rgba(0,0,0,0.06)'};
      ">
        <div style="font-size:11px;font-weight:500;opacity:${isSelected ? '1' : '0.5'};margin-bottom:4px">
          ${isToday ? 'Hôm nay' : dayLabel}
        </div>
        <div style="font-size:18px;font-weight:700;line-height:1">
          ${dateObj.getDate()}
        </div>
        <div style="font-size:11px;opacity:${isSelected ? '0.85' : '0.45'};margin-top:2px">
          Th${dateObj.getMonth() + 1}
        </div>
        <div style="margin-top:6px;height:5px;width:5px;border-radius:50%;background:${isSelected ? 'rgba(255,255,255,0.8)' : 'var(--primary,#4a9b8e)'};margin-left:auto;margin-right:auto;opacity:${isSelected ? '1' : '0.4'}"></div>
      </div>
    `;
  }).join('');
}
 
  /* ── RENDER TIMES ── */
  function renderTimes() {
  const grid = document.getElementById('timeGrid');
  const now = Date.now();
  const currentUser = auth.currentUser;
  const ALL_SLOTS = ['07:30','08:00','08:30','09:00','09:30','10:00',
                     '10:30','11:00','13:30','14:00','14:30','15:00'];

  if (!sel.date) {
    grid.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:8px 0">Vui lòng chọn ngày trước</div>';
    return;
  }

  grid.innerHTML = ALL_SLOTS.map(t => {
    const info = slotStatusMap[t];
    if (!info) return `<div class="time-slot disabled">${t}</div>`;

    const isBooked = info.status === 'booked';
    const isLockedByOther = info.status === 'locked'
      && info.lockedBy !== currentUser?.uid
      && info.expiresAt?.toMillis() > now;
    const isSelected = sel.time === t;

    if (isBooked) {
      return `<div class="time-slot disabled" title="Đã được đặt">${t} ✗</div>`;
    }
    if (isLockedByOther) {
      return `<div class="time-slot disabled" title="Đang có người giữ">${t} 🔒</div>`;
    }
    return `<div class="time-slot${isSelected ? ' selected' : ''}" onclick="selectTime('${t}')">${t}</div>`;
  }).join('');
}
 
  /* ── SELECTION HANDLERS ── */
  function selectPatient(id) { sel.patient = id; renderPatients(); updatePatientHeader(); updateSummary(); }
  async function selectTime(t) {
  if (!auth.currentUser) {
    alert('Vui lòng đăng nhập để đặt lịch.');
    document.getElementById('popup-overlay').style.display = 'block';
    return;
  }

  const info = slotStatusMap[t];
  if (!info) return;

  const now = Date.now();
  const isLockedByOther = info.status === 'locked'
    && info.lockedBy !== auth.currentUser.uid
    && info.expiresAt?.toMillis() > now;

  if (info.status === 'booked' || isLockedByOther) {
    alert('Khung giờ này không còn trống. Vui lòng chọn giờ khác.');
    return;
  }

  const slotRef = doc(db, 'slots', info.id);
  try {
    await runTransaction(db, async (transaction) => {
      const slotDoc = await transaction.get(slotRef);
      const data = slotDoc.data();
      const nowMs = Date.now();

      const isAvailable = data.status === 'available';
      const isExpired = data.status === 'locked' && data.expiresAt?.toMillis() < nowMs;
      const isOwn = data.status === 'locked' && data.lockedBy === auth.currentUser.uid;

      if (!isAvailable && !isExpired && !isOwn) {
        throw new Error('Khung giờ vừa được người khác chọn. Vui lòng thử lại.');
      }

      transaction.update(slotRef, {
        status: 'locked',
        lockedBy: auth.currentUser.uid,
        lockedAt: serverTimestamp(),
        expiresAt: Timestamp.fromMillis(nowMs + 5 * 60 * 1000),
      });
    });

    sel.time = t;
    renderTimes();
    updateSummary();

    // Tự nhả lock sau 5 phút nếu chưa confirm
    setTimeout(async () => {
      if (sel.time === t && !confirmed) {
        await runTransaction(db, async (transaction) => {
          transaction.update(slotRef, {
            status: 'available',
            lockedBy: null,
            lockedAt: null,
            expiresAt: null,
          });
        });
        sel.time = null;
        renderTimes();
        alert('Hết 5 phút giữ chỗ. Vui lòng chọn lại giờ khám.');
      }
    }, 5 * 60 * 1000);

  } catch (err) {
    alert(err.message || 'Không thể chọn khung giờ này.');
  }
}

async function releaseSlot(slotId) {
  const slotRef = doc(db, 'slots', slotId);
  await runTransaction(db, async (transaction) => {
    transaction.update(slotRef, {
      status: 'available',
      lockedBy: null,
      lockedAt: null,
      expiresAt: null,
    });
  });
}
 
  /* ── SUMMARY ── */
  function buildSummaryHTML() {
    const m = members.find(x => x.id === sel.patient);
    const note = document.getElementById('noteInput')?.value.trim();
    return `
      <div class="summary-row"><span class="summary-label">Bệnh nhân</span><span class="summary-val">${m.name}</span></div>
      <div class="summary-row"><span class="summary-label">Quan hệ</span><span class="summary-val">${m.rel}</span></div>
      <div class="summary-row"><span class="summary-label">Ngày khám</span><span class="summary-val">${sel.dateLabel}</span></div>
      <div class="summary-row"><span class="summary-label">Giờ khám</span><span class="summary-val">${sel.time}</span></div>
      <div class="summary-row"><span class="summary-label">Địa điểm</span><span class="summary-val">Trạm YT Phường 5, Q.1</span></div>
      <div class="summary-row"><span class="summary-label">Ghi chú</span><span class="summary-val">${note || 'Không có'}</span></div>`;
  }
 
  function updateSummary() {
    if (!confirmed) return;
    if (sel.date && sel.time) {
      document.getElementById('summaryCard').style.display = 'block';
      document.getElementById('summaryContent').innerHTML = buildSummaryHTML();
    }
  }
 
  /* ── SUBMIT ── */
  async function handleSubmit() {
  if (!sel.date || !sel.time) {
    alert('Vui lòng chọn đầy đủ ngày và giờ khám.');
    return;
  }
  if (!confirmed) {
    confirmed = true;
    document.getElementById('summaryCard').style.display = 'block';
    document.getElementById('summaryContent').innerHTML = buildSummaryHTML();
    document.getElementById('submitText').textContent = 'Xác nhận đặt lịch';
    document.getElementById('summaryCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const info = slotStatusMap[sel.time];
  if (!info) { alert('Lỗi: không tìm thấy slot.'); return; }

  const slotRef = doc(db, 'slots', info.id);
  const m = members.find(x => x.id === sel.patient);

  try {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      alert('Vui lòng đăng nhập để đặt lịch.');
      return;
    }

    const todayAppointmentsQuery = query(
      collection(db, 'appointments'),
      where('userId', '==', userId),
      where('date', '==', sel.date)
    );
    const todayAppointmentsSnap = await getDocs(todayAppointmentsQuery);
    if (todayAppointmentsSnap.size >= 4) {
      alert('Mỗi tài khoản chỉ được tối đa 4 lần đặt lịch mỗi ngày!');
      return;
    }

    await runTransaction(db, async (transaction) => {
      const slotDoc = await transaction.get(slotRef);
      const data = slotDoc.data();

      if (data.lockedBy !== auth.currentUser?.uid) {
        throw new Error('Phiên giữ chỗ đã hết hạn. Vui lòng chọn lại.');
      }
      if (data.expiresAt?.toMillis() < Date.now()) {
        throw new Error('Hết thời gian giữ chỗ. Vui lòng chọn lại.');
      }

      transaction.update(slotRef, {
        status: 'booked',
        lockedBy: null,
        lockedAt: null,
        expiresAt: null,
      });
    });

    await addDoc(collection(db, 'appointments'), {
      slotId: info.id,
      userId,
      patientName: m.name,
      date: sel.date,
      time: sel.time,
      symptoms: document.getElementById('noteInput')?.value.trim() || '',
      status: 'confirmed',
      bookedAt: serverTimestamp(),
    });

    const code = 'AP-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    document.getElementById('apptCode').textContent = code;
    document.getElementById('successSummary').innerHTML = buildSummaryHTML();
    document.getElementById('mainFlow').style.display = 'none';
    document.getElementById('successScreen').classList.add('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (err) {
    alert(err.message || 'Đặt lịch thất bại. Vui lòng thử lại.');
    sel.time = null;
    confirmed = false;
    document.getElementById('summaryCard').style.display = 'none';
    document.getElementById('submitText').textContent = 'Xem xác nhận';
    renderTimes();
  }
}
 
  /* ── RESET ── */
  function resetAll() {
    sel = { patient: 0, date: null, dateLabel: null, time: null };
    confirmed = false;
    document.getElementById('mainFlow').style.display = 'block';
    document.getElementById('successScreen').classList.remove('show');
    document.getElementById('summaryCard').style.display = 'none';
    document.getElementById('submitText').textContent = 'Xem xác nhận';
    document.getElementById('noteInput').value = '';
    renderAll();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
 
  /* ── MODAL ── */
  function openModal() {
    document.getElementById('memberModal').classList.add('open');
  }
  function closeModal() {
    document.getElementById('memberModal').classList.remove('open');
    ['mName', 'mYear', 'mHeight', 'mWeight', 'mAllergy'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('mGender').value = 'nam';
    document.getElementById('mRel').value = 'Bố';
    document.getElementById('mBlood').value = '';
  }
  async function saveMember() {
  const name = document.getElementById('mName').value.trim();
  const year = parseInt(document.getElementById('mYear').value);
  if (!name || !year || year < 1920 || year > new Date().getFullYear()) {
    alert('Vui lòng nhập đúng tên và năm sinh.');
    return;
  }

  const newMember = {
    name,
    year,
    gender: document.getElementById('mGender').value,
    rel: document.getElementById('mRel').value,
    height: parseInt(document.getElementById('mHeight').value) || 0,
    weight: parseInt(document.getElementById('mWeight').value) || 0,
    blood: document.getElementById('mBlood').value,
    phone: 'Chưa cập nhật',
    address: 'Chưa cập nhật',
    patientCode: '#BN-' + Math.floor(10000 + Math.random() * 90000),
    allergy: document.getElementById('mAllergy').value.trim(),
    insurance: '',
    createdAt: new Date().toISOString(),
  };

  try {
    if (auth.currentUser) {
      const docRef = await addDoc(
        collection(db, 'users', auth.currentUser.uid, 'family'),
        newMember
      );
      members.push({
        id: nextId++,
        firestoreId: docRef.id,
        self: false,
        history: [],
        ...newMember,
      });
    }
  } catch (err) {
    alert('Lỗi lưu thành viên: ' + err.message);
    return;
  }

  closeModal();
  renderPatients();
}


  function autoSaveFact(key, value) {
  const member = getSelectedMember();
  if (!member) return;
  if (key === 'height' || key === 'weight') {
    member[key] = parseInt(value) || 0;
  } else if (key === 'year') {
    // Chọn tuổi → tính ngược lại năm sinh
    const currentYear = new Date().getFullYear();
    member[key] = currentYear - parseInt(value);
  } else {
    member[key] = value;
  }
  updatePatientHeader();
  renderPatients();
}

async function saveAllFacts() {
  const member = getSelectedMember();
  if (!member) return;

  const currentYear = new Date().getFullYear();
  const fields = ['gender','height','weight','blood','phone','address','insurance','allergy','year'];
  fields.forEach(key => {
    const el = document.getElementById('edit_' + key);
    if (!el) return;
    if (key === 'height' || key === 'weight') {
      member[key] = parseInt(el.value) || 0;
    } else if (key === 'year') {
      // Chọn tuổi → tính ngược lại năm sinh
      member[key] = currentYear - (parseInt(el.value) || 0);
    } else {
      member[key] = el.value.trim();
    }
  });

  if (member.self && auth.currentUser) {
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await setDoc(userRef, {
        phone:     member.phone,
        address:   member.address,
        insurance: member.insurance,
        allergy:   member.allergy,
        blood:     member.blood,
        height:    member.height,
        weight:    member.weight,
        gender:    member.gender,
        year:      member.year,
      }, { merge: true });
      alert('Đã lưu thông tin thành công!');
    } catch (err) {
      alert('Lỗi lưu: ' + err.message);
    }
  }

  updatePatientHeader();
  renderPatients();
}


  /* ── INIT ── */
  function renderAll() {
    renderPatients();
    renderDates();
    renderTimes();
    updatePatientHeader();
  }

 window.seedSlots = async function () {
  const allSlots = ['07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','13:30','14:00','14:30','15:00','15:30'];

  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const date = d.toISOString().split('T')[0];

    for (const time of allSlots) {
      await addDoc(collection(db, 'slots'), {
        doctorId: 'default',
        date,
        time,
        status: 'available'
      });
    }
  }

  console.log('xong');
};

// ── CHATBOX ──────────────────────────────────────
const chatHistory = [];
let chatSending = false; // prevent duplicate/concurrent sends

function toggleChat() {
  const box = document.getElementById('chatBox');
  const isOpen = box.style.display === 'flex';
  box.style.display = isOpen ? 'none' : 'flex';

  if (!isOpen && chatHistory.length === 0) {
    appendMessage('bot', 'Xin chào! 👋 Tôi là trợ lý y tế AI. Bạn có thể hỏi tôi về lịch khám, triệu chứng, hoặc các dịch vụ y tế.');
  }
}

function appendMessage(role, text) {
  const container = document.getElementById('chatMessages');
  const isBot = role === 'bot';
  // Deduplicate consecutive identical messages
  const last = container.lastElementChild;
  if (last && last.dataset && last.dataset.role === role && last.textContent === text) return;

  const bubble = document.createElement('div');
  bubble.dataset.role = role;
  bubble.style.cssText = `
    max-width:80%;padding:9px 13px;border-radius:14px;
    font-size:13px;line-height:1.5;word-break:break-word;
    ${isBot
      ? 'background:#f0f7f6;color:#1a3a5c;align-self:flex-start;border-bottom-left-radius:4px'
      : 'background:var(--primary,#4a9b8e);color:#fff;align-self:flex-end;border-bottom-right-radius:4px'
    }
  `;
  bubble.textContent = text;
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

function appendTyping() {
  const container = document.getElementById('chatMessages');
  const typing = document.createElement('div');
  typing.id = 'typingIndicator';
  typing.style.cssText = `
    background:#f0f7f6;padding:9px 13px;border-radius:14px;
    font-size:13px;color:#7a8fa6;align-self:flex-start;
    border-bottom-left-radius:4px;
  `;
  typing.textContent = '...';
  container.appendChild(typing);
  container.scrollTop = container.scrollHeight;
}

function getBotReply(message) {

  const text = message.toLowerCase();

  const rules = [
    {
      keywords: ["đặt lịch", "đăng ký khám"],
      reply: "Để đặt lịch khám, vui lòng chọn bệnh nhân, ngày khám và giờ khám rồi nhấn Xác nhận."
    },
    {
      keywords: ["giờ làm việc", "mở cửa", "làm việc"],
      reply: "Trạm y tế làm việc từ 07:30 đến 16:30 từ thứ Hai đến thứ Sáu."
    },
    {
      keywords: ["địa chỉ", "ở đâu"],
      reply: "Trạm Y Tế Phường 5 nằm tại địa chỉ của trạm y tế trong hệ thống."
    },
    {
      keywords: ["tiêm chủng", "vaccine", "vắc xin"],
      reply: "Trạm y tế cung cấp các dịch vụ tiêm chủng theo quy định."
    },
    {
      keywords: ["khám tổng quát"],
      reply: "Bạn có thể chọn dịch vụ Khám tổng quát trong phần Đặt lịch khám."
    },
    {
      keywords: ["bảo hiểm y tế", "bảo hiểm"],
      reply: "Vui lòng mang theo thẻ bảo hiểm y tế và CCCD khi đến khám."
    },
    {
      keywords: ["sốt"],
      reply: "Nếu sốt kéo dài hoặc trên 38.5°C, bạn nên đến cơ sở y tế để được thăm khám."
    },
    {
      keywords: ["ho"],
      reply: "Nếu ho kéo dài trên 2 tuần hoặc kèm khó thở, hãy đến cơ sở y tế để kiểm tra."
    },
    {
      keywords: ["đau đầu"],
      reply: "Đau đầu có thể do nhiều nguyên nhân. Nếu đau dữ dội hoặc kéo dài, hãy đi khám."
    },
  ];

  for (const rule of rules) {
    if (rule.keywords.some(keyword => text.includes(keyword))) {
      return rule.reply;
    }
  }

  return "Xin lỗi, tôi chưa có thông tin về câu hỏi này. Vui lòng liên hệ nhân viên y tế để được hỗ trợ.";
}

async function sendChat() {

  const input = document.getElementById('chatInput');
  const text = input.value.trim();

  if (!text) return;

  // prevent concurrent sends
  if (chatSending) return;

  if (!auth.currentUser) {
    appendMessage('bot', 'Vui lòng đăng nhập để sử dụng trợ lý. 🔒');
    return;
  }

  // Do not allow sending the exact same user message twice in a row
  const last = chatHistory[chatHistory.length - 1];
  if (last && last.role === 'user' && last.content === text) {
    // optional: give brief visual feedback
    const inputEl = document.getElementById('chatInput');
    if (inputEl) {
      inputEl.style.transition = 'box-shadow 120ms';
      inputEl.style.boxShadow = '0 0 0 3px rgba(255,165,0,0.18)';
      setTimeout(() => { inputEl.style.boxShadow = ''; }, 250);
    }
    return; // block resend of identical content
  }
  appendMessage('user', text);
  chatHistory.push({ role: 'user', content: text });

  appendTyping();
  chatSending = true;

  try {
    // local bot reply (mock) with small delay
    await new Promise(r => setTimeout(r, 500));
    const reply = getBotReply ? getBotReply(text) : 'Đang xử lý...';
    document.getElementById('typingIndicator')?.remove();
    appendMessage('bot', reply);
    chatHistory.push({ role: 'assistant', content: reply });
    // clear input so user can type next question
    try { input.value = ''; } catch (e) {}
  } catch (err) {
    document.getElementById('typingIndicator')?.remove();
    appendMessage('bot', 'Lỗi trợ lý. Vui lòng thử lại.');
    console.error(err);
  } finally {
    chatSending = false;
  }
}

  // ── DOCTOR PORTAL ─────────────────────────────
let currentDoctorData = null;
let selectedPatientAppointment = null;
let currentMedicineType = 'tay';

const METHODS = {
  tay: ['Tiểu phẫu','Băng bó vết thương','Thay băng gạc','Tiêm truyền','Đo huyết áp','Xét nghiệm máu','Siêu âm','Điện tim (ECG)'],
  dong: ['Châm cứu','Bấm huyệt','Cạo gió','Giác hơi','Xoa bóp','Bốc thuốc thang','Ngâm chân thảo dược','Dưỡng sinh'],
};

function openDoctorModal(userData) {
  currentDoctorData = userData;

  // Ẩn panel bệnh nhân, hiện panel bác sĩ
  const patientPanel = document.getElementById('patientPanel');
  const doctorPanel = document.getElementById('doctorPanel');
  if (patientPanel) patientPanel.style.display = 'none';
  if (doctorPanel) doctorPanel.style.display = 'block';

  // Cập nhật thông tin bác sĩ
  const avatar = document.getElementById('doctorAvatar');
  const name = document.getElementById('doctorPanelName');
  const email = document.getElementById('doctorPanelEmail');
  if (avatar) avatar.textContent = userData.name.trim().split(/\s+/).slice(-2).map(p => p[0].toUpperCase()).join('');
  if (name) name.textContent = 'BS. ' + userData.name;
  if (email) email.textContent = userData.email;

  setMedicine('tay');
  loadTodayQueue();
}

async function loadTodayQueue() {
  const today = new Date().toISOString().split('T')[0];
  const q = query(
    collection(db, 'appointments'),
    where('date', '==', today),
    where('status', '==', 'confirmed')
  );

  const snap = await getDocs(q);
  const appointments = [];
  snap.forEach(d => appointments.push({ id: d.id, ...d.data() }));

  // Sắp xếp: ưu tiên người già (năm sinh nhỏ) lên đầu
  appointments.sort((a, b) => (a.time > b.time ? 1 : -1));

  const list = document.getElementById('queueList');
  if (!appointments.length) {
    list.innerHTML = '<div style="text-align:center;color:#999;padding:20px">Chưa có bệnh nhân hôm nay</div>';
    return;
  }

  list.innerHTML = appointments.map((ap, idx) => `
    <div style="
      background:#f8f9fa;border-radius:12px;padding:12px;
      margin-bottom:8px;display:flex;align-items:center;
      justify-content:space-between;
    ">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="
          width:32px;height:32px;border-radius:50%;
          background:#4a9b8e;color:#fff;
          display:flex;align-items:center;justify-content:center;
          font-weight:700;font-size:13px;
        ">${idx + 1}</div>
        <div>
          <div style="font-weight:600;color:#1a3a5c;font-size:14px">${ap.patientName}</div>
          <div style="font-size:12px;color:#7a8fa6">${ap.time} · ${ap.symptoms || 'Không có triệu chứng'}</div>
        </div>
      </div>
      <button onclick="selectPatientForExam('${ap.id}','${ap.patientName}','${ap.symptoms || ''}','${ap.userId || ''}')" style="
          padding:6px 12px;border-radius:8px;border:none;
          background:#4a9b8e;color:#fff;font-size:12px;cursor:pointer;
        ">Khám</button>
  `).join('');
}

function selectPatientForExam(apptId, name, symptoms, userId) {
  selectedPatientAppointment = { apptId, name, symptoms, userId };

  document.getElementById('currentPatientInfo').innerHTML = `
    <strong>${name}</strong><br>
    <span style="color:#7a8fa6;font-size:12px">Triệu chứng: ${symptoms || 'Không có'}</span>
  `;
  document.getElementById('prescPatientInfo').innerHTML = `
    <strong>${name}</strong>
  `;

  switchDoctorTab('examine');
}

function setMedicine(type) {
  currentMedicineType = type;
  document.getElementById('btn_tay').style.background = type === 'tay' ? '#60A5FA' : '#fff';
  document.getElementById('btn_tay').style.color = type === 'tay' ? '#fff' : '#60A5FA';
  document.getElementById('btn_tay').style.borderColor = type === 'tay' ? '#60A5FA' : '#e0e0e0';
  document.getElementById('btn_dong').style.background = type === 'dong' ? '#60A5FA' : '#fff';
  document.getElementById('btn_dong').style.color = type === 'dong' ? '#fff' : '#60A5FA';
  document.getElementById('btn_dong').style.borderColor = type === 'dong' ? '#60A5FA' : '#e0e0e0';

  document.getElementById('methodList').innerHTML = METHODS[type].map(m => `
    <label style="
      display:flex;align-items:center;gap:8px;
      background:#f8f9fa;border-radius:10px;padding:10px;
      cursor:pointer;font-size:13px;
    ">
      <input type="checkbox" value="${m}" style="width:16px;height:16px;accent-color:#60A5FA">
      ${m}
    </label>
  `).join('');
}

async function saveTreatment() {
  if (!selectedPatientAppointment) {
    alert('Vui lòng chọn bệnh nhân từ hàng chờ.');
    return;
  }

  const methods = [...document.querySelectorAll('#methodList input:checked')].map(el => el.value);
  const diagnosis = document.getElementById('diagnosisInput').value.trim();
  const note = document.getElementById('treatmentNote').value.trim();

  if (!diagnosis) { alert('Vui lòng nhập chẩn đoán.'); return; }

  try {
    await setDoc(doc(db, 'appointments', selectedPatientAppointment.apptId), {
      diagnosis,
      treatmentNote: note,
      methods,
      medicineType: currentMedicineType,
      status: 'examined',
      examinedAt: serverTimestamp(),
    }, { merge: true });

    alert('Đã lưu kết quả khám!');
    switchDoctorTab('prescription');
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
}

function addPrescriptionRow() {
  const container = document.getElementById('prescriptionItems');
  const idx = container.children.length;
  const row = document.createElement('div');
  row.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:6px;align-items:center';
  row.innerHTML = `
    <input placeholder="Tên thuốc..." style="padding:8px;border-radius:8px;border:1.5px solid #e0e0e0;font-size:13px">
    <input placeholder="Số lượng" style="padding:8px;border-radius:8px;border:1.5px solid #e0e0e0;font-size:13px">
    <input placeholder="Cách dùng..." style="padding:8px;border-radius:8px;border:1.5px solid #e0e0e0;font-size:13px">
    <button onclick="this.parentElement.remove()" style="
      width:30px;height:30px;border-radius:50%;border:none;
      background:#fee;color:#e55;cursor:pointer;font-size:16px;
    ">✕</button>
  `;
  container.appendChild(row);
}

async function savePrescription() {
  if (!selectedPatientAppointment) {
    alert('Vui lòng chọn bệnh nhân từ hàng chờ.');
    return;
  }

  const rows = document.querySelectorAll('#prescriptionItems > div');
  const items = [...rows].map(row => {
    const inputs = row.querySelectorAll('input');
    return {
      name: inputs[0].value.trim(),
      qty: inputs[1].value.trim(),
      usage: inputs[2].value.trim(),
    };
  }).filter(item => item.name);

  if (!items.length) { alert('Vui lòng thêm ít nhất 1 thuốc.'); return; }

  try {
    await addDoc(collection(db, 'prescriptions'), {
      apptId: selectedPatientAppointment.apptId,
      userId: selectedPatientAppointment.userId,  // ← THÊM
      patientName: selectedPatientAppointment.name,
      doctorName: currentDoctorData.name,
      items,
      createdAt: serverTimestamp(),
    });

    await setDoc(doc(db, 'appointments', selectedPatientAppointment.apptId), {
      status: 'completed',
    }, { merge: true });

    alert('Đã lưu toa thuốc thành công!');
    document.getElementById('prescriptionItems').innerHTML = '';
    selectedPatientAppointment = null;
    switchDoctorTab('queue');
    loadTodayQueue();
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
}

async function switchDoctorTab(tab) {
  ['queue','examine','prescription'].forEach(t => {
    const el = document.getElementById('docTab_' + t);
    if (el) el.style.display = t === tab ? 'block' : 'none';
  });
  document.querySelectorAll('.doc-tab').forEach(btn => {
    const isActive = btn.dataset.tab === tab;
    btn.style.background = isActive ? 'rgba(96, 165, 250, 0.16)' : '#f5f5f5';
    btn.style.color = isActive ? '#2563EB' : '#666';
    btn.style.boxShadow = isActive ? '0 0 0 1px rgba(96, 165, 250, 0.22) inset' : 'none';
  });
}

function closeDoctorModal() {
  const doctorPanel = document.getElementById('doctorPanel');
  const patientPanel = document.getElementById('patientPanel');
  if (doctorPanel) doctorPanel.style.display = 'none';
  if (patientPanel) patientPanel.style.display = 'block';
}

window.showFirestorePrescriptionDetail = showFirestorePrescriptionDetail;
window.switchDoctorTab = switchDoctorTab;
window.openDoctorModal = openDoctorModal;
window.closeDoctorModal = closeDoctorModal;
window.setMedicine = setMedicine;
window.selectPatientForExam = selectPatientForExam;
window.saveTreatment = saveTreatment;
window.addPrescriptionRow = addPrescriptionRow;
window.savePrescription = savePrescription;
window.toggleChat = toggleChat;
window.sendChat = sendChat;
window.selectPatient = selectPatient;
window.selectDate = selectDate;
window.selectTime = selectTime;
window.handleSubmit = handleSubmit;
window.openModal = openModal;
window.openPatientDetail = openPatientDetail;
window.closePatientDetail = closePatientDetail;
window.showPatientTab = showPatientTab;
window.showPrescriptionDetail = showPrescriptionDetail;
window.closePrescriptionDetail = closePrescriptionDetail;
window.closeModal = closeModal;
window.saveMember = saveMember;
window.resetAll = resetAll;
window.autoSaveFact = autoSaveFact;
window.saveAllFacts = saveAllFacts;
window.focusEdit = focusEdit;

// Render sau khi đã gán window
renderPatients();
updatePatientHeader();
renderDates();
if (dates.length > 0) {
  selectDate(dates[0].iso, dates[0].full);
}

updatePatientHeader();