(() => {
  const $ = (s) => document.querySelector(s);
  const pages = [...document.querySelectorAll(".page")];
  const navLinks = [...document.querySelectorAll(".nav-link")];
  const quranHomeHTML = `<div class="section-head"><div><p class="eyebrow">AL-QUR'AN</p><h1>Daftar Surah</h1><p class="muted">Pilih surah untuk melihat ayat dan memulai hafalan.</p></div></div><div class="search-row"><input id="surahSearch" type="search" placeholder="Cari nama surah..."><span id="surahCount" class="muted">Memuat data...</span></div><div id="surahList" class="surah-list"><div class="loading">Menyiapkan daftar surah...</div></div>`;
  const cfg = window.MQ_CONFIG || {};
  const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_URL.startsWith("ISI_") && !cfg.SUPABASE_ANON_KEY.startsWith("ISI_");
  let client = null, currentUser = null, authMode = "login";

  function showPage(id) {
    if (["hafalan", "murojaah", "pencapaian"].includes(id) && !currentUser) { openAuth("login"); return; }
    pages.forEach(p => p.classList.toggle("active-page", p.id === id));
    navLinks.forEach(a => a.classList.toggle("active", a.dataset.page === id));
    $("#pageTitle").textContent = ({dashboard:"Dashboard",quran:"Al-Qur'an",hafalan:"Hafalan Saya",murojaah:"Jadwal Murojaah",games:"Permainan",pencapaian:"Pencapaian"})[id] || "Dashboard";
    $("#sidebar").classList.remove("open");
    if (id === "quran" && !$("#surahList")) renderQuranHome();
    location.hash = id;
  }
  navLinks.forEach(a => a.addEventListener("click", e => { e.preventDefault(); showPage(a.dataset.page); }));
  document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => showPage(b.dataset.go)));
  $("#menuButton").addEventListener("click", () => $("#sidebar").classList.toggle("open"));

  function updateAuthUI() {
    const name = currentUser?.user_metadata?.display_name || currentUser?.email?.split("@")[0] || "Pengguna";
    const profile = $("#profileButton");
    profile.innerHTML = `<span class="avatar">${escapeHtml(name.slice(0,1).toUpperCase())}</span><span><b>${escapeHtml(name)}</b><small>${currentUser ? "Akun aktif · Kelola akun" : "Mode pengunjung · Masuk"}</small></span><span class="dots">···</span>`;
    profile.onclick = () => openAuth(currentUser ? "account" : "login");
    document.querySelector(".top-actions .avatar.small").textContent = name.slice(0,1).toUpperCase();
  }
  function openAuth(mode="login") {
    authMode = mode; $("#authOverlay").hidden = false; $("#authMessage").textContent = ""; $("#authForm").hidden = mode === "account";
    $("#authTitle").textContent = mode === "signup" ? "Buat akun baru" : mode === "account" ? "Akun Anda" : "Masuk ke akun";
    $("#authDescription").textContent = mode === "signup" ? "Daftar untuk mulai menyimpan hafalan pribadi." : mode === "account" ? `Sedang masuk sebagai ${currentUser?.email || ""}` : "Masuk untuk menyimpan hafalan dan progres pribadi.";
    $("#nameField").hidden = mode !== "signup";
    $("#authPassword").autocomplete = mode === "signup" ? "new-password" : "current-password";
    $("#authSubmit").textContent = mode === "signup" ? "Daftar" : "Masuk";
    $("#authSwitch").hidden = mode === "account";
    $("#authSwitch").textContent = mode === "signup" ? "Sudah punya akun? Masuk" : "Belum punya akun? Daftar";
    $("#authLogout").hidden = mode !== "account";
  }
  function closeAuth(){ $("#authOverlay").hidden = true; }
  $("#authClose").addEventListener("click", closeAuth);
  $("#authOverlay").addEventListener("click", e => { if(e.target === $("#authOverlay")) closeAuth(); });
  $("#authSwitch").addEventListener("click", () => openAuth(authMode === "signup" ? "login" : "signup"));
  $("#authLogout").addEventListener("click", async () => { const {error}=await client.auth.signOut(); if(error){$("#authMessage").textContent=error.message;return;} closeAuth(); });
  $("#authForm").addEventListener("submit", async e => {
    e.preventDefault(); if(!client) return;
    const email=$("#authEmail").value.trim(), password=$("#authPassword").value;
    const submit=$("#authSubmit"); submit.disabled=true; submit.textContent="Memproses..."; $("#authMessage").textContent="";
    try {
      if(authMode === "signup") {
        const display_name=$("#authName").value.trim() || "Pengguna";
        const {data,error}=await client.auth.signUp({email,password,options:{data:{display_name}}});
        if(error) throw error;
        if(data.session){ $("#authMessage").textContent="Pendaftaran berhasil dan Anda sudah masuk."; }
        else { $("#authMessage").textContent="Pendaftaran berhasil. Periksa email untuk konfirmasi, lalu masuk."; }
      } else {
        const {error}=await client.auth.signInWithPassword({email,password}); if(error) throw error;
        closeAuth();
      }
    } catch(err) { $("#authMessage").textContent=err.message || "Terjadi kesalahan."; }
    finally { submit.disabled=false; submit.textContent=authMode === "signup" ? "Daftar" : "Masuk"; }
  });

  const initial = location.hash.replace("#","") || "dashboard";
  if(configured && window.supabase){ client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY); }
  if(client){
    client.auth.getSession().then(({data})=>{currentUser=data.session?.user||null;updateAuthUI();});
    client.auth.onAuthStateChange((_event,session)=>{currentUser=session?.user||null;updateAuthUI();});
  } else { $("#surahList").innerHTML='<div class="panel loading">Hubungkan Supabase terlebih dahulu untuk memuat 114 surah.</div>'; $("#surahCount").textContent="Belum terhubung"; }
  updateAuthUI();
  showPage(document.getElementById(initial) ? initial : "dashboard");
  if(client){ renderQuranHome(); loadSurahs(); }

  function renderQuranHome(){ $("#quran").innerHTML=quranHomeHTML; if(window.MQ_SURAHS) renderSurahs(filterSurahs($("#surahSearch").value)); }
  async function loadSurahs(){ if(!$("#surahList")) renderQuranHome(); const el=$("#surahList"); if(!el)return; el.innerHTML='<div class="loading">Memuat daftar surah...</div>'; const {data,error}=await client.from("surahs").select("id,name_ar,name_latin,ayah_count,revelation_type").order("id"); if(!$("#surahList"))renderQuranHome(); const list=$("#surahList"); if(!list)return; if(error){list.innerHTML=`<div class="panel loading">Gagal memuat data: ${escapeHtml(error.message)}</div>`;return;} window.MQ_SURAHS=data||[]; renderSurahs(window.MQ_SURAHS); }
  function filterSurahs(q){q=(q||"").trim().toLocaleLowerCase("id");return(window.MQ_SURAHS||[]).filter(s=>s.name_latin.toLocaleLowerCase("id").includes(q)||String(s.id)===q);}
  function renderSurahs(rows){const list=$("#surahList");if(!list)return;$("#surahCount").textContent=`${rows.length} surah`;list.innerHTML=rows.map(s=>`<button class="surah-item" data-surah="${s.id}"><span class="surah-number">${s.id}</span><span class="surah-meta"><b>${escapeHtml(s.name_latin)}</b><small>${s.ayah_count} ayat · ${s.revelation_type==="makkiyah"?"Makkiyah":"Madaniyah"}</small></span><span class="surah-ar" lang="ar" dir="rtl">${escapeHtml(s.name_ar)}</span></button>`).join("");}
  document.addEventListener("input",e=>{if(e.target?.id==="surahSearch")renderSurahs(filterSurahs(e.target.value));});
  document.addEventListener("click",e=>{const b=e.target.closest("[data-surah]");if(b){openSurah(Number(b.dataset.surah));return;}if(e.target.closest("#backSurahs"))renderQuranHome();});
  async function openSurah(id){if(!client)return;const s=(window.MQ_SURAHS||[]).find(x=>x.id===id);if(!s)return;$("#quran").innerHTML=`<button class="secondary-button" id="backSurahs">← Kembali ke daftar surah</button><div class="section-head" style="margin-top:20px"><p class="eyebrow">AL-QUR'AN</p><h1>${escapeHtml(s.name_latin)} <span lang="ar">${escapeHtml(s.name_ar)}</span></h1><p class="muted">${s.ayah_count} ayat · ${escapeHtml(s.revelation_type)}</p></div><div id="ayahContent" class="loading">Memuat ayat...</div>`;const {data,error}=await client.from("ayahs").select("ayah_number,juz_number,text_uthmani").eq("surah_id",id).order("ayah_number");const out=$("#ayahContent");if(!out)return;if(error){out.innerHTML=`<div class="panel loading">Ayat tidak dapat dimuat: ${escapeHtml(error.message)}</div>`;return;}out.innerHTML=(data||[]).map(a=>`<article class="panel" style="margin-bottom:10px"><small class="muted">${escapeHtml(s.name_latin)} · Ayat ${a.ayah_number} · Juz ${a.juz_number}</small><p lang="ar" dir="rtl" style="font-family:serif;font-size:27px;line-height:2.1;text-align:right;margin:12px 0">${escapeHtml(a.text_uthmani)}</p></article>`).join("");}
  function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
})();