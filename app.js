(() => {
  const $ = (s) => document.querySelector(s);
  const pages = [...document.querySelectorAll(".page")];
  const navLinks = [...document.querySelectorAll(".nav-link")];
  const quranHomeHTML = `<div class="section-head"><div><p class="eyebrow">AL-QUR'AN</p><h1>Daftar Surah</h1><p class="muted">Pilih surah untuk melihat ayat dan memulai hafalan.</p></div></div><div class="search-row"><input id="surahSearch" type="search" placeholder="Cari nama surah..."><span id="surahCount" class="muted">Memuat data...</span></div><div id="surahList" class="surah-list"><div class="loading">Menyiapkan daftar surah...</div></div>`;
  const cfg = window.MQ_CONFIG || {};
  const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_URL.startsWith("ISI_") && !cfg.SUPABASE_ANON_KEY.startsWith("ISI_");
  let client = null, currentUser = null, authMode = "login", pendingPage = null;

  function showPage(id) {
    const target = document.getElementById(id);
    if (!target || !target.classList.contains("page")) id = "dashboard";
    if (["hafalan", "murojaah", "games", "pencapaian"].includes(id) && !currentUser) {
      pendingPage = id;
      $("#sidebar").classList.remove("open");
      openAuth("login");
      $("#authMessage").textContent = "Silakan masuk untuk membuka fitur " + ({hafalan:"Hafalan Saya",murojaah:"Jadwal Murojaah",games:"Permainan",pencapaian:"Pencapaian"}[id]) + ".";
      return;
    }
    pages.forEach(p => p.classList.toggle("active-page", p.id === id));
    navLinks.forEach(a => {
      const active = a.dataset.page === id;
      a.classList.toggle("active", active);
      if (active) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    const title = $("#pageTitle");
    if (title) title.textContent = ({dashboard:"Dashboard",quran:"Al-Qur'an",hafalan:"Hafalan Saya",murojaah:"Jadwal Murojaah",games:"Permainan",pencapaian:"Pencapaian"})[id] || "Dashboard";
    $("#sidebar")?.classList.remove("open");
    if (id === "quran" && !$("#surahList")) renderQuranHome();
    if (id === "quran" && client && (!window.MQ_SURAHS || !window.MQ_SURAHS.length)) loadSurahs();
    if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
  }
  // Delegasi klik membuat seluruh item navigasi tetap responsif, termasuk setelah render ulang.
  document.addEventListener("click", e => {
    const link = e.target.closest(".nav-link[data-page]");
    if (!link) return;
    e.preventDefault();
    showPage(link.dataset.page);
  });
  $("#menuButton").addEventListener("click", () => $("#sidebar").classList.toggle("open"));

  function updateAuthUI() {
    const name = currentUser?.user_metadata?.display_name || currentUser?.email?.split("@")[0] || "Pengguna";
    document.body.classList.toggle("guest-mode", !currentUser);
    const profile = $("#profileButton");
    profile.innerHTML = `<span class="avatar">${escapeHtml(name.slice(0,1).toUpperCase())}</span><span><b>${escapeHtml(name)}</b><small>${currentUser ? "Akun aktif · Kelola akun" : "Mode pengunjung · Masuk"}</small></span><span class="dots">···</span>`;
    profile.onclick = () => openAuth(currentUser ? "account" : "login");
    const topAvatar = $("#topAvatar"); if (topAvatar) topAvatar.textContent = name.slice(0,1).toUpperCase();
    $("#topLogin").hidden = !!currentUser; $("#topLogout").hidden = !currentUser;
    $("#publicQuran").hidden = false;
    renderDashboard();
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
  function closeAuth(){ $("#authOverlay").hidden = true; pendingPage = null; }
  $("#authClose").addEventListener("click", closeAuth);
  $("#topLogin").addEventListener("click", (event) => { event.preventDefault(); openAuth("login"); });
  $("#publicQuran").addEventListener("click", () => showPage("quran"));
  $("#topAvatar").addEventListener("click", () => openAuth(currentUser ? "account" : "login"));
  async function doLogout(){ if(!client || !currentUser) return; if(!confirm("Keluar dari akun Murojaah Quest?")) return; const {error}=await client.auth.signOut(); if(error){ $("#authMessage").textContent=error.message; openAuth("account"); return; } closeAuth(); showPage("dashboard"); }
  $("#topLogout").addEventListener("click", doLogout);
  $("#authOverlay").addEventListener("click", e => { if(e.target === $("#authOverlay")) closeAuth(); });
  $("#authSwitch").addEventListener("click", () => openAuth(authMode === "signup" ? "login" : "signup"));
  $("#authLogout").addEventListener("click", doLogout);
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
        const {data,error}=await client.auth.signInWithPassword({email,password}); if(error) throw error;
        currentUser = data.user || data.session?.user || null;
        updateAuthUI();
        const destination = pendingPage || "dashboard";
        closeAuth();
        pendingPage = null;
        showPage(destination);
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

  function renderDashboard(){
    const el=$("#dashboard"); if(!el) return;
    const name=currentUser?.user_metadata?.display_name || currentUser?.email?.split("@")[0] || "Pengguna";
    if(!currentUser){
      el.innerHTML=`
        <section class="landing-hero">
          <div class="landing-copy">
            <p class="eyebrow">TEMAN PERJALANAN MENJAGA HAFALAN</p>
            <h1>Lebih dekat dengan Al-Qur’an, setiap hari.</h1>
            <p class="landing-description">Murojaah Quest membantu menghadirkan pengalaman membaca Al-Qur’an yang nyaman. Mulai dengan membaca 114 surah, tanpa perlu membuat akun.</p>
            <button class="primary-button landing-cta" data-go="quran">Baca Al-Qur’an <span aria-hidden="true">→</span></button>
          </div>
          <div class="landing-art" aria-hidden="true"><span>۞</span><small>اقْرَأْ</small></div>
        </section>
        <section class="landing-intro">
          <p class="eyebrow">MUROJAAH QUEST</p>
          <h2>Mulai dari membaca.</h2>
          <p class="muted">Jelajahi daftar surah dan baca ayat Al-Qur’an. Fitur pencatatan hafalan dan perjalanan pribadi tersedia setelah masuk ke akun.</p>
          <div class="landing-facts"><div><strong>114</strong><span>Surah</span></div><div><strong>6.236</strong><span>Ayat</span></div><div><strong>Gratis</strong><span>Akses membaca</span></div></div>
        </section>`;
    } else {
      el.innerHTML=`<div class="welcome"><div><p class="eyebrow">ASSALAMU'ALAIKUM 👋</p><h1>Selamat datang, ${escapeHtml(name)}.</h1><p class="muted">Lanjutkan perjalanan menjaga hafalan. Sedikit demi sedikit, secara konsisten.</p><div class="dashboard-actions"><button class="primary-button" data-go="hafalan">Buka Hafalan Saya</button><button class="secondary-button" data-go="quran">Baca Al-Qur'an</button></div></div><div class="welcome-art" aria-hidden="true">۞</div></div><div class="stats-grid"><article class="stat-card"><span class="stat-icon green">▤</span><div><small>Surah dihafal</small><strong>0</strong><small class="muted">Surah tercatat</small></div></article><article class="stat-card"><span class="stat-icon gold">✧</span><div><small>Ayat dikuasai</small><strong>0</strong><small class="muted">Ayat hafalan</small></div></article><article class="stat-card"><span class="stat-icon blue">↻</span><div><small>Perlu murojaah</small><strong>0</strong><small class="muted">Target berikutnya</small></div></article><article class="stat-card"><span class="stat-icon purple">☆</span><div><small>Total XP</small><strong>0</strong><small class="muted">Terus bertumbuh</small></div></article></div><div class="content-grid"><article class="panel"><p class="eyebrow">MULAI HARI INI</p><h2>Target murojaah</h2><p class="muted">Belum ada hafalan yang tercatat. Tambahkan hafalan pertamamu untuk memulai.</p><button class="primary-button" data-go="hafalan">+ Tambah hafalan</button></article><article class="panel"><p class="eyebrow">AKUN AKTIF</p><h2>${escapeHtml(currentUser.email||"")}</h2><p class="muted">Progres pribadi akan ditampilkan di dashboard setelah data hafalan tersedia.</p><button class="secondary-button" data-go="pencapaian">Lihat pencapaian</button></article></div>`;
    }
    const guest = !currentUser;
    document.querySelectorAll(".top-actions .streak, .top-actions .xp").forEach(node => node.hidden = guest);
    $("#topAvatar").hidden = guest;
  }
  document.addEventListener("click",e=>{
    const auth=e.target.closest("[data-auth]");
    if(auth){openAuth(auth.dataset.auth);return;}
    const go=e.target.closest("[data-go]");
    if(go) showPage(go.dataset.go);
  });

    function renderQuranHome(){ $("#quran").innerHTML=quranHomeHTML; if(window.MQ_SURAHS) renderSurahs(filterSurahs($("#surahSearch").value)); }
  async function loadSurahs(){ if(!$("#surahList")) renderQuranHome(); const el=$("#surahList"); if(!el)return; el.innerHTML='<div class="loading">Memuat daftar surah...</div>'; const {data,error}=await client.from("surahs").select("id,name_ar,name_latin,ayah_count,revelation_type").order("id"); if(!$("#surahList"))renderQuranHome(); const list=$("#surahList"); if(!list)return; if(error){list.innerHTML=`<div class="panel loading">Gagal memuat data: ${escapeHtml(error.message)}</div>`;return;} window.MQ_SURAHS=data||[]; renderSurahs(window.MQ_SURAHS); }
  function filterSurahs(q){q=(q||"").trim().toLocaleLowerCase("id");return(window.MQ_SURAHS||[]).filter(s=>s.name_latin.toLocaleLowerCase("id").includes(q)||String(s.id)===q);}
  function renderSurahs(rows){const list=$("#surahList");if(!list)return;$("#surahCount").textContent=`${rows.length} surah`;list.innerHTML=rows.map(s=>`<button class="surah-item" data-surah="${s.id}"><span class="surah-number">${s.id}</span><span class="surah-meta"><b>${escapeHtml(s.name_latin)}</b><small>${s.ayah_count} ayat · ${s.revelation_type==="makkiyah"?"Makkiyah":"Madaniyah"}</small></span><span class="surah-ar" lang="ar" dir="rtl">${escapeHtml(s.name_ar)}</span></button>`).join("");}
  document.addEventListener("input",e=>{if(e.target?.id==="surahSearch")renderSurahs(filterSurahs(e.target.value));});
  document.addEventListener("click",e=>{const b=e.target.closest("[data-surah]");if(b){openSurah(Number(b.dataset.surah));return;}if(e.target.closest("#backSurahs"))renderQuranHome();});
  async function openSurah(id){if(!client)return;const s=(window.MQ_SURAHS||[]).find(x=>x.id===id);if(!s)return;$("#quran").innerHTML=`<button class="secondary-button" id="backSurahs">← Kembali ke daftar surah</button><div class="section-head" style="margin-top:20px"><p class="eyebrow">AL-QUR'AN</p><h1>${escapeHtml(s.name_latin)} <span lang="ar">${escapeHtml(s.name_ar)}</span></h1><p class="muted">${s.ayah_count} ayat · ${escapeHtml(s.revelation_type)}</p></div><div id="ayahContent" class="loading">Memuat ayat...</div>`;const {data,error}=await client.from("ayahs").select("ayah_number,juz_number,text_uthmani").eq("surah_id",id).order("ayah_number");const out=$("#ayahContent");if(!out)return;if(error){out.innerHTML=`<div class="panel loading">Ayat tidak dapat dimuat: ${escapeHtml(error.message)}</div>`;return;}out.innerHTML=(data||[]).map(a=>`<article class="panel" style="margin-bottom:10px"><small class="muted">${escapeHtml(s.name_latin)} · Ayat ${a.ayah_number} · Juz ${a.juz_number}</small><p lang="ar" dir="rtl" style="font-family:serif;font-size:27px;line-height:2.1;text-align:right;margin:12px 0">${escapeHtml(a.text_uthmani)}</p></article>`).join("");}
  function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
})();