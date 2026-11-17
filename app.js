(() => {
  const $ = (s) => document.querySelector(s);
  const pages = [...document.querySelectorAll(".page")];
  const navLinks = [...document.querySelectorAll(".nav-link")];
  const quranHomeHTML = `<div class="section-head"><div><p class="eyebrow">AL-QUR'AN</p><h1>Daftar Surah</h1><p class="muted">Pilih surah untuk melihat ayat dan memulai hafalan.</p></div></div><div class="search-row"><input id="surahSearch" type="search" placeholder="Cari nama surah..."><span id="surahCount" class="muted">Memuat data...</span></div><div id="surahList" class="surah-list"><div class="loading">Menyiapkan daftar surah...</div></div>`;
  const cfg = window.MQ_CONFIG || {};
  const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_URL.startsWith("ISI_") && !cfg.SUPABASE_ANON_KEY.startsWith("ISI_");
  let client = null, currentUser = null, authMode = "login", pendingPage = null, authReady = false;

  function showPage(id) {
    const target = document.getElementById(id);
    if (!target || !target.classList.contains("page")) id = "dashboard";
    if (["hafalan", "murojaah", "games", "pencapaian"].includes(id) && !authReady) {
      pendingPage = id;
      return;
    }
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
    if (id === "games") renderGames();
    if (id === "pencapaian") renderAchievements();
    if (id === "quran" && client && (!window.MQ_SURAHS || !window.MQ_SURAHS.length)) loadSurahs();
    if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
  }
  // Delegasi klik membuat seluruh item navigasi tetap responsif, termasuk setelah render ulang.
  document.addEventListener("click", e => {
    const link = e.target.closest(".nav-link[data-page], .public-brand[data-page]");
    if (!link) return;
    e.preventDefault();
    showPage(link.dataset.page);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    loadRewardSummary();
  }
  function openAuth(mode="login") {
    authMode = mode;
    $("#authOverlay").hidden = false;
    $("#authOverlay").setAttribute("aria-hidden", "false");
    $("#authMessage").textContent = "";
    $("#authForm").hidden = mode === "account";
    $("#authTitle").textContent = mode === "signup" ? "Buat akun baru" : mode === "forgot" ? "Lupa password" : mode === "recovery" ? "Buat password baru" : mode === "account" ? "Akun Anda" : "Masuk ke akun";
    $("#authDescription").textContent = mode === "signup" ? "Daftar untuk mulai menyimpan hafalan pribadi." : mode === "forgot" ? "Masukkan email akun. Kami akan mengirim tautan untuk mengatur ulang password." : mode === "recovery" ? "Buat password baru untuk akun Murojaah Quest." : mode === "account" ? `Sedang masuk sebagai ${currentUser?.email || ""}` : "Masuk untuk menyimpan hafalan dan progres pribadi.";
    $("#nameField").hidden = mode !== "signup";
    $("#authPassword").hidden = mode === "forgot";
    $("#authPassword").required = mode !== "forgot";
    $("#authPassword").autocomplete = mode === "signup" || mode === "recovery" ? "new-password" : "current-password";
    $("#authSubmit").textContent = mode === "signup" ? "Daftar" : mode === "forgot" ? "Kirim tautan reset" : mode === "recovery" ? "Simpan password baru" : "Masuk";
    $("#authSwitch").hidden = mode === "account" || mode === "forgot" || mode === "recovery";
    $("#authSwitch").textContent = mode === "signup" ? "Sudah punya akun? Masuk" : "Belum punya akun? Daftar";
    $("#forgotPassword").hidden = mode !== "login";
    $("#authLogout").hidden = mode !== "account";
    requestAnimationFrame(() => (mode === "account" ? $("#authClose") : mode === "forgot" ? $("#authEmail") : $("#authPassword"))?.focus());
  }
  function closeAuth(){
    $("#authOverlay").hidden = true;
    $("#authOverlay").setAttribute("aria-hidden", "true");
    pendingPage = null;
  }
  $("#authClose").addEventListener("click", closeAuth);
  $("#topLogin").addEventListener("click", (event) => { event.preventDefault(); openAuth("login"); });
  $("#publicQuran").addEventListener("click", (event) => {
    event.preventDefault();
    if (!$("#surahList")) renderQuranHome();
    showPage("quran");
    if (client && (!window.MQ_SURAHS || !window.MQ_SURAHS.length)) loadSurahs();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  $("#topAvatar").addEventListener("click", () => openAuth(currentUser ? "account" : "login"));
  async function doLogout(){ if(!client || !currentUser) return; if(!confirm("Keluar dari akun Murojaah Quest?")) return; const {error}=await client.auth.signOut(); if(error){ $("#authMessage").textContent=error.message; openAuth("account"); return; } closeAuth(); showPage("dashboard"); }
  $("#topLogout").addEventListener("click", doLogout);
  $("#authOverlay").addEventListener("click", e => { if(e.target === $("#authOverlay")) closeAuth(); });
  $("#authSwitch").addEventListener("click", () => openAuth(authMode === "signup" ? "login" : "signup"));
  $("#forgotPassword").addEventListener("click", () => openAuth("forgot"));
  $("#authLogout").addEventListener("click", doLogout);
  $("#authForm").addEventListener("submit", async e => {
    e.preventDefault(); if(!client) return;
    const email=$("#authEmail").value.trim(), password=$("#authPassword").value;
    const submit=$("#authSubmit"); submit.disabled=true; submit.textContent="Memproses..."; $("#authMessage").textContent="";
    try {
      if(authMode === "forgot") {
        const redirectTo=window.location.origin+window.location.pathname;
        const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo});
        if(error) throw error;
        $("#authMessage").textContent="Tautan reset password telah dikirim. Periksa email, termasuk folder Spam.";
      } else if(authMode === "recovery") {
        const {error}=await client.auth.updateUser({password});
        if(error) throw error;
        await client.auth.signOut();
        currentUser=null; updateAuthUI(); openAuth("login");
        $("#authMessage").textContent="Password berhasil diperbarui. Silakan masuk dengan password baru.";
      } else if(authMode === "signup") {
        const display_name=$("#authName").value.trim() || "Pengguna";
        const {data,error}=await client.auth.signUp({email,password,options:{data:{display_name}}});
        if(error) throw error;
        $("#authMessage").textContent=data.session ? "Pendaftaran berhasil dan Anda sudah masuk." : "Pendaftaran berhasil. Periksa email untuk konfirmasi, lalu masuk.";
      } else {
        const {data,error}=await client.auth.signInWithPassword({email,password}); if(error) throw error;
        currentUser=data.user||data.session?.user||null; authReady=true; updateAuthUI();
        const destination=pendingPage||"dashboard"; closeAuth(); pendingPage=null; showPage(destination);
      }
    } catch(err) { $("#authMessage").textContent=err.message||"Terjadi kesalahan."; }
    finally { submit.disabled=false; submit.textContent=authMode==="signup"?"Daftar":authMode==="forgot"?"Kirim tautan reset":authMode==="recovery"?"Simpan password baru":"Masuk"; }
  });

  const initial = location.hash.replace("#","") || "dashboard";
  if(configured && window.supabase){ client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY); }
  if(client){
    // Tunggu INITIAL_SESSION dari Supabase sebelum menentukan apakah halaman privat
    // harus membuka login. Ini mencegah refresh menganggap pengguna sebagai tamu.
    client.auth.onAuthStateChange((event,session)=>{
      currentUser=session?.user||null;
      authReady=true;
      updateAuthUI();
      if(event==="INITIAL_SESSION"){
        const destination=pendingPage||initial;
        pendingPage=null;
        showPage(destination);
      } else if(event==="SIGNED_OUT" && ["hafalan","murojaah","games","pencapaian"].includes(location.hash.replace("#",""))){
        showPage("dashboard");
      } else if(event==="PASSWORD_RECOVERY"){
        openAuth("recovery");
      }
    });
  } else {
    authReady=true;
    $("#surahList").innerHTML='<div class="panel loading">Hubungkan Supabase terlebih dahulu untuk memuat 114 surah.</div>';
    $("#surahCount").textContent="Belum terhubung";
  }
  updateAuthUI();
  showPage(document.getElementById(initial) ? initial : "dashboard");

  if(client){ renderQuranHome(); loadSurahs(); }

  async function loadRewardSummary(){
    if(!client||!currentUser)return;
    const {data,error}=await client.from("user_rewards").select("total_xp,current_streak,longest_streak").eq("user_id",currentUser.id).maybeSingle();
    if(error){console.warn("Gagal memuat XP:",error.message);return;}
    const xp=Number(data?.total_xp||0),streak=Number(data?.current_streak||0);
    const xpNode=document.querySelector(".top-actions .xp b");
    const streakNode=document.querySelector(".top-actions .streak b");
    if(xpNode)xpNode.textContent=xp+" XP";
    if(streakNode)streakNode.textContent=streak;
    const dashboardXp=document.querySelector("#dashboard .stats-grid .stat-card:nth-child(4) strong");
    if(dashboardXp)dashboardXp.textContent=xp;
  }
  async function renderAchievements(){
    const el=$("#pencapaian");if(!el)return;
    if(!currentUser){el.innerHTML='<div class="panel empty-state">Masuk untuk melihat pencapaian.</div>';return;}
    el.innerHTML='<div class="panel loading">Memuat XP dan pencapaian...</div>';
    const [{data:reward,error:rewardError},{data:badges,error:badgeError},{data:earned,error:earnedError}]=await Promise.all([
      client.from("user_rewards").select("total_xp,current_streak,longest_streak,last_activity_date").eq("user_id",currentUser.id).maybeSingle(),
      client.from("badges").select("id,code,title,description,xp_threshold").order("xp_threshold"),
      client.from("user_badges").select("badge_id,earned_at").eq("user_id",currentUser.id)
    ]);
    if(rewardError||badgeError||earnedError){el.innerHTML='<div class="panel loading">Data pencapaian belum dapat dimuat. Coba refresh halaman.</div>';return;}
    const xp=Number(reward?.total_xp||0),streak=Number(reward?.current_streak||0),longest=Number(reward?.longest_streak||0);
    const earnedIds=new Set((earned||[]).map(x=>x.badge_id));
    const badgeCards=(badges||[]).map(b=>{
      const unlocked=earnedIds.has(b.id)|| (b.xp_threshold!=null&&xp>=Number(b.xp_threshold));
      return `<article class="badge-card ${unlocked?"unlocked":"locked"}"><div class="badge-medal">${unlocked?"🏅":"🔒"}</div><div><strong>${escapeHtml(b.title)}</strong><p>${escapeHtml(b.description||"")}</p><small>${b.xp_threshold==null?"Pencapaian khusus":Number(b.xp_threshold)+" XP"} · ${unlocked?"Terbuka":"Belum terbuka"}</small></div></article>`;
    }).join("");
    el.innerHTML=`<div class="section-head"><div><p class="eyebrow">APRESIASI PROSES</p><h1>Pencapaian</h1><p class="muted">Setiap latihan menambah pengalaman dan menjaga konsistensi.</p></div></div><div class="achievement-stats"><article class="panel"><small>Total XP</small><strong>${xp}</strong></article><article class="panel"><small>Streak saat ini</small><strong>${streak} hari</strong></article><article class="panel"><small>Streak terpanjang</small><strong>${longest} hari</strong></article></div><div class="section-head achievement-heading"><div><h2>Badge</h2><p class="muted">Kumpulkan XP untuk membuka pencapaian.</p></div></div><div class="badge-grid">${badgeCards||'<div class="panel empty-state">Badge belum tersedia.</div>'}</div>`;
  }
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
  document.addEventListener("change",e=>{
    if(e.target?.id==="learnScope"){
      const scope=e.target.value;
      $("#learnSurahField").hidden=scope!=="surah";
      $("#learnJuzField").hidden=scope!=="juz";
    }
  });
  document.addEventListener("click",e=>{
    const auth=e.target.closest("[data-auth]");
    if(auth){openAuth(auth.dataset.auth);return;}
    const go=e.target.closest("[data-go]");
    if(go) showPage(go.dataset.go);
  });

    function renderQuranHome(){ $("#quran").innerHTML=quranHomeHTML; if(window.MQ_SURAHS) renderSurahs(filterSurahs($("#surahSearch").value)); }
  async function loadSurahs(){ if(!$("#surahList")) renderQuranHome(); const el=$("#surahList"); if(!el)return; el.innerHTML='<div class="loading">Memuat daftar surah...</div>'; const {data,error}=await client.from("surahs").select("id,name_ar,name_latin,ayah_count,revelation_type").order("id"); if(!$("#surahList"))renderQuranHome(); const list=$("#surahList"); if(!list)return; if(error){list.innerHTML=`<div class="panel loading">Gagal memuat data: ${escapeHtml(error.message)}</div>`;return;} window.MQ_SURAHS=data||[]; renderSurahs(window.MQ_SURAHS); if($("#games")?.classList.contains("active-page") && currentUser) renderGames(); }
  function filterSurahs(q){q=(q||"").trim().toLocaleLowerCase("id");return(window.MQ_SURAHS||[]).filter(s=>s.name_latin.toLocaleLowerCase("id").includes(q)||String(s.id)===q);}
  function renderSurahs(rows){const list=$("#surahList");if(!list)return;$("#surahCount").textContent=`${rows.length} surah`;list.innerHTML=rows.map(s=>`<button class="surah-item" data-surah="${s.id}"><span class="surah-number">${s.id}</span><span class="surah-meta"><b>${escapeHtml(s.name_latin)}</b><small>${s.ayah_count} ayat · ${s.revelation_type==="makkiyah"?"Makkiyah":"Madaniyah"}</small></span><span class="surah-ar" lang="ar" dir="rtl">${escapeHtml(s.name_ar)}</span></button>`).join("");}
  document.addEventListener("input",e=>{if(e.target?.id==="surahSearch")renderSurahs(filterSurahs(e.target.value));});
  document.addEventListener("click",e=>{const b=e.target.closest("[data-surah]");if(b){openSurah(Number(b.dataset.surah));return;}if(e.target.closest("#backSurahs"))renderQuranHome();});
  async function openSurah(id){if(!client)return;const s=(window.MQ_SURAHS||[]).find(x=>x.id===id);if(!s)return;$("#quran").innerHTML=`<button class="secondary-button" id="backSurahs">← Kembali ke daftar surah</button><div class="section-head" style="margin-top:20px"><p class="eyebrow">AL-QUR'AN</p><h1>${escapeHtml(s.name_latin)} <span lang="ar">${escapeHtml(s.name_ar)}</span></h1><p class="muted">${s.ayah_count} ayat · ${escapeHtml(s.revelation_type)}</p></div><div id="ayahContent" class="loading">Memuat ayat...</div>`;const {data,error}=await client.from("ayahs").select("ayah_number,juz_number,text_uthmani").eq("surah_id",id).order("ayah_number");const out=$("#ayahContent");if(!out)return;if(error){out.innerHTML=`<div class="panel loading">Ayat tidak dapat dimuat: ${escapeHtml(error.message)}</div>`;return;}out.innerHTML=(data||[]).map(a=>`<article class="panel" style="margin-bottom:10px"><small class="muted">${escapeHtml(s.name_latin)} · Ayat ${a.ayah_number} · Juz ${a.juz_number}</small><p lang="ar" dir="rtl" style="font-family:serif;font-size:27px;line-height:2.1;text-align:right;margin:12px 0">${escapeHtml(a.text_uthmani)}</p></article>`).join("");}

  // Mesin latihan awal: tiga tipe kuis berbasis ayat yang tersimpan di Supabase.
  let gameState = { questions: [], index: 0, answers: [], surah: null, type: "ayah_gap", busy: false };
  let selectedGameType=null, gameScope="all";
  function renderGames(){
    const el=$("#games");if(!el)return;
    if(!selectedGameType){
      el.innerHTML=`<div class="section-head"><div><p class="eyebrow">BELAJAR DENGAN SERU</p><h1>Permainan Hafalan</h1><p class="muted">Pilih tujuan latihanmu.</p></div></div><div class="game-type-grid"><button class="game-type-card learning-mode-card" data-learning-mode="read"><span class="game-type-icon">📖</span><strong>Belajar Hafalan</strong><small>Baca, dengarkan, dan pelajari ayat secara bertahap.</small></button><button class="game-type-card" data-learning-mode="test"><span class="game-type-icon">🧠</span><strong>Uji Hafalan</strong><small>Uji ingatan dengan tantangan ayat.</small></button></div>`;
      return;
    }
    if(selectedGameType==="learn_read"){
      renderLearningSetup(el);
      return;
    }
    if(selectedGameType==="test_menu"){
      el.innerHTML=`<div class="section-head"><div><button type="button" class="game-back" id="backToGames">← Kembali</button><p class="eyebrow">UJI HAFALAN</p><h1>Pilih tantangan</h1><p class="muted">Pilih mekanisme uji hafalan yang ingin dimainkan.</p></div></div><div class="game-type-grid"><button class="game-type-card" data-game-type="ayah_gap"><span class="game-type-icon">▤</span><strong>Ayat Rumpang</strong><small>Lengkapi kata yang hilang.</small></button><button class="game-type-card" data-game-type="guess_surah"><span class="game-type-icon">۞</span><strong>Tebak Surah</strong><small>Kenali nama surah dari ayat.</small></button><button class="game-type-card" data-game-type="guess_juz"><span class="game-type-icon">30</span><strong>Tebak Juz</strong><small>Tentukan juz tempat ayat berada.</small></button></div>`;
      return;
    }
    const titles={ayah_gap:"Ayat Rumpang",guess_surah:"Tebak Surah",guess_juz:"Tebak Juz"},surahs=window.MQ_SURAHS||[];
    const scoped=selectedGameType==="ayah_gap";
    el.innerHTML=`<div class="section-head"><div><button type="button" class="game-back" id="backToGames">← Semua permainan</button><p class="eyebrow">MODE PERMAINAN</p><h1>${titles[selectedGameType]}</h1><p class="muted">${scoped?"Atur cakupan ayat yang ingin dilatih.":"Soal diambil acak dari seluruh Al-Qur'an tanpa petunjuk cakupan."}</p></div></div><div class="panel game-setup game-setup-detail">${scoped?`<label>Cakupan latihan<select id="gameScope"><option value="all" ${gameScope==="all"?"selected":""}>Seluruh Al-Qur'an</option><option value="surah" ${gameScope==="surah"?"selected":""}>Pilih Surah</option><option value="juz" ${gameScope==="juz"?"selected":""}>Pilih Juz</option></select></label><label id="gameSurahField" ${gameScope!=="surah"?"hidden":""}>Pilih surah<select id="gameSurah">${surahs.map(s=>`<option value="${s.id}">${s.id}. ${escapeHtml(s.name_latin)}</option>`).join("")}</select></label><label id="gameJuzField" ${gameScope!=="juz"?"hidden":""}>Pilih juz<select id="gameJuz">${Array.from({length:30},(_,i)=>`<option value="${i+1}">Juz ${i+1}</option>`).join("")}</select></label>`:`<p class="game-note">5 soal acak dari seluruh Al-Qur'an. Tebak nama surah atau nomor juz berdasarkan rangkaian ayat.</p>`}<button class="primary-button" id="startGame" ${!currentUser?"disabled":""}>Mulai permainan →</button><p class="muted game-note">Satu sesi hingga 5 soal.</p></div><div id="gameStage"></div>`;
    if(scoped&&!surahs.length&&client)loadSurahs();
  }
  let learningState={rows:[],index:0,learned:new Set(),scope:"all",batchSize:5,audioUrl:null};
  function renderLearningSetup(el){
    const surahs=window.MQ_SURAHS||[];
    el.innerHTML=`<div class="section-head"><div><button type="button" class="game-back" id="backToGames">← Kembali</button><p class="eyebrow">BELAJAR HAFALAN</p><h1>Baca dan Dengarkan</h1><p class="muted">Baca beberapa ayat sekaligus, dengarkan murottal, lalu tandai yang sudah dipelajari.</p></div></div><div class="panel game-setup"><label>Materi<select id="learnScope"><option value="all">Seluruh Al-Qur'an</option><option value="surah">Pilih Surah</option><option value="juz">Pilih Juz</option></select></label><label id="learnSurahField" hidden>Pilih surah<select id="learnSurah">${surahs.map(s=>`<option value="${s.id}">${s.id}. ${escapeHtml(s.name_latin)}</option>`).join("")}</select></label><label id="learnJuzField" hidden>Pilih juz<select id="learnJuz">${Array.from({length:30},(_,i)=>`<option value="${i+1}">Juz ${i+1}</option>`).join("")}</select></label><label>Jumlah ayat per tampilan<select id="learnBatchSize"><option value="5" selected>5 ayat</option><option value="10">10 ayat</option></select></label><button class="primary-button" id="startLearning">Mulai belajar →</button><p class="muted game-note">Materi mengikuti nomor juz pada setiap ayat.</p></div><div id="learningStage"></div>`;
    if(!surahs.length&&client)loadSurahs();
  }
  async function startLearning(){
    const scope=$("#learnScope")?.value||"all",surahId=Number($("#learnSurah")?.value),juz=Number($("#learnJuz")?.value),batchSize=Number($("#learnBatchSize")?.value)||5,stage=$("#learningStage");
    if(!stage)return;
    stage.innerHTML='<div class="panel loading">Memuat materi ayat...</div>';
    let rows=[],from=0,step=500,done=false;
    while(!done){
      let query=client.from("ayahs").select("surah_id,ayah_number,juz_number,text_uthmani,text_simple").eq("verified",true).order("surah_id").order("ayah_number").range(from,from+step-1);
      if(scope==="surah")query=query.eq("surah_id",surahId);
      if(scope==="juz")query=query.eq("juz_number",juz);
      const {data,error}=await query;
      if(error){stage.innerHTML=`<div class="panel loading">Gagal memuat ayat: ${escapeHtml(error.message)}</div>`;return;}
      rows=rows.concat(data||[]);
      done=!data||data.length<step;
      from+=step;
    }
    if(!rows.length){stage.innerHTML='<div class="panel loading">Materi ayat tidak ditemukan.</div>';return;}
    const names=new Map((window.MQ_SURAHS||[]).map(s=>[Number(s.id),s.name_latin]));
    learningState={rows,index:0,learned:new Set(),scope,batchSize,audioUrl:null,names};
    renderLearningAyah();
  }
  function renderLearningAyah(){
    const stage=$("#learningStage");if(!stage)return;
    const {rows,index,batchSize,learned}=learningState,total=rows.length,visible=rows.slice(index,Math.min(index+batchSize,total));
    if(!visible.length)return;
    const first=visible[0],last=visible[visible.length-1],done=learned.size;
    const verses=visible.map(a=>{
      const name=learningState.names?.get(Number(a.surah_id))||("Surah "+a.surah_id);
      const key=Number(a.surah_id)+":"+Number(a.ayah_number);
      return `<span class="learning-page-ayah" lang="ar" dir="rtl">${escapeHtml(a.text_uthmani)} <span class="learning-ayah-number">${a.ayah_number}</span></span>`;
    }).join(" ");
    stage.innerHTML=`<article class="panel learning-ayah-card"><div class="learning-topline"><span>${learningState.names?.get(Number(first.surah_id))||("Surah "+first.surah_id)} · Ayat ${first.ayah_number}–${last.ayah_number}</span><span>${done} / ${total} dipelajari</span></div><div class="game-progress-track"><i style="width:${Math.round((index+visible.length)/total*100)}%"></i></div><section class="learning-quran-page" aria-label="Halaman bacaan Al-Qur'an"><div class="learning-page-heading"><span>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</span><small>${first.surah_id} · ${first.juz_number}</small></div><div class="learning-page-text">${verses}</div><div class="learning-page-footer"><span>${first.ayah_number} – ${last.ayah_number}</span><span>مُرَاجَعَة</span></div></section><section class="learning-page-audio"><div><strong>Audio halaman ini</strong><p id="audioStatus" class="muted">Murottal Mishary Alafasy · ${visible.length} ayat</p></div><button class="primary-button" id="playLearningPageAudio">▶ Putar audio</button><audio id="learningAudio" controls preload="none" hidden></audio></section><div class="learning-actions"><button class="secondary-button" id="prevLearning" ${index===0?"disabled":""}>← Sebelumnya</button><button class="primary-button" id="markLearned">Tandai ${visible.length} ayat dipelajari</button><button class="secondary-button" id="nextLearning" ${index+visible.length>=total?"disabled":""}>Berikutnya →</button></div></article>`;
  }
  async function playLearningPageAudio(){
    const status=$("#audioStatus"),audio=$("#learningAudio"),button=$("#playLearningPageAudio");
    if(!status||!audio||!button)return;
    const visible=learningState.rows.slice(learningState.index,learningState.index+learningState.batchSize);
    button.disabled=true;status.textContent="Menyiapkan audio satu halaman...";
    try{
      const urls=[];
      for(const ayah of visible){
        const response=await fetch(`https://quranapi.pages.dev/api/audio/${ayah.surah_id}/${ayah.ayah_number}.json`);
        if(!response.ok)throw new Error("Audio ayat tidak tersedia.");
        const data=await response.json(),url=data["1"]?.url;
        if(!url)throw new Error("Audio ayat tidak tersedia.");
        urls.push(url);
      }
      let current=0;
      audio.hidden=false;
      audio.onended=async()=>{
        current++;
        if(current<urls.length){
          audio.src=urls[current];audio.load();
          try{await audio.play();status.textContent=`Memutar ayat ${visible[current].ayah_number} dari ${visible.length}...`;}
          catch(error){status.textContent="Lanjutkan audio dengan tombol putar.";}
        }else{
          status.textContent="Audio halaman selesai diputar.";
          button.disabled=false;button.textContent="↻ Putar ulang";
          audio.onended=null;
        }
      };
      audio.src=urls[0];audio.load();await audio.play();
      status.textContent=`Memutar ${visible.length} ayat secara berurutan...`;
      button.textContent="Memutar...";
    }catch(error){
      status.textContent="Audio tidak dapat dimuat. Periksa koneksi lalu coba lagi.";
      console.error(error);button.disabled=false;
    }
  }
  async function startGame(){
    if(!currentUser){openAuth("login");return;}
    const type=selectedGameType,scope=type==="ayah_gap"?($("#gameScope")?.value||"all"):"all",surahId=Number($("#gameSurah")?.value),juz=Number($("#gameJuz")?.value),stage=$("#gameStage");
    if(!stage)return;stage.innerHTML='<div class="panel loading">Menyiapkan soal...</div>';
    let query=client.from("ayahs").select("surah_id,ayah_number,juz_number,text_uthmani").eq("verified",true).order("surah_id").order("ayah_number");
    if(scope==="surah")query=query.eq("surah_id",surahId);if(scope==="juz")query=query.eq("juz_number",juz);
    const {data,error}=await query;
    if(error){stage.innerHTML=`<div class="panel loading">${escapeHtml(error.message)}</div>`;return;}
    if(!data||data.length<2){stage.innerHTML='<div class="panel loading">Data ayat belum cukup.</div>';return;}
    const questions=makeQuestions(data,type);if(!questions.length){stage.innerHTML='<div class="panel loading">Tidak ada soal yang sesuai.</div>';return;}
    gameState={questions,index:0,answers:[],surah:scope==="surah"?surahId:null,juz:scope==="juz"?juz:null,scope,type,busy:false};renderGameQuestion();
  }
  function makeQuestions(rows,type){
    const ordered=rows.filter(r=>r.text_uthmani&&r.text_uthmani.trim()).slice().sort((x,y)=>Number(x.surah_id)-Number(y.surah_id)||Number(x.ayah_number)-Number(y.ayah_number));
    const surahMap=new Map((window.MQ_SURAHS||[]).map(s=>[Number(s.id),s]));
    if(type==="ayah_gap"){
      const groups=[];
      for(const ayah of ordered){
        let group=groups[groups.length-1];
        if(!group||Number(group[0].surah_id)!==Number(ayah.surah_id)||Number(group[group.length-1].ayah_number)+1!==Number(ayah.ayah_number)){
          group=[];groups.push(group);
        }
        group.push(ayah);
      }
      const possible=groups.filter(g=>g.length>=4);
      for(let i=possible.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[possible[i],possible[j]]=[possible[j],possible[i]];}
      const sequencePool=[];
      for(const group of groups){
        for(let len=1;len<=3;len++)for(let i=0;i+len<=group.length;i++){
          sequencePool.push(group.slice(i,i+len));
        }
      }
      const questions=[];
      for(const group of possible){
        if(questions.length>=5)break;
        const blankLength=1+Math.floor(Math.random()*3);
        const actualLength=Math.min(blankLength,group.length-2);
        if(actualLength<1)continue;
        const blankStart=1+Math.floor(Math.random()*(group.length-actualLength-1));
        const blankEnd=blankStart+actualLength;
        const pageStart=Math.max(0,blankStart-(2+Math.floor(Math.random()*2)));
        const pageEnd=Math.min(group.length,Math.max(blankEnd+2,pageStart+10));
        const page=group.slice(pageStart,pageEnd);
        if(page.length<4)continue;
        const missing=group.slice(blankStart,blankEnd);
        const correct=missing.map(a=>a.text_uthmani).join(" ");
        const distractors=[];
        const candidates=sequencePool.filter(seq=>seq.length===actualLength&&seq.map(a=>a.text_uthmani).join(" ")!==correct);
        for(let i=candidates.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
        for(const seq of candidates){
          const value=seq.map(a=>a.text_uthmani).join(" ");
          if(!distractors.includes(value))distractors.push(value);
          if(distractors.length===3)break;
        }
        if(distractors.length<3)continue;
        const choices=[correct,...distractors];
        for(let i=choices.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[choices[i],choices[j]]=[choices[j],choices[i]];}
        const pageAyahs=page.map((a,index)=>({
          number:Number(a.ayah_number),
          text:a.text_uthmani,
          hidden:index+pageStart>=blankStart&&index+pageStart<blankEnd
        }));
        const surahName=surahMap.get(Number(group[0].surah_id))?.name_latin||("Surah "+group[0].surah_id);
        questions.push({
          ayah:missing[0],correct,choices,prompt:"Baca satu halaman ini. Ingat urutan ayat, lalu pilih rangkaian ayat yang hilang.",
          pageAyahs,blankStartNumber:Number(missing[0].ayah_number),
          blankEndNumber:Number(missing[missing.length-1].ayah_number),
          blankLength,surahName,kind:type
        });
      }
      return questions;
    }
    const groups=[];
    for(const ayah of ordered){
      const sameGroup=groups[groups.length-1];
      const sameKey=sameGroup&&Number(sameGroup[0].surah_id)===Number(ayah.surah_id)&&
        (type!=="guess_juz"||Number(sameGroup[0].juz_number)===Number(ayah.juz_number))&&
        Number(sameGroup[sameGroup.length-1].ayah_number)+1===Number(ayah.ayah_number);
      if(!sameKey)groups.push([ayah]);else sameGroup.push(ayah);
    }
    const eligible=groups.filter(g=>g.length>=2);
    for(let i=eligible.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[eligible[i],eligible[j]]=[eligible[j],eligible[i]];}
    const questions=[];
    for(const group of eligible){
      if(questions.length>=5)break;
      const length=Math.min(group.length,2+(Math.random()<0.35?1:0));
      const offset=Math.floor(Math.random()*(group.length-length+1));
      const sample=group.slice(offset,offset+length);
      const first=sample[0];
      let correct,choices,prompt;
      if(type==="guess_surah"){
        const actual=surahMap.get(Number(first.surah_id));
        if(!actual)continue;
        correct=actual.name_latin;
        const distractors=[...surahMap.values()]
          .filter(x=>Number(x.id)!==Number(first.surah_id))
          .sort(()=>Math.random()-0.5)
          .slice(0,3).map(x=>x.name_latin);
        choices=[correct,...distractors];
        prompt="Baca rangkaian ayat berikut. Dari surah manakah ayat-ayat ini berasal?";
      }else{
        correct=String(first.juz_number);
        if(!correct||correct==="null"||correct==="undefined")continue;
        const distractors=Array.from({length:30},(_,i)=>String(i+1))
          .filter(x=>x!==correct).sort(()=>Math.random()-0.5).slice(0,3);
        choices=[correct,...distractors];
        prompt="Rangkaian ayat ini berada di juz berapa?";
      }
      for(let i=choices.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[choices[i],choices[j]]=[choices[j],choices[i]];}
      const display=sample.map(a=>a.text_uthmani+" ﴿"+a.ayah_number+"﴾").join(" ");
      questions.push({ayah:first,correct,choices,prompt,kind:type,display});
    }
    return questions;
  }
  function renderGameQuestion(){
    const stage=$("#gameStage"),q=gameState.questions[gameState.index];if(!stage||!q)return;
    const total=gameState.questions.length;
    const label=gameState.type==="ayah_gap"?"AYAT RUMPANG":gameState.type==="guess_surah"?"TEBAK SURAH":"TEBAK JUZ";
    const questionBody=gameState.type==="ayah_gap"
      ? `<div class="gap-page-wrap"><div class="gap-page-meta"><strong>${escapeHtml(q.surahName)}</strong><span>Ayat ${q.pageAyahs[0].number}–${q.pageAyahs[q.pageAyahs.length-1].number}</span></div><div class="gap-quran-page" lang="ar" dir="rtl">${q.pageAyahs.map(a=>a.hidden?`<span class="gap-page-empty" aria-hidden="true"></span>`:`<span class="gap-page-verse">${escapeHtml(a.text)} <span class="gap-page-verse-number">﴿${a.number}﴾</span></span>`).join(" ")}</div></div>`
      : `<p class="game-arabic" lang="ar" dir="rtl">${escapeHtml(q.display)}</p>`;
    const choices=gameState.type==="ayah_gap"
      ? q.choices.map((v,i)=>`<button class="game-option game-option-text" data-answer="${i}"><span class="game-option-letter">${String.fromCharCode(65+i)}</span><span class="game-option-content" lang="ar" dir="rtl">${escapeHtml(v)}</span></button>`).join("")
      : q.choices.map((v,i)=>`<button class="game-option ${gameState.type==="guess_surah"||gameState.type==="guess_juz"?"game-option-text":""}" data-answer="${i}"><span class="game-option-letter">${String.fromCharCode(65+i)}</span><span class="game-option-content">${escapeHtml(v)}</span></button>`).join("");
    stage.innerHTML=`<article class="panel game-question ${gameState.type==="ayah_gap"?"gap-quiz":""}"><div class="game-progress"><span>Soal ${gameState.index+1} dari ${total}</span><span>${Math.round(gameState.index/total*100)}%</span></div><div class="game-progress-track"><i style="width:${gameState.index/total*100}%"></i></div><p class="eyebrow">${label}</p>${questionBody}<p class="muted game-question-prompt">${escapeHtml(q.prompt)}</p><div class="game-options">${choices}</div></article>`;
  }
  async function chooseGameAnswer(index){
    if(gameState.busy)return; gameState.busy=true;
    const q=gameState.questions[gameState.index], chosen=q.choices[index], correct=chosen===q.correct;
    gameState.answers.push({q,chosen,correct});
    const stage=$("#gameStage");
    stage.querySelectorAll(".game-option").forEach((b,i)=>{b.disabled=true;if(q.choices[i]===q.correct)b.classList.add("correct");else if(i===index)b.classList.add("wrong");});
    const next=document.createElement("button");next.className="primary-button game-next";next.textContent=gameState.index===gameState.questions.length-1?"Lihat hasil":"Soal berikutnya";
    stage.querySelector(".game-question").append(next);
    next.addEventListener("click",async()=>{
      gameState.index++;gameState.busy=false;
      if(gameState.index<gameState.questions.length)renderGameQuestion();else await finishGame();
    },{once:true});
  }
  async function finishGame(){
    const stage=$("#gameStage"),answers=gameState.answers,total=answers.length,correct=answers.filter(a=>a.correct).length;
    const score=Math.round(correct/total*100),xp=correct*10;
    stage.innerHTML='<div class="panel loading">Menyimpan hasil latihan...</div>';
    const first=answers[0]?.q.ayah;
    const {data:session,error:sessionError}=await client.from("review_sessions").insert({
      user_id:currentUser.id,surah_id:gameState.surah,juz_number:gameState.juz,scope_type:gameState.scope,start_ayah:Math.min(...answers.map(a=>a.q.ayah.ayah_number)),
      end_ayah:Math.max(...answers.map(a=>a.q.ayah.ayah_number)),mode:"game",scope_type:"surah",
      question_type:gameState.type,total_questions:total,correct_answers:correct,score,started_at:new Date().toISOString(),completed_at:new Date().toISOString(),duration_seconds:0
    }).select("id").single();
    if(sessionError){stage.innerHTML=`<div class="panel loading">Hasil belum tersimpan: ${escapeHtml(sessionError.message)}. Skor latihanmu ${score}%.</div>`;return;}
    const resultRows=answers.map(a=>({session_id:session.id,surah_id:a.q.ayah.surah_id,ayah_number:a.q.ayah.ayah_number,result:a.correct?"fluent":"mistake",question_type:gameState.type,selected_answer:a.chosen,is_correct:a.correct,answered_at:new Date().toISOString()}));
    const {error:resultError}=await client.from("ayah_review_results").insert(resultRows);
    const attempts=answers.map(a=>({user_id:currentUser.id,game_type:gameState.type,surah_id:a.q.ayah.surah_id,question_ref:String(a.q.ayah.surah_id)+":"+String(a.q.ayah.ayah_number),correct:a.correct,elapsed_seconds:0,xp_earned:a.correct?10:0}));
    const {error:attemptError}=await client.from("game_attempts").insert(attempts);
    const {data:reward}=await client.from("user_rewards").select("total_xp,current_streak,longest_streak,last_activity_date").eq("user_id",currentUser.id).maybeSingle();
    const today=new Date().toISOString().slice(0,10);
    const {error:rewardError}=await client.from("user_rewards").upsert({user_id:currentUser.id,total_xp:Number(reward?.total_xp||0)+xp,current_streak:reward?.last_activity_date===today?Number(reward.current_streak||1):Number(reward?.current_streak||0)+1,longest_streak:Math.max(Number(reward?.longest_streak||0),Number(reward?.current_streak||0)+1),last_activity_date:today,updated_at:new Date().toISOString()});
    const warning=resultError||attemptError||rewardError;
    if(!rewardError){
      const newTotal=Number(reward?.total_xp||0)+xp;
      const {data:eligibleBadges}=await client.from("badges").select("id").not("xp_threshold","is",null).lte("xp_threshold",newTotal);
      if(eligibleBadges?.length){
        await client.from("user_badges").upsert(eligibleBadges.map(b=>({user_id:currentUser.id,badge_id:b.id})),{onConflict:"user_id,badge_id",ignoreDuplicates:true});
      }
      loadRewardSummary();
    }
    stage.innerHTML=`<div class="panel game-result"><div class="result-medal">${score>=80?"🏆":"🌱"}</div><p class="eyebrow">SESI SELESAI</p><h2>${score}%</h2><p class="muted">${correct} dari ${total} jawaban benar</p><div class="result-xp">+${xp} XP</div>${warning?'<p class="muted">Sebagian detail hasil belum tersimpan. Skor sesi utama sudah tersimpan.</p>':'<p class="muted">Hasil latihan dan XP telah disimpan.</p>'}<button class="primary-button" id="playAgain">Latihan lagi</button></div>`;
    $("#playAgain").addEventListener("click",renderGames);
  }


  document.addEventListener("click",e=>{
    const mode=e.target.closest("[data-learning-mode]");
    if(mode){selectedGameType=mode.dataset.learningMode==="read"?"learn_read":"test_menu";gameScope="all";renderGames();return;}
    const card=e.target.closest("[data-game-type]");
    if(card){selectedGameType=card.dataset.gameType;gameScope=selectedGameType==="guess_surah"?"juz":"all";renderGames();return;}
    if(e.target.closest("#backToGames")){selectedGameType=null;renderGames();return;}
    if(e.target.closest("#learnScope")){const scope=$("#learnScope").value;$("#learnSurahField").hidden=scope!=="surah";$("#learnJuzField").hidden=scope!=="juz";return;}
    if(e.target.closest("#startLearning")){startLearning();return;}
    if(e.target.closest("#playLearningPageAudio")){playLearningPageAudio();return;}
    if(e.target.closest("#markLearned")){
      learningState.rows.slice(learningState.index,learningState.index+learningState.batchSize).forEach(a=>learningState.learned.add(Number(a.surah_id)+":"+Number(a.ayah_number)));
      renderLearningAyah();return;
    }
    if(e.target.closest("#prevLearning")){if(learningState.index>0){learningState.index=Math.max(0,learningState.index-learningState.batchSize);renderLearningAyah();}return;}
    if(e.target.closest("#nextLearning")){if(learningState.index+learningState.batchSize<learningState.rows.length){learningState.index+=learningState.batchSize;renderLearningAyah();}return;}
    if(e.target.closest("#gameScope")){gameScope=$("#gameScope").value;$("#gameSurahField").hidden=gameScope!=="surah";$("#gameJuzField").hidden=gameScope!=="juz";return;}if(e.target.closest("#startGame")){startGame();return;}
    const answer=e.target.closest(".game-option[data-answer]");
    if(answer)chooseGameAnswer(Number(answer.dataset.answer));
  });
  function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
})();