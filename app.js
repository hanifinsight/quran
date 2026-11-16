(() => {
  const $ = (s) => document.querySelector(s);
  const pages = [...document.querySelectorAll(".page")];
  const navLinks = [...document.querySelectorAll(".nav-link")];

  const quranHomeHTML = `
    <div class="section-head">
      <div><p class="eyebrow">AL-QUR'AN</p><h1>Daftar Surah</h1>
      <p class="muted">Pilih surah untuk melihat ayat dan memulai hafalan.</p></div>
    </div>
    <div class="search-row">
      <input id="surahSearch" type="search" placeholder="Cari nama surah...">
      <span id="surahCount" class="muted">Memuat data...</span>
    </div>
    <div id="surahList" class="surah-list"><div class="loading">Menyiapkan daftar surah...</div></div>`;

  function showPage(id) {
    pages.forEach(p => p.classList.toggle("active-page", p.id === id));
    navLinks.forEach(a => a.classList.toggle("active", a.dataset.page === id));
    $("#pageTitle").textContent = ({
      dashboard:"Dashboard", quran:"Al-Qur'an", hafalan:"Hafalan Saya",
      murojaah:"Jadwal Murojaah", games:"Permainan", pencapaian:"Pencapaian"
    })[id] || "Dashboard";
    $("#sidebar").classList.remove("open");
    if (id === "quran" && !$("#surahList")) renderQuranHome();
    location.hash = id;
  }

  navLinks.forEach(a => a.addEventListener("click", e => {
    e.preventDefault();
    showPage(a.dataset.page);
  }));
  document.querySelectorAll("[data-go]").forEach(b =>
    b.addEventListener("click", () => showPage(b.dataset.go))
  );
  $("#menuButton").addEventListener("click", () => $("#sidebar").classList.toggle("open"));

  const initial = location.hash.replace("#","") || "dashboard";
  showPage(document.getElementById(initial) ? initial : "dashboard");

  const cfg = window.MQ_CONFIG || {};
  const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.startsWith("ISI_") && !cfg.SUPABASE_ANON_KEY.startsWith("ISI_");
  let client = null;
  if (configured && window.supabase) {
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    renderQuranHome();
    loadSurahs();
  } else {
    renderQuranHome();
    $("#surahList").innerHTML =
      '<div class="panel loading">Hubungkan Supabase terlebih dahulu untuk memuat 114 surah.</div>';
    $("#surahCount").textContent = "Belum terhubung";
  }

  function renderQuranHome() {
    $("#quran").innerHTML = quranHomeHTML;
    if (window.MQ_SURAHS) renderSurahs(filterSurahs($("#surahSearch").value));
  }

  async function loadSurahs() {
    // Pastikan elemen daftar ada. Elemen ini bisa terhapus ketika detail surah dibuka.
    if (!$("#surahList")) renderQuranHome();

    const listBeforeRequest = $("#surahList");
    if (!listBeforeRequest) {
      console.error("Elemen #surahList tidak ditemukan di dalam #quran.");
      return;
    }
    listBeforeRequest.innerHTML = '<div class="loading">Memuat daftar surah...</div>';

    const { data, error } = await client.from("surahs")
      .select("id,name_ar,name_latin,ayah_count,revelation_type")
      .order("id");

    // Cek ulang setelah request selesai, karena halaman mungkin berubah selama menunggu.
    if (!$("#surahList")) renderQuranHome();
    const listAfterRequest = $("#surahList");
    if (!listAfterRequest) {
      console.error("Elemen #surahList tidak tersedia setelah data selesai dimuat.");
      return;
    }

    if (error) {
      listAfterRequest.innerHTML =
        `<div class="panel loading">Gagal memuat data: ${escapeHtml(error.message)}</div>`;
      return;
    }

    window.MQ_SURAHS = data || [];
    renderSurahs(window.MQ_SURAHS);
  }

  function filterSurahs(query) {
    const q = (query || "").trim().toLocaleLowerCase("id");
    return (window.MQ_SURAHS || []).filter(s =>
      s.name_latin.toLocaleLowerCase("id").includes(q) || String(s.id) === q
    );
  }

  function renderSurahs(rows) {
    const list = $("#surahList");
    if (!list) return;
    $("#surahCount").textContent = `${rows.length} surah`;
    list.innerHTML = rows.map(s => `
      <button class="surah-item" data-surah="${s.id}">
        <span class="surah-number">${s.id}</span>
        <span class="surah-meta">
          <b>${escapeHtml(s.name_latin)}</b>
          <small>${s.ayah_count} ayat · ${s.revelation_type === "makkiyah" ? "Makkiyah" : "Madaniyah"}</small>
        </span>
        <span class="surah-ar" lang="ar" dir="rtl">${escapeHtml(s.name_ar)}</span>
      </button>`).join("");
  }

  // Event delegation: tetap bekerja walaupun isi halaman Al-Qur'an diganti.
  document.addEventListener("input", e => {
    if (e.target && e.target.id === "surahSearch") {
      renderSurahs(filterSurahs(e.target.value));
    }
  });

  document.addEventListener("click", e => {
    const surahButton = e.target.closest("[data-surah]");
    if (surahButton) {
      openSurah(Number(surahButton.dataset.surah));
      return;
    }
    if (e.target.closest("#backSurahs")) {
      renderQuranHome();
    }
  });

  async function openSurah(id) {
    if (!client) return;
    const s = (window.MQ_SURAHS || []).find(x => x.id === id);
    if (!s) return;

    $("#quran").innerHTML = `
      <button class="secondary-button" id="backSurahs">← Kembali ke daftar surah</button>
      <div class="section-head" style="margin-top:20px">
        <p class="eyebrow">AL-QUR'AN</p>
        <h1>${escapeHtml(s.name_latin)} <span lang="ar">${escapeHtml(s.name_ar)}</span></h1>
        <p class="muted">${s.ayah_count} ayat · ${escapeHtml(s.revelation_type)}</p>
      </div>
      <div id="ayahContent" class="loading">Memuat ayat...</div>`;

    const { data, error } = await client.from("ayahs")
      .select("ayah_number,juz_number,text_uthmani")
      .eq("surah_id", id)
      .order("ayah_number");

    const ayahContent = $("#ayahContent");
    if (!ayahContent) return;
    if (error) {
      ayahContent.innerHTML =
        `<div class="panel loading">Ayat tidak dapat dimuat: ${escapeHtml(error.message)}</div>`;
      return;
    }
    ayahContent.innerHTML = (data || []).map(a => `
      <article class="panel" style="margin-bottom:10px">
        <small class="muted">${escapeHtml(s.name_latin)} · Ayat ${a.ayah_number} · Juz ${a.juz_number}</small>
        <p lang="ar" dir="rtl" style="font-family:serif;font-size:27px;line-height:2.1;text-align:right;margin:12px 0">
          ${escapeHtml(a.text_uthmani)}
        </p>
      </article>`).join("");
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
    }[c]));
  }
})();