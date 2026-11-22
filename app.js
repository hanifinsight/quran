(() => {
  const cfg = window.MQ_CONFIG || {};
  const client = window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY
    ? window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY) : null;
  const $ = s => document.querySelector(s);
  const state = {user:null,profile:null,page:"dashboard",categories:[],activities:[],report:null,details:[],authMode:"login"};
  const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const dateKey = () => new Date().toLocaleDateString("en-CA");
  const dateLabel = d => new Date(d+"T00:00:00").toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"});
  function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2800);}
  function showAuth(){ $("#authScreen").hidden=false; $("#app").style.display="none"; }
  function hideAuth(){ $("#authScreen").hidden=true; $("#app").style.display="block"; }
  function setPage(p){state.page=p;$("#sidebar").classList.remove("open");document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===p));renderPage();}
  async function loadProfile(){
    const {data,error}=await client.from("profiles").select("id,display_name,role,is_active").eq("id",state.user.id).single();
    if(error) throw error; state.profile=data;
    if(!data.is_active) {await client.auth.signOut();throw new Error("Akun Anda sedang dinonaktifkan admin.");}
    $(".admin-only").hidden=data.role!=="admin";
    $("#logout").hidden=false; $("#topUser").textContent=data.display_name||state.user.email;
  }
  async function loadCatalog(){
    const [c,a]=await Promise.all([
      client.from("amal_categories").select("id,name,sort_order").eq("is_active",true).order("sort_order"),
      client.from("amal_activities").select("id,category_id,name,input_type,unit_label,sort_order").eq("is_active",true).order("sort_order")
    ]);
    if(c.error)throw c.error;if(a.error)throw a.error;state.categories=c.data||[];state.activities=a.data||[];
  }
  async function boot(){
    if(!client){showAuth();toast("Konfigurasi Supabase belum tersedia.");return;}
    const {data:{session}}=await client.auth.getSession();
    if(!session){showAuth();return;}
    state.user=session.user;
    try{await loadProfile();await loadCatalog();hideAuth();setPage("dashboard");}
    catch(e){showAuth();toast(e.message||"Gagal memuat akun.");}
  }
  function shell(title,desc,content,action=""){
    return '<div class="page-head"><div><p class="eyebrow">AMAL YAUMI</p><h1>'+title+'</h1><p class="muted">'+desc+'</p></div>'+action+'</div>'+content;
  }
  async function renderPage(){
    if(!state.user)return;
    const main=$("#main");main.innerHTML='<div class="loading">Memuat...</div>';
    try{
      if(state.page==="dashboard")await renderDashboard();
      if(state.page==="amal")await renderAmal();
      if(state.page==="recap")await renderRecap();
      if(state.page==="kajian")await renderKajian();
      if(state.page==="donasi")renderDonasi();
      if(state.page==="admin")await renderAdmin();
    }catch(e){main.innerHTML='<div class="card notice">Terjadi kendala: '+esc(e.message)+'</div>';console.error(e);}
  }
  async function getTodayReport(){
    const {data,error}=await client.from("daily_reports").select("id,user_id,report_date,status,note,submitted_at").eq("user_id",state.user.id).eq("report_date",dateKey()).maybeSingle();
    if(error)throw error;state.report=data;
    if(data){const r=await client.from("daily_report_details").select("activity_id,is_done,numeric_value,text_value,note").eq("report_id",data.id);if(r.error)throw r.error;state.details=r.data||[];}else state.details=[];
  }
  async function renderDashboard(){
    await getTodayReport();
    const done=state.details.filter(x=>x.is_done===true||(x.numeric_value||0)>0||(x.text_value||"").trim()).length;
    const total=state.activities.length;const pct=total?Math.round(done/total*100):0;
    const {count}=await client.from("daily_reports").select("*",{count:"exact",head:true}).eq("user_id",state.user.id).eq("status","submitted");
    $("#main").innerHTML=shell("Assalamu’alaikum, "+esc(state.profile.display_name||"Sahabat") , "Mari jaga amal hari ini dengan niat yang ikhlas.",'<div class="grid"><div class="card"><div class="stat-label">Pengisian hari ini</div><div class="stat-value">'+pct+'%</div><div class="progress"><span style="width:'+pct+'%"></span></div><div class="stat-foot">'+done+' dari '+total+' aktivitas tercatat</div></div><div class="card"><div class="stat-label">Laporan terkirim</div><div class="stat-value">'+(count||0)+'</div><div class="stat-foot">Total laporan yang sudah disubmit</div></div><div class="card"><div class="stat-label">Tanggal hari ini</div><div class="stat-value" style="font-size:20px">'+dateLabel(dateKey())+'</div><div class="stat-foot">Satu hari, satu catatan amal</div></div></div><div class="card" style="margin-top:18px"><h2 class="section-title">Mulai catat amal harian</h2><p class="muted">Isi aktivitas yang sudah dikerjakan. Laporan dapat disimpan sebagai draft sebelum dikirim.</p><button class="primary" id="goAmal">Isi Amal Yaumi →</button></div><div class="card" style="margin-top:18px"><h2 class="section-title">Pengingat</h2><p class="muted">Amal yang kecil tetapi dilakukan terus-menerus lebih baik daripada amal besar yang terputus.</p></div>');
    $("#goAmal").onclick=()=>setPage("amal");
  }
  async function renderAmal(){
    await getTodayReport();
    const locked=state.report&&state.report.status!=="draft";
    const values=Object.fromEntries(state.details.map(d=>[d.activity_id,d]));
    const groups=state.categories.map(c=>{
      const rows=state.activities.filter(a=>a.category_id===c.id);
      if(!rows.length)return "";
      return '<div class="card" style="margin-bottom:14px"><h2 class="section-title">'+esc(c.name)+'</h2><div class="activity-list">'+rows.map(a=>{
        const v=values[a.id]||{};
        let control=a.input_type==="boolean"?'<input class="check activity-value" type="checkbox" data-id="'+a.id+'" '+(v.is_done?'checked':'')+' '+(locked?'disabled':'')+'>':'<div class="activity-input"><input class="activity-value" data-id="'+a.id+'" type="number" min="0" step="any" value="'+esc(v.numeric_value??"")+'" placeholder="'+esc(a.unit_label||"Jumlah")+'" '+(locked?'disabled':'')+'></div>';
        return '<div class="activity-row"><div><strong>'+esc(a.name)+'</strong><small>'+(a.unit_label?esc(a.unit_label):'Tandai jika sudah dilakukan')+'</small></div>'+control+'</div>';
      }).join("")+'</div></div>';
    }).join("");
    $("#main").innerHTML=shell("Isi Amal Yaumi","Catatan tanggal "+dateLabel(dateKey()),(state.report?'<div class="notice" style="margin-bottom:16px">Status laporan: <b>'+esc(state.report.status)+'</b>. '+(locked?'Laporan telah dikirim dan tidak dapat diubah.':'Anda masih dapat mengubah draft.')+'</div>':'')+groups+'<div class="card"><label>Catatan pribadi (opsional)<textarea id="reportNote" rows="3" '+(locked?'disabled':'')+' placeholder="Catatan atau refleksi hari ini">'+esc(state.report?.note||"")+'</textarea></label><div class="actions">'+(locked?'':'<button class="secondary" id="saveDraft">Simpan Draft</button><button class="primary" id="submitReport">Kirim Laporan</button>')+'</div></div>');
    if(!locked){$("#saveDraft").onclick=()=>saveReport(false);$("#submitReport").onclick=()=>saveReport(true);}
  }
  async function saveReport(submit){
    try{
      let report=state.report;
      const note=$("#reportNote").value;
      if(!report){const ins=await client.from("daily_reports").insert({user_id:state.user.id,report_date:dateKey(),status:"draft",note}).select().single();if(ins.error)throw ins.error;report=ins.data;}
      else {const up=await client.from("daily_reports").update({note}).eq("id",report.id);if(up.error)throw up.error;}
      for(const el of document.querySelectorAll(".activity-value")){
        const a=state.activities.find(x=>x.id===el.dataset.id);const payload={report_id:report.id,activity_id:a.id,is_done:a.input_type==="boolean"?el.checked:null,numeric_value:a.input_type==="boolean"?null:(el.value===""?null:Number(el.value))};
        const result=await client.from("daily_report_details").upsert(payload,{onConflict:"report_id,activity_id"});if(result.error)throw result.error;
      }
      if(submit){const up=await client.from("daily_reports").update({status:"submitted",submitted_at:new Date().toISOString()}).eq("id",report.id);if(up.error)throw up.error;}
      toast(submit?"Laporan berhasil dikirim.":"Draft berhasil disimpan.");await renderAmal();
    }catch(e){toast(e.message||"Gagal menyimpan laporan.");}
  }
  async function renderRecap(){
    const {data,error}=await client.from("daily_reports").select("id,report_date,status,submitted_at").eq("user_id",state.user.id).order("report_date",{ascending:false}).limit(60);
    if(error)throw error;
    $("#main").innerHTML=shell("Rekap Individu","Riwayat pengisian amal harian Anda.",'<div class="card table-wrap">'+((data||[]).length?'<table><thead><tr><th>Tanggal</th><th>Status</th><th>Waktu kirim</th></tr></thead><tbody>'+data.map(r=>'<tr><td>'+dateLabel(r.report_date)+'</td><td><span class="pill '+(r.status==="draft"?"pending":"")+'">'+esc(r.status)+'</span></td><td>'+(r.submitted_at?new Date(r.submitted_at).toLocaleString("id-ID"):"—")+'</td></tr>').join("")+'</tbody></table>':'<div class="empty">Belum ada laporan amal.</div>')+'</div>');
  }
  async function renderKajian(){
    const {data,error}=await client.from("kajian_events").select("id,title,description,starts_at,platform,meeting_url,recording_url,access_level").eq("is_published",true).order("starts_at",{ascending:false}).limit(30);
    if(error)throw error;
    $("#main").innerHTML=shell("Pusat Kajian","Akses kajian online dan rekaman materi.",(data||[]).length?'<div class="grid">'+data.map(k=>'<div class="card"><p class="eyebrow">'+esc(k.platform)+' · '+(k.access_level==="pro"?"KAJIAN PRO":"TERBUKA")+'</p><h2 class="section-title">'+esc(k.title)+'</h2><p class="muted">'+esc(k.description||"")+'</p><p class="stat-foot">'+(k.starts_at?new Date(k.starts_at).toLocaleString("id-ID"):"Jadwal menyusul")+'</p><div class="actions">'+(k.access_level==="pro"?'<span class="pill pending">Khusus Pro</span>':'')+(k.recording_url?'<a class="primary" target="_blank" rel="noopener" href="'+esc(k.recording_url)+'">Tonton rekaman</a>':'')+(k.meeting_url?'<a class="secondary" target="_blank" rel="noopener" href="'+esc(k.meeting_url)+'">Buka kajian</a>':'')+'</div></div>').join("")+'</div>':'<div class="card empty">Belum ada kajian yang dipublikasikan admin.</div>');
  }
  function renderDonasi(){
    $("#main").innerHTML=shell("Donasi & Kajian Pro","Dukung kegiatan dan akses materi kajian khusus.",'<div class="grid"><div class="card"><p class="eyebrow">DONASI</p><h2 class="section-title">Dukung kegiatan dakwah</h2><p class="muted">Donasi akan membantu operasional kajian dan pengembangan program.</p><div class="notice">Integrasi payment gateway belum diaktifkan. Transaksi belum dapat dilakukan dari aplikasi.</div></div><div class="card"><p class="eyebrow">KAJIAN PRO</p><h2 class="section-title">Akses kajian eksklusif</h2><p class="muted">Materi dan sesi khusus anggota berlangganan.</p><div class="notice">Paket dan pembayaran Kajian Pro akan diaktifkan setelah akun payment gateway dan webhook dikonfigurasi.</div></div></div>');
  }
  async function renderAdmin(){
    if(state.profile.role!=="admin"){toast("Akses admin diperlukan.");setPage("dashboard");return;}
    const [users,reports,kajian]=await Promise.all([
      client.from("profiles").select("id,display_name,role,is_active,created_at").order("created_at",{ascending:false}).limit(100),
      client.from("daily_reports").select("id,report_date,status,user_id").order("report_date",{ascending:false}).limit(30),
      client.from("kajian_events").select("id,title,is_published,starts_at").order("created_at",{ascending:false}).limit(10)
    ]);
    if(users.error)throw users.error;if(reports.error)throw reports.error;if(kajian.error)throw kajian.error;
    $("#main").innerHTML=shell("Panel Admin","Kelola anggota, pantau laporan, dan atur kajian.",'<div class="grid"><div class="card"><div class="stat-label">Jumlah anggota</div><div class="stat-value">'+users.data.length+'</div></div><div class="card"><div class="stat-label">Laporan terbaru</div><div class="stat-value">'+reports.data.length+'</div></div><div class="card"><div class="stat-label">Kajian terdaftar</div><div class="stat-value">'+kajian.data.length+'</div></div></div><div class="card" style="margin-top:18px"><h2 class="section-title">Anggota</h2><div class="table-wrap"><table><thead><tr><th>Nama</th><th>Peran</th><th>Status</th></tr></thead><tbody>'+users.data.map(u=>'<tr><td>'+esc(u.display_name)+'</td><td>'+esc(u.role)+'</td><td>'+ (u.is_active?'Aktif':'Nonaktif')+'</td></tr>').join("")+'</tbody></table></div></div><div class="card" style="margin-top:18px"><h2 class="section-title">Kajian</h2><form id="kajianForm" class="form-grid"><label>Judul<input name="title" required></label><label>Platform<select name="platform"><option value="youtube">YouTube</option><option value="zoom">Zoom</option></select></label><label>Waktu mulai<input name="starts_at" type="datetime-local"></label><label>Akses<select name="access_level"><option value="all">Semua anggota</option><option value="pro">Kajian Pro</option></select></label><label>Link pertemuan/siaran<input name="meeting_url" type="url"></label><label>Link rekaman<input name="recording_url" type="url"></label><label class="field" style="grid-column:1/-1">Deskripsi<textarea name="description" rows="2"></textarea></label><label style="display:flex;align-items:center"><input name="is_published" type="checkbox" style="width:auto"> Publikasikan langsung</label><div><button class="primary" type="submit">Simpan Kajian</button></div></form><div class="table-wrap" style="margin-top:18px"><table><thead><tr><th>Judul</th><th>Status</th><th>Aksi</th></tr></thead><tbody>'+kajian.data.map(k=>'<tr><td>'+esc(k.title)+'</td><td>'+(k.is_published?'Terbit':'Draft')+'</td><td><button class="secondary publish-toggle" data-id="'+k.id+'" data-published="'+k.is_published+'">'+(k.is_published?'Tarik':'Terbitkan')+'</button></td></tr>').join("")+'</tbody></table></div></div>');
    $("#kajianForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const payload=Object.fromEntries(f.entries());payload.is_published=f.has("is_published");payload.created_by=state.user.id;payload.starts_at=payload.starts_at?new Date(payload.starts_at).toISOString():null;const r=await client.from("kajian_events").insert(payload);if(r.error){toast(r.error.message);return;}toast("Kajian disimpan.");renderAdmin();};
    document.querySelectorAll(".publish-toggle").forEach(b=>b.onclick=async()=>{const r=await client.from("kajian_events").update({is_published:b.dataset.published!=="true"}).eq("id",b.dataset.id);if(r.error){toast(r.error.message);return;}renderAdmin();});
  }
  $("#nav").addEventListener("click",e=>{const b=e.target.closest("[data-page]");if(b)setPage(b.dataset.page);});
  $("#mobileMenu").onclick=()=>$("#sidebar").classList.toggle("open");
  $("#logout").onclick=async()=>{await client.auth.signOut();state.user=null;showAuth();};
  $("#toggleAuth").onclick=()=>{state.authMode=state.authMode==="login"?"signup":"login";$("#authTitle").textContent=state.authMode==="login"?"Selamat datang":"Buat akun anggota";$("#authDescription").textContent=state.authMode==="login"?"Masuk untuk mencatat amal harian Anda.":"Daftar menggunakan email dan kata sandi.";$("#nameField").hidden=state.authMode==="login";$("#authSubmit").textContent=state.authMode==="login"?"Masuk":"Daftar";$("#toggleAuth").textContent=state.authMode==="login"?"Belum punya akun? Daftar":"Sudah punya akun? Masuk";};
  $("#authForm").onsubmit=async e=>{e.preventDefault();const email=$("#email").value,password=$("#password").value;$("#authSubmit").disabled=true;try{
    if(state.authMode==="signup"){const display_name=$("#displayName").value.trim();const r=await client.auth.signUp({email,password,options:{data:{display_name}}});if(r.error)throw r.error;if(r.data.session){state.user=r.data.user;await loadProfile();await loadCatalog();hideAuth();setPage("dashboard");}else toast("Pendaftaran berhasil. Periksa email untuk verifikasi sebelum masuk.");}
    else{const r=await client.auth.signInWithPassword({email,password});if(r.error)throw r.error;state.user=r.data.user;await loadProfile();await loadCatalog();hideAuth();setPage("dashboard");}
  }catch(err){toast(err.message||"Autentikasi gagal.");}finally{$("#authSubmit").disabled=false;}};
  $("#forgotPassword").onclick=async()=>{const email=$("#email").value.trim();if(!email){toast("Isi email terlebih dahulu.");return;}const r=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});toast(r.error?r.error.message:"Link reset kata sandi dikirim jika email terdaftar.");};
  if(client)client.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_OUT"){state.user=null;showAuth();}});
  boot();
})();