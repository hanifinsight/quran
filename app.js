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
      el.innerHTML=`<div class="section-head"><div><p class="eyebrow">BELAJAR DENGAN SERU</p><h1>Permainan Hafalan</h1><p class="muted">Pilih permainan untuk memulai tantangan.</p></div></div><div class="game-type-grid"><button class="game-type-card" data-game-type="ayah_gap"><span class="game-type-icon">▤</span><strong>Ayat Rumpang</strong><small>Lengkapi kata yang hilang.</small></button><button class="game-type-card" data-game-type="guess_surah"><span class="game-type-icon">۞</span><strong>Tebak Surah</strong><small>Kenali nama surah dari ayat.</small></button><button class="game-type-card" data-game-type="guess_juz"><span class="game-type-icon">30</span><strong>Tebak Juz</strong><small>Tentukan juz tempat ayat berada.</small></button></div>`;return;
    }
    const titles={ayah_gap:"Ayat Rumpang",guess_surah:"Tebak Surah",guess_juz:"Tebak Juz"},surahs=window.MQ_SURAHS||[];
    el.innerHTML=`<div class="section-head"><div><button type="button" class="game-back" id="backToGames">← Semua permainan</button><p class="eyebrow">MODE PERMAINAN</p><h1>${titles[selectedGameType]}</h1><p class="muted">Cakupan latihan opsional. Kamu bisa langsung mulai dari seluruh Al-Qur'an.</p></div></div><div class="panel game-setup game-setup-detail"><label>Cakupan latihan<select id="gameScope"><option value="all" ${gameScope==="all"?"selected":""}>Seluruh Al-Qur'an</option><option value="surah" ${gameScope==="surah"?"selected":""}>Pilih Surah</option><option value="juz" ${gameScope==="juz"?"selected":""}>Pilih Juz</option></select></label><label id="gameSurahField" ${gameScope!=="surah"?"hidden":""}>Pilih surah<select id="gameSurah">${surahs.map(s=>`<option value="${s.id}">${s.id}. ${escapeHtml(s.name_latin)}</option>`).join("")}</select></label><label id="gameJuzField" ${gameScope!=="juz"?"hidden":""}>Pilih juz<select id="gameJuz">${Array.from({length:30},(_,i)=>`<option value="${i+1}">Juz ${i+1}</option>`).join("")}</select></label><button class="primary-button" id="startGame" ${!currentUser?"disabled":""}>Mulai permainan →</button><p class="muted game-note">Default seluruh Al-Qur'an. Satu sesi hingga 5 soal.</p></div><div id="gameStage"></div>`;
    if(!surahs.length&&client)loadSurahs();
  }
  async function startGame(){
    if(!currentUser){openAuth("login");return;}
    const scope=$("#gameScope")?.value||"all",surahId=Number($("#gameSurah")?.value),juz=Number($("#gameJuz")?.value),type=selectedGameType,stage=$("#gameStage");
    if(!stage)return;stage.innerHTML='<div class="panel loading">Menyiapkan soal...</div>';
    let query=client.from("ayahs").select("surah_id,ayah_number,juz_number,text_uthmani").eq("verified",true).order("surah_id").order("ayah_number").limit(1000);
    if(scope==="surah")query=query.eq("surah_id",surahId);if(scope==="juz")query=query.eq("juz_number",juz);
    const {data,error}=await query;
    if(error){stage.innerHTML=`<div class="panel loading">${escapeHtml(error.message)}</div>`;return;}
    if(!data||data.length<2){stage.innerHTML='<div class="panel loading">Data ayat belum cukup.</div>';return;}
    const questions=makeQuestions(data,type);if(!questions.length){stage.innerHTML='<div class="panel loading">Tidak ada soal yang sesuai.</div>';return;}
    gameState={questions,index:0,answers:[],surah:scope==="surah"?surahId:null,juz:scope==="juz"?juz:null,scope,type,busy:false};renderGameQuestion();
  }
  function makeQuestions(rows,type){
    const pool=rows.filter(r=>r.text_uthmani&&r.text_uthmani.trim());
    for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
    return pool.slice(0,5).map(a=>{
      let correct,choices=[],prompt="",display=a.text_uthmani;
      if(type==="ayah_gap"){
        const words=a.text_uthmani.split(/\\s+/).filter(Boolean);
        if(words.length<3)return null;
        const missingIndex=Math.floor(Math.random()*words.length);
        correct=words[missingIndex];
        const shown=[...words];shown[missingIndex]="ــــــ";
        display=shown.join(" ");
        const distractors=pool.flatMap(r=>r.text_uthmani.split(/\\s+/)).filter(w=>w!==correct);
        choices=[correct];
        for(let i=distractors.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[distractors[i],distractors[j]]=[distractors[j],distractors[i]];}
        distractors.forEach(w=>{if(choices.length<4&&!choices.includes(w))choices.push(w);});
        prompt="Pilih kata yang tepat untuk melengkapi ayat rumpang.";
      } else if(type==="guess_surah"){
        const surahMap=new Map((window.MQ_SURAHS||[]).map(s=>[Number(s.id),s.name_latin]));
        correct=surahMap.get(Number(a.surah_id));
        if(!correct)return null;
        choices=[correct];
        const names=[...surahMap.values()].filter(n=>n!==correct);
        for(let i=names.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[names[i],names[j]]=[names[j],names[i]];}
        choices.push(...names.slice(0,3));
        prompt="Ayat ini berasal dari surah apa?";
      } else {
        correct=String(a.juz_number);
        choices=[correct];
        const nums=Array.from({length:30},(_,i)=>String(i+1)).filter(n=>n!==correct);
        for(let i=nums.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[nums[i],nums[j]]=[nums[j],nums[i]];}
        choices.push(...nums.slice(0,3));
        prompt="Ayat ini berada di juz berapa?";
      }
      for(let i=choices.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[choices[i],choices[j]]=[choices[j],choices[i]];}
      return {ayah:a,correct,choices,kind:type,display,prompt};
    }).filter(q=>q&&q.choices.length>=2);
  }
  function renderGameQuestion(){
    const stage=$("#gameStage"),q=gameState.questions[gameState.index];if(!stage||!q)return;
    const total=gameState.questions.length;
    const label=gameState.type==="ayah_gap"?"AYAT RUMPANG":gameState.type==="guess_surah"?"TEBAK SURAH":"TEBAK JUZ";
    stage.innerHTML=`<article class="panel game-question"><div class="game-progress"><span>Soal ${gameState.index+1} dari ${total}</span><span>${Math.round(gameState.index/total*100)}%</span></div><div class="game-progress-track"><i style="width:${gameState.index/total*100}%"></i></div><p class="eyebrow">${label}</p><p class="game-arabic" lang="ar" dir="rtl">${escapeHtml(q.display)}</p><p class="muted">${escapeHtml(q.prompt)}</p><div class="game-options">${q.choices.map((v,i)=>`<button class="game-option ${gameState.type==="guess_surah"||gameState.type==="guess_juz"?"game-option-text":""}" data-answer="${i}">${escapeHtml(v)}</button>`).join("")}</div></article>`;
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
    stage.innerHTML=`<div class="panel game-result"><div class="result-medal">${score>=80?"🏆":"🌱"}</div><p class="eyebrow">SESI SELESAI</p><h2>${score}%</h2><p class="muted">${correct} dari ${total} jawaban benar</p><div class="result-xp">+${xp} XP</div>${warning?'<p class="muted">Sebagian detail hasil belum tersimpan. Skor sesi utama sudah tersimpan.</p>':'<p class="muted">Hasil latihan dan XP telah disimpan.</p>'}<button class="primary-button" id="playAgain">Latihan lagi</button></div>`;
    $("#playAgain").addEventListener("click",renderGames);
  }


  document.addEventListener("click",e=>{
    const card=e.target.closest("[data-game-type]");
    if(card){selectedGameType=card.dataset.gameType;gameScope="all";renderGames();return;}
    if(e.target.closest("#backToGames")){selectedGameType=null;renderGames();return;}
    if(e.target.closest("#gameScope")){gameScope=$("#gameScope").value;$("#gameSurahField").hidden=gameScope!=="surah";$("#gameJuzField").hidden=gameScope!=="juz";return;}if(e.target.closest("#startGame")){startGame();return;}
    const answer=e.target.closest(".game-option[data-answer]");
    if(answer)chooseGameAnswer(Number(answer.dataset.answer));
  });
  function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
})();