import { translations } from "./translations.js";
import { auth, onAuthStateChanged, login, loginWithGoogle, logout } from "./app.js";

let currentLang = "VI";
const LANG_STORAGE_KEY = "siteLang";
const GOOGLE_TRANSLATE_COOKIE = "googtrans";
const LANG_RELOAD_GUARD = "langReloadGuard";
const SEARCH_SUGGESTION_CLASS = "search-suggestions";
const SEARCH_SUGGESTION_ITEM_CLASS = "search-suggestion";
const SEARCH_SUGGESTION_ACTIVE_CLASS = "is-active";
const SEARCH_HIGHLIGHT_CLASS = "search-highlight";

const COMMON_SEARCH_TERMS = [
  "giáo dục sức khỏe",
  "tiêm chủng",
  "phòng chống dịch bệnh",
  "chăm sóc trẻ em",
  "khám sức khỏe",
  "tầm soát",
  "ung thư",
  "dinh dưỡng",
  "sốt xuất huyết",
  "khẩu trang",
  "mẹ và bé",
  "tiêm vắc xin",
  "ho",
  "sốt",
  "đường huyết",
  "người cao tuổi"
];

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

function ensureAuthModal() {
  let modal = document.getElementById("authModalPages");
  if (modal) return modal;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div id="authModalPages" class="auth-modal" aria-hidden="true">
      <div class="auth-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="authPagesTitle">
        <button class="auth-modal__close" type="button" aria-label="Đóng">&times;</button>
        <h3 id="authPagesTitle">ĐĂNG NHẬP</h3>
        <p>Đăng nhập để tiếp tục sử dụng đầy đủ chức năng.</p>
        <form class="auth-form" id="authPagesForm">
          <label for="authPagesEmail">Email</label>
          <input id="authPagesEmail" type="email" placeholder="Nhập email" required autocomplete="email" />

          <label for="authPagesPassword">Mật khẩu</label>
          <input id="authPagesPassword" type="password" placeholder="Nhập mật khẩu" required autocomplete="current-password" />

          <p id="authPagesError" style="color:#d32f2f;font-size:13px;min-height:18px;margin:4px 0 0;"></p>

          <button type="submit" class="auth-btn auth-btn--primary">Đăng nhập</button>
        </form>

        <div class="auth-divider"><span>hoặc</span></div>

        <div class="auth-actions">
          <button type="button" class="auth-btn auth-btn--google" id="authPagesGoogle">Đăng nhập bằng Google</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(wrapper.firstElementChild);
  modal = document.getElementById("authModalPages");
  if (!modal) return null;

  const closeBtn = modal.querySelector(".auth-modal__close");
  const form = modal.querySelector("#authPagesForm");
  const googleBtn = modal.querySelector("#authPagesGoogle");
  const errorEl = modal.querySelector("#authPagesError");

  const closeModal = () => {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    if (errorEl) errorEl.textContent = "";
  };

  const openModal = () => {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  };

  if (closeBtn) closeBtn.addEventListener("click", closeModal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const emailInput = form.querySelector("#authPagesEmail");
      const passwordInput = form.querySelector("#authPagesPassword");
      const email = emailInput ? emailInput.value.trim() : "";
      const password = passwordInput ? passwordInput.value : "";

      try {
        await login(email, password);
        closeModal();
      } catch (err) {
        if (errorEl) errorEl.textContent = err?.message || "Đăng nhập thất bại";
      }
    });
  }

  if (googleBtn) {
    googleBtn.addEventListener("click", async () => {
      try {
        await loginWithGoogle();
        closeModal();
      } catch (err) {
        if (errorEl) errorEl.textContent = err?.message || "Đăng nhập Google thất bại";
      }
    });
  }

  modal._openModal = openModal;
  return modal;
}

function ensureLoginButton() {
  const topbar = document.querySelector(".topbar");
  if (!topbar) return null;

  let loginBtn = topbar.querySelector(".login");
  if (!loginBtn) {
    loginBtn = document.createElement("button");
    loginBtn.className = "login";
    loginBtn.type = "button";
    loginBtn.innerHTML = '<span data-i18n="btn_login">Đăng nhập</span>';
    loginBtn.addEventListener("click", () => {
      const modal = ensureAuthModal();
      if (modal && typeof modal._openModal === "function") {
        modal._openModal();
      }
    });
    topbar.appendChild(loginBtn);
  }

  return loginBtn;
}

function normalizeSearchText(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitSearchTerms(value) {
  return normalizeSearchText(value)
    .split(/[^\p{L}\p{N}]+/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

function splitHighlightTerms(value) {
  return (value || "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeSearchPhrase(value) {
  return normalizeSearchText(value).replace(/\s+/g, " ");
}

function normalizeWithMap(text) {
  let normalized = "";
  const map = [];
  let lastWasSpace = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const lowerCharacter = character.toLowerCase();

    if (/\s/.test(lowerCharacter)) {
      if (!lastWasSpace && normalized.length > 0) {
        normalized += " ";
        map.push(index);
        lastWasSpace = true;
      }
      continue;
    }

    const decomposed = lowerCharacter.normalize("NFD");
    for (const part of decomposed) {
      if (/[\u0300-\u036f]/.test(part)) continue;
      normalized += part;
      map.push(index);
      lastWasSpace = false;
    }
  }

  return { normalized, map };
}

function collectPhraseCandidates(text) {
  const words = splitSearchTerms(text);
  const phrases = [];

  if (words.length === 1) {
    phrases.push(words[0]);
  }

  for (let index = 0; index < words.length - 1; index += 1) {
    phrases.push(`${words[index]} ${words[index + 1]}`);
  }

  for (let index = 0; index < words.length - 2; index += 1) {
    phrases.push(`${words[index]} ${words[index + 1]} ${words[index + 2]}`);
  }

  return phrases;
}

function getSearchCorpus() {
  const elements = Array.from(document.querySelectorAll(
    "main h1, main h2, main h3, main h4, main p, main li, main .menu_about, main .menu_vaccine, main .menu_health, main .menu_disease, main .menu_child"
  ));

  const values = elements
    .flatMap((el) => collectPhraseCandidates(el.textContent || ""))
    .concat(COMMON_SEARCH_TERMS)
    .concat(collectPhraseCandidates(document.title || ""));

  const unique = new Set();
  values.forEach((value) => {
    const clean = value.trim();
    if (!clean) return;
    unique.add(clean);
  });

  return Array.from(unique);
}

function scoreSuggestion(term, query) {
  const normalizedTerm = normalizeSearchText(term);
  if (!query) return 1;
  if (normalizedTerm === query) return 5;
  if (normalizedTerm.startsWith(query)) return 4;
  if (normalizedTerm.includes(query)) return 3;

  const queryWords = query.split(/\s+/).filter(Boolean);
  if (queryWords.length > 1 && queryWords.every((part) => normalizedTerm.includes(part))) {
    return 2;
  }

  return 0;
}

function buildSearchSuggestions(query) {
  const normalizedQuery = normalizeSearchText(query);
  const corpus = getSearchCorpus();
  if (!normalizedQuery) {
    return corpus
      .slice(0, 16)
      .filter((term, index, array) => array.indexOf(term) === index)
      .slice(0, 8);
  }

  return corpus
    .map((term) => ({ term, score: scoreSuggestion(term, normalizedQuery) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.term.localeCompare(b.term, "vi"))
    .slice(0, 8)
    .map((item) => item.term);
}

function removeSearchSuggestions(input) {
  const existing = input?.parentElement?.querySelector(`.${SEARCH_SUGGESTION_CLASS}`);
  if (existing) existing.remove();

  if (input) {
    input.dataset.activeSuggestionIndex = "-1";
  }
}

function renderSearchSuggestions(input, suggestions) {
  if (!input) return;

  removeSearchSuggestions(input);

  if (!suggestions.length) return;

  const wrapper = document.createElement("div");
  wrapper.className = SEARCH_SUGGESTION_CLASS;
  wrapper.setAttribute("role", "listbox");
  wrapper.dataset.suggestionList = "true";

  suggestions.forEach((suggestion, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = SEARCH_SUGGESTION_ITEM_CLASS;
    item.setAttribute("role", "option");
    item.setAttribute("data-suggestion-index", String(index));
    item.textContent = suggestion;
    item.addEventListener("click", () => {
      input.value = suggestion;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      removeSearchSuggestions(input);
      input.focus();
    });
    wrapper.appendChild(item);
  });

  input.parentElement?.appendChild(wrapper);
}

function setActiveSuggestion(input, nextIndex) {
  const wrapper = input?.parentElement?.querySelector(`.${SEARCH_SUGGESTION_CLASS}`);
  if (!wrapper) return;

  const items = Array.from(wrapper.querySelectorAll(`.${SEARCH_SUGGESTION_ITEM_CLASS}`));
  if (!items.length) return;

  const normalizedIndex = ((nextIndex % items.length) + items.length) % items.length;
  input.dataset.activeSuggestionIndex = String(normalizedIndex);

  items.forEach((item, index) => {
    item.classList.toggle(SEARCH_SUGGESTION_ACTIVE_CLASS, index === normalizedIndex);
  });
}

function useActiveSuggestion(input) {
  const wrapper = input?.parentElement?.querySelector(`.${SEARCH_SUGGESTION_CLASS}`);
  if (!wrapper) return false;

  const activeIndex = Number(input.dataset.activeSuggestionIndex || "-1");
  const activeItem = wrapper.querySelector(`.${SEARCH_SUGGESTION_ITEM_CLASS}.${SEARCH_SUGGESTION_ACTIVE_CLASS}`)
    || wrapper.querySelector(`[data-suggestion-index="${activeIndex}"]`);

  if (!activeItem) return false;

  const value = activeItem.textContent || "";
  if (!value) return false;

  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  removeSearchSuggestions(input);
  return true;
}

function getSearchHighlightRoots() {
  const selectors = [
    ".container-gdsk",
    ".service-page",
    ".news-shell",
    ".disease-detail-page",
    "main"
  ];

  const roots = selectors
    .map((selector) => document.querySelector(selector))
    .filter(Boolean);

  if (roots.length) return roots;
  return document.body ? [document.body] : [];
}

function clearSearchHighlights(root) {
  const marks = Array.from(root.querySelectorAll(`mark.${SEARCH_HIGHLIGHT_CLASS}`));
  marks.forEach((mark) => {
    const textNode = document.createTextNode(mark.textContent || "");
    mark.replaceWith(textNode);
  });
  root.normalize();
}

function highlightTextNode(node, terms) {
  const text = node.textContent || "";
  if (!text.trim()) return;

  const { normalized: lowerText, map } = normalizeWithMap(text);
  const matchedTerms = terms
    .filter((term, index, array) => term && array.indexOf(term) === index)
    .sort((a, b) => b.length - a.length);

  if (!matchedTerms.length) return;

  const fragment = document.createDocumentFragment();
  let index = 0;

  while (index < text.length) {
    let matchStart = -1;
    let matchTerm = "";

    for (const term of matchedTerms) {
      const position = lowerText.indexOf(term, index);
      if (position === -1) continue;
      if (matchStart === -1 || position < matchStart) {
        matchStart = position;
        matchTerm = term;
      }
    }

    if (matchStart === -1) {
      fragment.appendChild(document.createTextNode(text.slice(index)));
      break;
    }

    const startOriginal = map[matchStart] ?? matchStart;
    const endNormalizedIndex = matchStart + matchTerm.length - 1;
    const endOriginal = (map[endNormalizedIndex] ?? endNormalizedIndex) + 1;

    if (startOriginal > index) {
      fragment.appendChild(document.createTextNode(text.slice(index, startOriginal)));
    }

    const highlight = document.createElement("mark");
    highlight.className = SEARCH_HIGHLIGHT_CLASS;
    highlight.textContent = text.slice(startOriginal, endOriginal);
    fragment.appendChild(highlight);

    index = endOriginal;
  }

  node.replaceWith(fragment);
}

function applySearchHighlights(query) {
  const normalizedQuery = normalizeSearchPhrase(query);
  const terms = normalizedQuery ? [normalizedQuery] : [];

  getSearchHighlightRoots().forEach((root) => {
    clearSearchHighlights(root);

    if (!terms.length) return;

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;

          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;

          if (parent.closest(`.${SEARCH_SUGGESTION_CLASS}, .${SEARCH_HIGHLIGHT_CLASS}, script, style, noscript, textarea, input, button, select, option`)) {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textNodes = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }

    textNodes.forEach((node) => highlightTextNode(node, terms));
  });
}

function initSearchAutocomplete() {
  const searchInputs = Array.from(document.querySelectorAll("input.search"));
  if (!searchInputs.length) return;

  searchInputs.forEach((input) => {
    if (input.dataset.autocompleteReady === "true") return;
    input.dataset.autocompleteReady = "true";
    input.setAttribute("autocomplete", "off");

    const updateSuggestions = () => {
      renderSearchSuggestions(input, buildSearchSuggestions(input.value));
      setActiveSuggestion(input, 0);
      applySearchHighlights(input.value);
    };

    input.addEventListener("focus", updateSuggestions);
    input.addEventListener("input", updateSuggestions);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        removeSearchSuggestions(input);
        return;
      }

      const wrapper = input.parentElement?.querySelector(`.${SEARCH_SUGGESTION_CLASS}`);
      if (!wrapper) return;

      const items = Array.from(wrapper.querySelectorAll(`.${SEARCH_SUGGESTION_ITEM_CLASS}`));
      if (!items.length) return;

      const currentIndex = Number(input.dataset.activeSuggestionIndex || "-1");

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveSuggestion(input, currentIndex + 1);
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveSuggestion(input, currentIndex <= 0 ? items.length - 1 : currentIndex - 1);
      }

      if (event.key === "Enter" && wrapper) {
        if (useActiveSuggestion(input)) {
          event.preventDefault();
        }
      }
    });

    input.addEventListener("blur", () => {
      window.setTimeout(() => removeSearchSuggestions(input), 120);
    });

    document.addEventListener("click", (event) => {
      if (!input.parentElement?.contains(event.target)) {
        removeSearchSuggestions(input);
      }
    });
  });
}

function updateAuthUI(user) {
  const loginBtn = ensureLoginButton();
  if (!loginBtn) return;

  let userInfo = document.getElementById("user-info");

  if (user) {
    loginBtn.style.display = "none";

    if (!userInfo) {
      userInfo = document.createElement("div");
      userInfo.id = "user-info";
      loginBtn.parentNode.insertBefore(userInfo, loginBtn);
    }

    userInfo.innerHTML = `
      <span>Xin chào, ${user.displayName || user.email}</span>
      <button id="btn-logout" class="btn-logout-modern" aria-label="Đăng xuất">
        <i class="material-symbols-outlined">logout</i>
        <span>Đăng xuất</span>
      </button>
    `;

    const logoutBtn = document.getElementById("btn-logout");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        logoutBtn.disabled = true;
        logoutBtn.style.opacity = "0.7";
        await logout();
      });
    }
  } else {
    loginBtn.style.display = "inline-flex";
    if (userInfo) userInfo.remove();
  }
}

function updateTime() {
  const el = document.getElementById("time");
  if (el) el.innerText = new Date().toLocaleString("vi-VN");
}

function applyLanguage(lang) {
  const t = translations[lang];
  currentLang = lang;

  // Dịch tất cả element có data-i18n
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (t[key]) el.textContent = t[key];
  });

  // Dịch placeholder
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (t[key]) el.setAttribute("placeholder", t[key]);
  });

  const btnVi = document.querySelector(".VN");
  const btnEn = document.querySelector(".EN");
  if (btnVi) btnVi.style.opacity = lang === "VI" ? "1" : "0.5";
  if (btnEn) btnEn.style.opacity = lang === "EN" ? "1" : "0.5";
}

function init() {
  setInterval(updateTime, 1000);
  updateTime();

  protectIconsFromTranslation();
  ensureGoogleTranslateBootstrapped();

  const btnVi = document.querySelector(".VN");
  const btnEn = document.querySelector(".EN");
  if (btnVi) {
    btnVi.addEventListener("click", () => {
      applyLanguage("VI");
      syncGlobalLanguage("VI", true);
    });
  }
  if (btnEn) {
    btnEn.addEventListener("click", () => {
      applyLanguage("EN");
      syncGlobalLanguage("EN", true);
    });
  }

  ensureAuthModal();
  ensureLoginButton();
  initSearchAutocomplete();
  onAuthStateChanged(auth, updateAuthUI);

  const savedLang = localStorage.getItem(LANG_STORAGE_KEY) || "VI";
  applyLanguage(savedLang);
  syncGlobalLanguage(savedLang, true);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

window._init = init;