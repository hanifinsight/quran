(() => {
  const $ = (s) => document.querySelector(s);
  const pages = [...document.querySelectorAll(".page")];
  const navLinks = [...document.querySelectorAll(".nav-link")];
  function showPage(id) {
    pages.forEach(p => p.classList.toggle("active-page", p.id === id));
    navLinks.forEach(a => a.classList.toggle("active", a.dataset.page === id));
    $("#pageTitle").textContent = ({dashboard:"Dashboard",quran:"Al-Qur'an",hafalan:"Hafalan Saya",murojaah:"Jadwal Murojaah",games:"Permainan",pencapaian:"Pencapaian"})[id] || "Dashboard";
    $("#sidebar").classList.remove("open");
    location.hash = id;
  }
  navLinks.forEach(a => a.addEventListener("click", e => { e.preventDefault(); showPage(a.dataset.page); }));
  document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => showPage(b.dataset.go)));
  $("#menuButton").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
  const initial = location.hash.replace("#","") || "dashboard";
  showPage(document.getElementById(initial) ? initial : "dashboard");

  const cfg = window.MQ_CONFIG || {};
  const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.startsWith("ISI_") && !cfg.SUPABASE_ANON_KEY.startsWith("ISI_");
  let client = null;
  if (configured && window.supabase) {
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    loadSurahs();
  } else {
    $("#surahList").innerHTML = '<div class="panel loading">Hubungkan Supabase terlebih dahulu untuk memuat 114 surah.</div>';
    $("#surahCount").textContent = "Belum terhubung";
  }
  async function loadSurahs() {
    $("#surahList").innerHTML = '<div class="loading">Memuat daftar surah...</div>';
    const { data, error } = await client.from("surahs")
      .select("id,name_ar,name_latin,ayah_count,revelation_type")
      .order("id");
    if (error) {
      $("#surahList").innerHTML = `<div class="panel loading">Gagal memuat data: ${escapeHtml(error.message)}</div>`;
      return;
    }
    window.MQ_SURAHS = data || [];
    renderSurahs(window.MQ_SURAHS);
  }
  function renderSurahs(rows) {
    $("#surahCount").textContent = `${rows.length} surah`;
    $("#surahList").innerHTML = rows.map(s => `
      <button class="surah-item" data-surah="${s.id}">
        <span class="surah-number">${s.id}</span>
        <span class="surah-meta"><b>${escapeHtml(s.name_latin)}</b><small>${s.ayah_count} ayat · ${s.revelation_type === "makkiyah" ? "Makkiyah" : "Madaniyah"}</small></span>
        <span class="surah-ar" lang="ar" dir="rtl">${escapeHtml(s.name_ar)}</span>
      </button>`).join("");
    document.querySelectorAll("[data-surah]").forEach(btn => btn.addEventListener("click", () => openSurah(Number(btn.dataset.surah))));
  }
  $("#surahSearch").addEventListener("input", e => {
    const q = e.target.value.toLocaleLowerCase("id");
    renderSurahs((window.MQ_SURAHS || []).filter(s => s.name_latin.toLocaleLowerCase("id").includes(q) || String(s.id) === q));
  });
  async function openSurah(id) {
    const s = (window.MQ_SURAHS || []).find(x => x.id === id);
    if (!s) return;
    const { data, error } = await client.from("ayahs")
      .select("ayah_number,juz_number,text_uthmani")
      .eq("surah_id", id).order("ayah_number");
    if (error) { alert("Ayat tidak dapat dimuat: " + error.message); return; }
    const list = (data || []).map(a => `<article class="panel" style="margin-bottom:10px"><small class="muted">${s.name_latin} · Ayat ${a.ayah_number} · Juz ${a.juz_number}</small><p lang="ar" dir="rtl" style="font-family:serif;font-size:27px;line-height:2.1;text-align:right;margin:12px 0">${escapeHtml(a.text_uthmani)}</p></article>`).join("");
    const section = $("#quran");
    section.innerHTML = `<button class="secondary-button" id="backSurahs">← Kembali ke daftar surah</button><div class="section-head" style="margin-top:20px"><p class="eyebrow">AL-QUR'AN</p><h1>${escapeHtml(s.name_latin)} <span lang="ar">${escapeHtml(s.name_ar)}</span></h1><p class="muted">${s.ayah_count} ayat · ${s.revelation_type}</p></div>${list}`;
    $("#backSurahs").addEventListener("click", () => loadSurahs());
  }
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
})();