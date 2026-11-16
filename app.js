// Prototype data: hanya surah/ayat contoh yang disertakan.
// Untuk produksi, ganti dengan dataset Al-Qur'an tepercaya dan lakukan verifikasi mushaf.
const surahs = [
  {number:1,name:"Al-Fatihah",arabic:"الفاتحة",meaning:"Pembukaan",verses:[
    "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
    "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ",
    "الرَّحْمَٰنِ الرَّحِيمِ",
    "مَالِكِ يَوْمِ الدِّينِ",
    "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ",
    "اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ",
    "صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ"
  ]},
  {number:2,name:"Al-Baqarah",arabic:"البقرة",meaning:"Sapi Betina",verses:[
    "الم",
    "ذَٰلِكَ الْكِتَابُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًى لِّلْمُتَّقِينَ",
    "الَّذِينَ يُؤْمِنُونَ بِالْغَيْبِ وَيُقِيمُونَ الصَّلَاةَ وَمِمَّا رَزَقْنَاهُمْ يُنفِقُونَ",
    "وَالَّذِينَ يُؤْمِنُونَ بِمَا أُنزِلَ إِلَيْكَ وَمَا أُنزِلَ مِن قَبْلِكَ وَبِالْآخِرَةِ هُمْ يُوقِنُونَ",
    "أُولَٰئِكَ عَلَىٰ هُدًى مِّن رَّبِّهِمْ ۖ وَأُولَٰئِكَ هُمُ الْمُفْلِحُونَ"
  ]}
];

const $ = (id) => document.getElementById(id);
let activeSurah = 0;
let fontSize = Number(localStorage.getItem("quranFontSize") || 32);
let bookmarks = JSON.parse(localStorage.getItem("quranBookmarks") || "[]");

function renderSurahList(filter="") {
  const list = $("surahList");
  list.innerHTML = "";
  surahs.filter(s => `${s.name} ${s.number}`.toLowerCase().includes(filter.toLowerCase())).forEach((s) => {
    const index = surahs.indexOf(s);
    const button = document.createElement("button");
    button.className = `surah-item ${index === activeSurah ? "active" : ""}`;
    button.innerHTML = `<span class="surah-number">${String(s.number).padStart(2,"0")}</span><span class="surah-name">${s.name}</span><span class="surah-arabic" lang="ar">${s.arabic}</span>`;
    button.addEventListener("click", () => selectSurah(index));
    list.appendChild(button);
  });
  if (!list.children.length) list.innerHTML = '<p class="muted">Surah tidak ditemukan pada data prototype.</p>';
}

function renderReader() {
  const s = surahs[activeSurah];
  $("surahTitle").textContent = s.name;
  $("surahMeta").textContent = `${s.meaning} · ${s.verses.length} ayat dalam data contoh`;
  $("bismillah").hidden = s.number === 1; // Al-Fatihah sudah dimulai dengan basmalah pada ayat pertama.
  $("ayahContainer").innerHTML = "";
  s.verses.forEach((verse, i) => {
    const key = `${s.number}:${i+1}`;
    const article = document.createElement("section");
    article.className = "ayah";
    const text = document.createElement("div");
    text.className = "ayah-text";
    text.lang = "ar";
    text.dir = "rtl";
    text.textContent = verse;
    const tools = document.createElement("div");
    tools.className = "ayah-tools";
    const number = document.createElement("span");
    number.textContent = `Ayat ${i+1}`;
    number.style.cssText = "font-size:10px;color:#9aa49d;padding:5px 3px";
    const save = document.createElement("button");
    const isSaved = bookmarks.includes(key);
    save.className = isSaved ? "saved" : "";
    save.textContent = isSaved ? "★ Tersimpan" : "☆ Tandai";
    save.addEventListener("click", () => toggleBookmark(key));
    tools.append(number, save);
    article.append(text, tools);
    $("ayahContainer").appendChild(article);
  });
  $("bookmarkSurahBtn").textContent = bookmarks.includes(`${s.number}:surah`) ? "★" : "☆";
  const last = JSON.parse(localStorage.getItem("quranLastRead") || "null");
  $("lastReadTitle").textContent = last ? last.name : s.name;
  $("lastReadMeta").textContent = last ? `Surah ${last.number} · Ayat ${last.ayah}` : `Surah ${s.number} · Ayat 1`;
  renderSurahList($("searchInput").value);
  document.documentElement.style.setProperty("--ayah-size", `${fontSize}px`);
}

function selectSurah(index) {
  activeSurah = Math.max(0, Math.min(index, surahs.length - 1));
  localStorage.setItem("quranLastRead", JSON.stringify({number:surahs[activeSurah].number,name:surahs[activeSurah].name,ayah:1}));
  renderReader();
  $("reader").scrollIntoView({behavior:"smooth",block:"start"});
}
function toggleBookmark(key) {
  bookmarks = bookmarks.includes(key) ? bookmarks.filter(x => x !== key) : [...bookmarks,key];
  localStorage.setItem("quranBookmarks", JSON.stringify(bookmarks));
  renderReader();
}
$("searchInput").addEventListener("input", e => renderSurahList(e.target.value));
$("prevSurahBtn").addEventListener("click", () => selectSurah(activeSurah - 1));
$("nextSurahBtn").addEventListener("click", () => selectSurah(activeSurah + 1));
$("continueBtn").addEventListener("click", () => $("reader").scrollIntoView({behavior:"smooth"}));
$("bookmarkSurahBtn").addEventListener("click", () => toggleBookmark(`${surahs[activeSurah].number}:surah`));
$("settingsBtn").addEventListener("click", () => $("settingsBackdrop").hidden = false);
$("closeSettings").addEventListener("click", () => $("settingsBackdrop").hidden = true);
$("settingsBackdrop").addEventListener("click", e => { if(e.target === $("settingsBackdrop")) $("settingsBackdrop").hidden = true; });
$("fontSize").value = fontSize;
$("fontSizeValue").textContent = `${fontSize} px`;
$("fontSize").addEventListener("input", e => {
  fontSize = Number(e.target.value);
  $("fontSizeValue").textContent = `${fontSize} px`;
  document.documentElement.style.setProperty("--ayah-size", `${fontSize}px`);
  localStorage.setItem("quranFontSize", fontSize);
});
renderReader();
