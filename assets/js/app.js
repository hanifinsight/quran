(() => {
  "use strict";

  const API = "https://api.alquran.cloud/v1";
  const ARABIC_EDITION = "quran-uthmani";
  const TRANSLATION_EDITION = "id.indonesian";
  const MAX_PAGE = 604;
  const CACHE_PREFIX = "hq01:";
  const BOOKMARK_KEY = "hq01:bookmark";
  const state = {
    page: 1,
    surahs: [],
    showTranslation: true,
    fontSize: 30,
    currentPageData: null,
    translationMap: new Map(),
    loading: false
  };

  const el = (id) => document.getElementById(id);
  const pageContent = el("pageContent");

  function toast(message) {
    el("toastMessage").textContent = message;
    if (window.bootstrap) bootstrap.Toast.getOrCreateInstance(el("appToast"), { delay: 2800 }).show();
  }

  async function fetchJson(url, cacheKey) {
    const cached = localStorage.getItem(CACHE_PREFIX + cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch (_) { localStorage.removeItem(CACHE_PREFIX + cacheKey); }
    }
    const response = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error(`Permintaan data gagal (${response.status})`);
    const json = await response.json();
    if (json.code !== 200 || !json.data) throw new Error("Format data API tidak sesuai.");
    try { localStorage.setItem(CACHE_PREFIX + cacheKey, JSON.stringify(json.data)); } catch (_) {}
    return json.data;
  }

  function setApiStatus(status, label) {
    const node = el("apiStatus");
    node.classList.remove("online", "offline");
    if (status) node.classList.add(status);
    node.innerHTML = `<span class="status-dot"></span> ${label}`;
  }

  function showLoading(show) {
    el("loadingState").classList.toggle("d-none", !show);
    if (show) {
      el("mushafCard").classList.add("d-none");
      el("errorState").classList.add("d-none");
    }
  }

  function showError(message) {
    showLoading(false);
    el("mushafCard").classList.add("d-none");
    el("errorState").classList.remove("d-none");
    const p = el("errorState").querySelector("p");
    p.textContent = message || "Periksa koneksi internet, lalu coba kembali.";
    setApiStatus("offline", "Koneksi data bermasalah");
  }

  function renderSurahOptions() {
    const select = el("surahSelect");
    select.innerHTML = '<option value="">Pilih surat</option>';
    state.surahs.forEach(s => {
      const option = document.createElement("option");
      option.value = s.number;
      option.textContent = `${String(s.number).padStart(3, "0")} · ${s.englishName} — ${s.name}`;
      select.appendChild(option);
    });
    select.disabled = false;
  }

  async function loadSurahs() {
    const data = await fetchJson(`${API}/surah`, "surah-list");
    state.surahs = data;
    renderSurahOptions();
  }

  async function loadPage(pageNumber) {
    const page = Math.min(MAX_PAGE, Math.max(1, Number(pageNumber) || 1));
    state.page = page;
    state.loading = true;
    showLoading(true);
    el("errorState").classList.add("d-none");
    el("pageInput").value = page;
    el("pagePill").textContent = `HALAMAN ${page} / ${MAX_PAGE}`;
    el("pageCounter").textContent = `${page} dari ${MAX_PAGE}`;
    el("prevPageBtn").disabled = page <= 1;
    el("nextPageBtn").disabled = page >= MAX_PAGE;

    try {
      const [arabic, translation] = await Promise.all([
        fetchJson(`${API}/page/${page}/${ARABIC_EDITION}`, `page-ar-${page}`),
        fetchJson(`${API}/page/${page}/${TRANSLATION_EDITION}`, `page-id-${page}`).catch(() => null)
      ]);
      state.currentPageData = arabic;
      state.translationMap.clear();
      if (translation && Array.isArray(translation.ayahs)) {
        translation.ayahs.forEach(a => state.translationMap.set(a.number, a.text));
      }
      renderPage(arabic);
      setApiStatus("online", "Data Al-Qur'an terhubung");
      showLoading(false);
      el("mushafCard").classList.remove("d-none");
      updateBookmarkPanel();
    } catch (error) {
      console.error(error);
      showError("Tidak berhasil mengambil halaman dari AlQuran Cloud API. Pastikan perangkat terhubung ke internet, kemudian tekan Coba lagi.");
    } finally {
      state.loading = false;
    }
  }

  function renderPage(data) {
    const ayahs = data.ayahs || [];
    pageContent.innerHTML = "";
    const surahNames = [...new Set(ayahs.map(a => a.surah.englishName))];
    const first = ayahs[0];
    const last = ayahs[ayahs.length - 1];

    ayahs.forEach((ayah, index) => {
      const span = document.createElement("span");
      span.className = "ayah-unit";
      span.setAttribute("data-ayah", ayah.number);
      span.textContent = ayah.text + " ";
      const marker = document.createElement("span");
      marker.className = "ayah-number";
      marker.textContent = `۞ ${toArabicNumber(ayah.numberInSurah)} `;
      span.appendChild(marker);
      pageContent.appendChild(span);

      if (state.showTranslation) {
        const translation = state.translationMap.get(ayah.number);
        if (translation) {
          const line = document.createElement("div");
          line.className = "translation-line";
          line.innerHTML = `<strong>${ayah.surah.englishName}:${ayah.numberInSurah}</strong> `;
          line.appendChild(document.createTextNode(translation));
          pageContent.appendChild(line);
        }
      }
    });

    pageContent.style.fontSize = `${state.fontSize}px`;
    el("pageRange").textContent = first && last
      ? `${first.surah.englishName} ${first.numberInSurah} – ${last.surah.englishName} ${last.numberInSurah}`
      : "Informasi halaman tidak tersedia";
    el("mushafPageLabel").textContent = toArabicNumber(state.page);
    el("bottomSurahLabel").textContent = first ? first.surah.name : "القرآن الكريم";
    el("bottomJuzLabel").textContent = first ? `الجزء ${toArabicNumber(first.juz)}` : "";
    el("infoPage").textContent = state.page;
    el("infoJuz").textContent = first ? first.juz : "—";
    el("infoAyahCount").textContent = ayahs.length;
    el("infoSurah").textContent = surahNames.join(", ");
    el("translationToggle").classList.toggle("active-tool", state.showTranslation);
  }

  function toArabicNumber(value) {
    return String(value).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
  }

  async function goToSurah(number) {
    if (!number) return;
    try {
      const data = await fetchJson(`${API}/surah/${number}/${ARABIC_EDITION}`, `surah-${number}`);
      const firstAyah = data.ayahs && data.ayahs[0];
      if (!firstAyah || !firstAyah.page) throw new Error("Nomor halaman surat tidak ditemukan.");
      el("surahSelect").value = String(number);
      el("juzSelect").value = "";
      await loadPage(firstAyah.page);
    } catch (error) {
      console.error(error);
      toast("Tidak dapat membuka surat. Silakan coba lagi.");
    }
  }

  async function goToJuz(number) {
    if (!number) return;
    try {
      const data = await fetchJson(`${API}/juz/${number}/${ARABIC_EDITION}`, `juz-${number}`);
      const firstAyah = data.ayahs && data.ayahs[0];
      if (!firstAyah || !firstAyah.page) throw new Error("Nomor halaman juz tidak ditemukan.");
      el("juzSelect").value = String(number);
      el("surahSelect").value = "";
      await loadPage(firstAyah.page);
    } catch (error) {
      console.error(error);
      toast("Tidak dapat membuka juz. Silakan coba lagi.");
    }
  }

  function saveBookmark() {
    const data = state.currentPageData;
    const first = data && data.ayahs && data.ayahs[0];
    const bookmark = {
      page: state.page,
      surah: first ? first.surah.englishName : "",
      ayah: first ? first.numberInSurah : 1,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmark));
    updateBookmarkPanel();
    toast(`Halaman ${state.page} berhasil disimpan di perangkat ini.`);
  }

  function getBookmark() {
    try { return JSON.parse(localStorage.getItem(BOOKMARK_KEY) || "null"); }
    catch (_) { return null; }
  }

  function updateBookmarkPanel() {
    const bookmark = getBookmark();
    const box = el("bookmarkInfo");
    const button = el("continueBookmarkBtn");
    if (!bookmark) {
      box.className = "bookmark-empty";
      box.innerHTML = '<i class="bi bi-bookmark"></i><span>Belum ada halaman tersimpan.</span>';
      button.disabled = true;
      return;
    }
    box.className = "bookmark-filled";
    box.innerHTML = "";
    const strong = document.createElement("div");
    strong.textContent = `Halaman ${bookmark.page}`;
    const small = document.createElement("small");
    small.className = "d-block text-secondary mt-1";
    small.textContent = `${bookmark.surah || "Al-Qur'an"} · Ayat ${bookmark.ayah || 1}`;
    box.append(strong, small);
    button.disabled = false;
  }

  function bindEvents() {
    el("prevPageBtn").addEventListener("click", () => loadPage(state.page - 1));
    el("nextPageBtn").addEventListener("click", () => loadPage(state.page + 1));
    el("goPageBtn").addEventListener("click", () => {
      const value = Number(el("pageInput").value);
      if (!Number.isInteger(value) || value < 1 || value > MAX_PAGE) {
        toast("Masukkan nomor halaman antara 1 sampai 604.");
        return;
      }
      el("surahSelect").value = "";
      el("juzSelect").value = "";
      loadPage(value);
    });
    el("pageInput").addEventListener("keydown", e => { if (e.key === "Enter") el("goPageBtn").click(); });
    el("surahSelect").addEventListener("change", e => goToSurah(e.target.value));
    el("juzSelect").addEventListener("change", e => goToJuz(e.target.value));
    document.querySelectorAll("[data-surah]").forEach(button => {
      button.addEventListener("click", () => goToSurah(button.dataset.surah));
    });
    el("bookmarkBtn").addEventListener("click", saveBookmark);
    el("bookmarkTopBtn").addEventListener("click", () => {
      const bookmark = getBookmark();
      if (bookmark) loadPage(bookmark.page);
      else toast("Belum ada bookmark tersimpan.");
    });
    el("continueBookmarkBtn").addEventListener("click", () => {
      const bookmark = getBookmark();
      if (bookmark) loadPage(bookmark.page);
    });
    el("retryBtn").addEventListener("click", () => loadPage(state.page));
    el("fontPlus").addEventListener("click", () => {
      state.fontSize = Math.min(44, state.fontSize + 2);
      pageContent.style.fontSize = `${state.fontSize}px`;
    });
    el("fontMinus").addEventListener("click", () => {
      state.fontSize = Math.max(20, state.fontSize - 2);
      pageContent.style.fontSize = `${state.fontSize}px`;
    });
    el("translationToggle").addEventListener("click", () => {
      state.showTranslation = !state.showTranslation;
      if (state.currentPageData) renderPage(state.currentPageData);
    });
  }

  async function init() {
    bindEvents();
    updateBookmarkPanel();
    try {
      await loadSurahs();
      await loadPage(1);
    } catch (error) {
      console.error(error);
      showError("Daftar surat belum dapat dimuat. Periksa koneksi internet lalu tekan Coba lagi.");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
