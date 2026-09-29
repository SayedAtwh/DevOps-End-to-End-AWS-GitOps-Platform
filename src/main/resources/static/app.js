document.addEventListener('DOMContentLoaded', async () => {
  const audio = document.getElementById('quranAudioPlayer');
  const ayahContainer = document.getElementById('ayahContainer');
  const surahSelect = document.getElementById('surahSelect');
  const pageJumpForm = document.getElementById('pageJumpForm');
  const pageJumpInput = document.getElementById('pageJumpInput');
  const bookmarkPageBtn = document.getElementById('bookmarkPageBtn');
  const continueReadingBtn = document.getElementById('continueReadingBtn');
  const decreaseFontBtn = document.getElementById('decreaseFontBtn');
  const increaseFontBtn = document.getElementById('increaseFontBtn');
  const currentSurahName = document.getElementById('currentSurahName');
  const currentSurahMeta = document.getElementById('currentSurahMeta');
  const pageCounter = document.getElementById('pageCounter');
  const audioLabel = document.getElementById('audioLabel');
  const playSurahBtn = document.getElementById('playSurahBtn');
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const listenNowBtn = document.getElementById('listenNowBtn');
  const modeButtons = document.querySelectorAll('.mode-btn');
  const reciterSelect = document.getElementById('reciterSelect');
  const audioSpeedSelect = document.getElementById('audioSpeedSelect');
  const ayahActionsDialog = document.getElementById('ayahActionsDialog');
  const selectedAyahTitle = document.getElementById('ayahActionsTitle');
  const selectedAyahText = document.getElementById('selectedAyahText');
  const selectedAyahTafsir = document.getElementById('selectedAyahTafsir');
  const selectedAyahNote = document.getElementById('selectedAyahNote');
  const ayahNoteStatus = document.getElementById('ayahNoteStatus');

  let surahs = [];
  let currentAyahs = [];
  let selectedAyah = null;
  let ayahPlaybackQueue = null;
  let ayahPlaybackIndex = -1;

  let currentSurahIndex = 0;
  let currentPage = 1;
  let mode = 'read';
  let pageRequestId = 0;
  const savedPageKey = 'alhuda-quran-saved-page';
  const fontSizeKey = 'alhuda-quran-font-size';
  const ayahNotesKey = 'alhuda-quran-ayah-notes-v1';
  const ayahBookmarksKey = 'alhuda-quran-ayah-bookmarks-v1';
  const audioSpeedKey = 'alhuda-quran-audio-speed';
  const audioReciterKey = 'alhuda-quran-audio-reciter';
  let quranFontSize = Number(localStorage.getItem(fontSizeKey)) || 1.8;
  let ayahNotes = {};
  let ayahBookmarks = [];

  try {
    ayahNotes = JSON.parse(localStorage.getItem(ayahNotesKey) || '{}');
    if (!ayahNotes || typeof ayahNotes !== 'object' || Array.isArray(ayahNotes)) ayahNotes = {};
  } catch (error) {
    ayahNotes = {};
  }
  try {
    ayahBookmarks = JSON.parse(localStorage.getItem(ayahBookmarksKey) || '[]');
    if (!Array.isArray(ayahBookmarks)) ayahBookmarks = [];
  } catch (error) {
    ayahBookmarks = [];
  }

  const reciters = {
    yasser: { name: 'ياسر الدوسري', server: 'server11.mp3quran.net', folder: 'yasser', edition: 'ar.yasseraldosari', ayahAudio: false },
    mishary: { name: 'مشاري العفاسي', server: 'server8.mp3quran.net', folder: 'afs', edition: 'ar.alafasy', audioQuality: 128, ayahAudio: true },
    sudais: { name: 'عبدالرحمن السديس', server: 'server11.mp3quran.net', folder: 'sds', edition: 'ar.abdurrahmaansudais', audioQuality: 192, ayahAudio: true },
    husary: { name: 'محمود خليل الحصري', server: 'server13.mp3quran.net', folder: 'husr', edition: 'ar.husary', audioQuality: 128, ayahAudio: true }
  };

  const savedReciter = localStorage.getItem(audioReciterKey);
  if (savedReciter && reciters[savedReciter]) reciterSelect.value = savedReciter;
  const savedAudioSpeed = localStorage.getItem(audioSpeedKey);
  if ([...audioSpeedSelect.options].some((option) => option.value === savedAudioSpeed)) {
    audioSpeedSelect.value = savedAudioSpeed;
  }
  audio.playbackRate = Number(audioSpeedSelect.value);

  function applyQuranFontSize() {
    quranFontSize = Math.max(1.4, Math.min(2.6, quranFontSize));
    ayahContainer.style.fontSize = `${quranFontSize}rem`;
    localStorage.setItem(fontSizeKey, String(quranFontSize));
  }

  function updateContinueReadingButton() {
    const savedPage = Number(localStorage.getItem(savedPageKey));
    const hasSavedPage = savedPage >= 1 && savedPage <= 604;
    continueReadingBtn.disabled = !hasSavedPage;
    continueReadingBtn.textContent = hasSavedPage ? `متابعة صفحة ${savedPage}` : 'متابعة المحفوظ';
  }

  function formatAyahText(text) {
    return text.replace(/\s+/g, ' ').trim();
  }

  async function fetchQuranData(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    if (data.code !== 200 || !data.data) {
      throw new Error('Quran data is unavailable');
    }
    return data.data;
  }

  async function fetchSurah(number) {
    const data = await fetchQuranData(`https://api.alquran.cloud/v1/surah/${number}/quran-uthmani`);
    return data.ayahs || [];
  }

  function renderSurahList() {
    surahSelect.innerHTML = '';
    surahs.forEach((surah, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = `${String(surah.number).padStart(3, '0')} - ${surah.name} (${surah.numberOfAyahs} آية)`;
      surahSelect.appendChild(option);
    });
    surahSelect.value = String(currentSurahIndex);
  }

  function updateModeButtons() {
    modeButtons.forEach((btn) => {
      const isActive = btn.dataset.mode === mode;
      btn.classList.toggle('active', isActive);
    });
  }

  function getAudioUrl(surahNumber) {
    const reciter = reciters[reciterSelect.value] || reciters.yasser;
    return `https://${reciter.server}/${reciter.folder}/${String(surahNumber).padStart(3, '0')}.mp3`;
  }

  function updateAudioState() {
    if (!surahs.length) return;
    const surah = surahs[currentSurahIndex];
    const audioUrl = getAudioUrl(surah.number);
    if (audio.src !== audioUrl) {
      audio.src = audioUrl;
      audio.load();
    }
    const reciter = reciters[reciterSelect.value] || reciters.yasser;
    audioLabel.textContent = `${surah.name} كاملة · ${reciter.name}`;
  }

  function renderAyahs(ayahs) {
    currentAyahs = ayahs;
    ayahContainer.innerHTML = '';
    const fragment = document.createDocumentFragment();

    ayahs.forEach((ayah, index) => {
      if (index > 0) fragment.appendChild(document.createTextNode(' '));

      const text = document.createElement('span');
      text.className = 'page-ayah-text';
      text.textContent = formatAyahText(ayah.text);
      fragment.appendChild(text);

      const marker = document.createElement('button');
      marker.type = 'button';
      marker.className = 'page-ayah-marker';
      marker.dataset.ayahIndex = String(index);
      marker.setAttribute('aria-label', `خيارات الآية ${ayah.numberInSurah}`);
      marker.title = `خيارات الآية ${ayah.numberInSurah}`;
      if (ayahBookmarks.includes(ayah.number)) marker.classList.add('bookmarked');
      marker.textContent = new Intl.NumberFormat('ar-EG').format(ayah.numberInSurah);
      fragment.appendChild(marker);
    });

    ayahContainer.appendChild(fragment);
  }

  function openAyahActions(ayah) {
    selectedAyah = ayah;
    selectedAyahTitle.textContent = `${ayah.surah.name} · الآية ${new Intl.NumberFormat('ar-EG').format(ayah.numberInSurah)}`;
    selectedAyahText.textContent = formatAyahText(ayah.text);
    selectedAyahNote.value = ayahNotes[String(ayah.number)] || '';
    document.getElementById('bookmarkSelectedAyahBtn').textContent = ayahBookmarks.includes(ayah.number)
      ? 'إزالة من الآيات المحفوظة'
      : 'حفظ الآية';
    selectedAyahTafsir.hidden = true;
    selectedAyahTafsir.textContent = '';
    ayahNoteStatus.textContent = '';
    ayahActionsDialog.showModal();
  }

  async function shareText(title, text) {
    if (navigator.share) {
      await navigator.share({ title, text });
      return;
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    ayahNoteStatus.textContent = 'تم نسخ النص للمشاركة';
  }

  async function loadSelectedAyahTafsir() {
    if (!selectedAyah) return;
    selectedAyahTafsir.hidden = false;
    selectedAyahTafsir.textContent = 'جارٍ تحميل التفسير...';
    try {
      const data = await fetchQuranData(`https://api.alquran.cloud/v1/ayah/${selectedAyah.number}/ar.muyassar`);
      selectedAyahTafsir.textContent = data.text ? `التفسير الميسر: ${data.text}` : 'التفسير غير متاح لهذه الآية.';
    } catch (error) {
      selectedAyahTafsir.textContent = 'تعذر تحميل التفسير الآن. تحقق من الاتصال وحاول مرة أخرى.';
      console.error(error);
    }
  }

  function playAyahAt(index) {
    const ayah = ayahPlaybackQueue?.[index];
    if (!ayah) {
      ayahPlaybackQueue = null;
      ayahPlaybackIndex = -1;
      return;
    }
    ayahPlaybackIndex = index;
    const reciter = reciters[reciterSelect.value] || reciters.yasser;
    audioLabel.textContent = `${ayah.surah.name} · الآية ${ayah.numberInSurah} · ${reciter.name}`;
    if (!reciter.ayahAudio) {
      audioLabel.textContent = 'التشغيل آيةً آية غير متاح لهذا القارئ';
      ayahPlaybackQueue = null;
      ayahPlaybackIndex = -1;
      return;
    }
    audio.src = `https://cdn.islamic.network/quran/audio/${reciter.audioQuality}/${reciter.edition}/${ayah.number}.mp3`;
    audio.playbackRate = Number(audioSpeedSelect.value);
    audio.load();
    audio.play().catch((error) => {
      audioLabel.textContent = 'تعذر تحميل الآية الصوتية';
      console.error(error);
    });
  }

  ayahContainer.addEventListener('click', (event) => {
    const marker = event.target.closest('[data-ayah-index]');
    if (marker) openAyahActions(currentAyahs[Number(marker.dataset.ayahIndex)]);
  });

  document.getElementById('showTafsirBtn').addEventListener('click', loadSelectedAyahTafsir);
  document.getElementById('playSelectedAyahBtn').addEventListener('click', () => {
    const selectedIndex = currentAyahs.indexOf(selectedAyah);
    if (selectedIndex < 0) return;
    ayahPlaybackQueue = currentAyahs;
    ayahActionsDialog.close();
    playAyahAt(selectedIndex);
  });
  document.getElementById('shareSelectedAyahBtn').addEventListener('click', async () => {
    if (!selectedAyah) return;
    const reference = `${selectedAyah.surah.name}، الآية ${selectedAyah.numberInSurah}`;
    try {
      await shareText(reference, `${formatAyahText(selectedAyah.text)}\n${reference}`);
    } catch (error) {
      if (error.name !== 'AbortError') ayahNoteStatus.textContent = 'تعذرت المشاركة أو النسخ.';
    }
  });
  document.getElementById('saveAyahNoteBtn').addEventListener('click', () => {
    if (!selectedAyah) return;
    const note = selectedAyahNote.value.trim();
    if (note) ayahNotes[String(selectedAyah.number)] = note;
    else delete ayahNotes[String(selectedAyah.number)];
    localStorage.setItem(ayahNotesKey, JSON.stringify(ayahNotes));
    ayahNoteStatus.textContent = note ? 'تم حفظ الملاحظة على هذا الجهاز' : 'تم حذف الملاحظة';
  });
  document.getElementById('deleteAyahNoteBtn').addEventListener('click', () => {
    if (!selectedAyah) return;
    delete ayahNotes[String(selectedAyah.number)];
    localStorage.setItem(ayahNotesKey, JSON.stringify(ayahNotes));
    selectedAyahNote.value = '';
    ayahNoteStatus.textContent = 'تم حذف الملاحظة';
  });
  document.getElementById('bookmarkSelectedAyahBtn').addEventListener('click', () => {
    if (!selectedAyah) return;
    ayahBookmarks = ayahBookmarks.includes(selectedAyah.number)
      ? ayahBookmarks.filter((number) => number !== selectedAyah.number)
      : [...ayahBookmarks, selectedAyah.number].sort((first, second) => first - second);
    localStorage.setItem(ayahBookmarksKey, JSON.stringify(ayahBookmarks));
    renderAyahs(currentAyahs);
    document.getElementById('bookmarkSelectedAyahBtn').textContent = ayahBookmarks.includes(selectedAyah.number)
      ? 'إزالة من الآيات المحفوظة'
      : 'حفظ الآية';
    ayahNoteStatus.textContent = ayahBookmarks.includes(selectedAyah.number) ? 'تم حفظ الآية' : 'تمت إزالة الآية المحفوظة';
  });

  reciterSelect.addEventListener('change', () => {
    localStorage.setItem(audioReciterKey, reciterSelect.value);
    const wasPlaying = !audio.paused;
    ayahPlaybackQueue = null;
    ayahPlaybackIndex = -1;
    updateAudioState();
    if (wasPlaying) audio.play().catch(() => { });
  });
  audioSpeedSelect.addEventListener('change', () => {
    audio.playbackRate = Number(audioSpeedSelect.value);
    localStorage.setItem(audioSpeedKey, audioSpeedSelect.value);
  });

  async function updateQuranPage() {
    if (!surahs.length) {
      currentSurahName.textContent = 'جارٍ التحميل';
      currentSurahMeta.textContent = '...';
      return;
    }

    const requestId = ++pageRequestId;
    currentPage = Math.max(1, Math.min(604, currentPage));
    pageCounter.textContent = `صفحة ${currentPage} من 604`;
    pageJumpInput.value = String(currentPage);
    currentSurahMeta.textContent = 'جارٍ تحميل الصفحة';
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === 604;

    try {
      const data = await fetchQuranData(`https://api.alquran.cloud/v1/page/${currentPage}/quran-uthmani`);
      if (requestId !== pageRequestId) return;

      const ayahs = data.ayahs || [];
      if (!ayahs.length) throw new Error('The requested Quran page is empty');
      renderAyahs(ayahs);

      const firstSurah = ayahs[0].surah;
      const lastSurah = ayahs[ayahs.length - 1].surah;
      currentSurahIndex = firstSurah.number - 1;
      currentSurahName.textContent = firstSurah.number === lastSurah.number
        ? firstSurah.name
        : `${firstSurah.name} - ${lastSurah.name}`;
      currentSurahMeta.textContent = `${ayahs.length} آيات`;
      surahSelect.value = String(currentSurahIndex);
      updateAudioState();
      pageCounter.textContent = `صفحة ${data.numberInSurah || currentPage} من 604`;
      window.history.replaceState(null, '', `?page=${currentPage}${window.location.hash || '#quran'}`);
      localStorage.setItem('alhuda-quran-last-page', String(currentPage));
      window.dispatchEvent(new CustomEvent('huda-quran-page-updated', {
        detail: {
          page: currentPage,
          surahNumber: firstSurah.number,
          surahName: firstSurah.name,
          ayahCount: ayahs.length
        }
      }));
    } catch (error) {
      if (requestId !== pageRequestId) return;
      ayahContainer.textContent = 'تعذر تحميل الصفحة الآن. حاول مرة أخرى.';
      currentSurahMeta.textContent = 'غير متاح الآن';
      console.error(error);
    }
  }

  function togglePlayback() {
    ayahPlaybackQueue = null;
    ayahPlaybackIndex = -1;
    if (!audio.src) {
      updateAudioState();
    }

    if (audio.paused) {
      updateAudioState();
      audio.play().catch(() => {
        playSurahBtn.textContent = '▶';
      });
      playSurahBtn.textContent = '❚❚';
    } else {
      audio.pause();
      playSurahBtn.textContent = '▶';
    }
  }

  async function navigateToPage(targetPage) {
    const nextPage = Number(targetPage);
    if (nextPage < 1 || nextPage > 604) return;
    const wasPlaying = !audio.paused;
    const previousAudio = audio.src;
    currentPage = nextPage;
    await updateQuranPage();
    if (wasPlaying && audio.src !== previousAudio) audio.play().catch(() => { });
  }

  async function changePage(direction) {
    await navigateToPage(currentPage + direction);
  }

  modeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      mode = button.dataset.mode;
      updateModeButtons();
      if (mode === 'listen') {
        updateAudioState();
        audio.play().catch(() => { });
      }
    });
  });

  playSurahBtn.addEventListener('click', togglePlayback);
  prevPageBtn.addEventListener('click', () => changePage(-1));
  nextPageBtn.addEventListener('click', () => changePage(1));
  pageJumpForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (pageJumpForm.reportValidity()) {
      navigateToPage(pageJumpInput.value);
    }
  });
  bookmarkPageBtn.addEventListener('click', () => {
    localStorage.setItem(savedPageKey, String(currentPage));
    bookmarkPageBtn.textContent = `تم حفظ صفحة ${currentPage}`;
    updateContinueReadingButton();
  });
  continueReadingBtn.addEventListener('click', () => {
    navigateToPage(localStorage.getItem(savedPageKey));
  });
  decreaseFontBtn.addEventListener('click', () => {
    quranFontSize -= 0.1;
    applyQuranFontSize();
  });
  increaseFontBtn.addEventListener('click', () => {
    quranFontSize += 0.1;
    applyQuranFontSize();
  });
  document.addEventListener('keydown', (event) => {
    if (event.target.matches('input, select, textarea, button')) return;
    if (event.key === 'ArrowLeft') changePage(1);
    if (event.key === 'ArrowRight') changePage(-1);
  });
  surahSelect.addEventListener('change', async () => {
    const wasPlaying = !audio.paused;
    const selectedSurah = surahs[Number(surahSelect.value)];
    if (!selectedSurah) return;
    try {
      const ayahs = await fetchSurah(selectedSurah.number);
      if (!ayahs.length || !ayahs[0].page) throw new Error('Surah start page is unavailable');
      currentPage = ayahs[0].page;
      await updateQuranPage();
      if (wasPlaying) audio.play().catch(() => { });
    } catch (error) {
      currentSurahMeta.textContent = 'تعذر فتح السورة';
      console.error(error);
    }
  });
  listenNowBtn.addEventListener('click', () => {
    mode = 'listen';
    updateModeButtons();
    updateAudioState();
    audio.play().catch(() => { });
  });

  audio.addEventListener('play', () => {
    playSurahBtn.textContent = '❚❚';
  });

  audio.addEventListener('pause', () => {
    playSurahBtn.textContent = '▶';
  });

  audio.addEventListener('ended', () => {
    if (ayahPlaybackQueue && ayahPlaybackIndex + 1 < ayahPlaybackQueue.length) {
      playAyahAt(ayahPlaybackIndex + 1);
      return;
    }
    ayahPlaybackQueue = null;
    ayahPlaybackIndex = -1;
    playSurahBtn.textContent = '▶';
  });

  audio.addEventListener('error', () => {
    audioLabel.textContent = 'تعذر تحميل التلاوة، حاول مرة أخرى';
  });

  async function loadSurahCatalog() {
    try {
      const response = await fetch('https://api.alquran.cloud/v1/surah');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      surahs = payload.data || [];
      if (surahs.length) {
        const params = new URLSearchParams(window.location.search);
        const requestedPage = Number(params.get('page'));
        const requestedSurah = Number(params.get('surah'));
        if (requestedPage >= 1 && requestedPage <= 604) {
          currentPage = requestedPage;
        } else if (requestedSurah >= 1 && requestedSurah <= 114) {
          const ayahs = await fetchSurah(requestedSurah);
          currentPage = ayahs[0]?.page || 1;
        } else {
          const savedPage = Number(localStorage.getItem(savedPageKey));
          if (savedPage >= 1 && savedPage <= 604) currentPage = savedPage;
        }
      }
      renderSurahList();
      window.dispatchEvent(new CustomEvent('huda-surah-catalog-loaded', { detail: surahs }));
      updateContinueReadingButton();
      applyQuranFontSize();
      if (surahs.length) {
        await updateQuranPage();
      }
    } catch (error) {
      surahSelect.innerHTML = '<option value="">تعذر تحميل قائمة السور</option>';
      ayahContainer.innerHTML = '<p class="arabic-text">تعذر تحميل القرآن الآن. تحقق من الاتصال وحاول مرة أخرى.</p>';
      console.error(error);
    }
  }

  updateModeButtons();
  loadSurahCatalog();
});

document.addEventListener('DOMContentLoaded', () => {
  const categoryList = document.getElementById('azkarCategories');
  if (!categoryList) return;

  const searchInput = document.getElementById('azkarSearch');
  const categoryTitle = document.getElementById('azkarCategoryTitle');
  const azkarList = document.getElementById('azkarList');
  const azkarPageNumber = document.getElementById('azkarPageNumber');
  const prevAzkarPageButton = document.getElementById('prevAzkarPageBtn');
  const nextAzkarPageButton = document.getElementById('nextAzkarPageBtn');
  const progressText = document.getElementById('azkarProgressText');
  const progressPercent = document.getElementById('azkarProgressPercent');
  const progressBar = document.getElementById('azkarProgressBar');
  const progressTrack = document.querySelector('.azkar-progress-track');
  const resetProgressButton = document.getElementById('resetAzkarProgressBtn');
  const progressStorageKey = 'alhuda-azkar-progress-v1';

  let categories = [];
  let activeCategory = null;
  let activeAzkar = [];
  let currentAzkarPage = 1;
  let loadRequestId = 0;
  let progress = {};
  const azkarPageSize = 3;

  try {
    progress = JSON.parse(localStorage.getItem(progressStorageKey) || '{}');
  } catch (error) {
    progress = {};
  }

  function saveProgress() {
    try {
      localStorage.setItem(progressStorageKey, JSON.stringify(progress));
    } catch (error) {
      console.error('Could not save Azkar progress', error);
    }
  }

  function arabicNumber(value) {
    return new Intl.NumberFormat('ar-EG').format(value);
  }

  function updateAzkarPageNavigation() {
    const totalPages = Math.max(1, Math.ceil(activeAzkar.length / azkarPageSize));
    currentAzkarPage = Math.min(currentAzkarPage, totalPages);
    azkarPageNumber.textContent = `صفحة ${arabicNumber(currentAzkarPage)} من ${arabicNumber(totalPages)}`;
    prevAzkarPageButton.disabled = currentAzkarPage <= 1;
    nextAzkarPageButton.disabled = currentAzkarPage >= totalPages;
  }

  function updateCategoryProgress() {
    const categoryProgress = progress[String(activeCategory.ID)] || {};
    const completed = activeAzkar.filter((zekr) => Number(categoryProgress[zekr.ID]) >= zekr.repeat).length;
    const percent = activeAzkar.length ? Math.round((completed / activeAzkar.length) * 100) : 0;
    progressText.textContent = `${arabicNumber(completed)} من ${arabicNumber(activeAzkar.length)} مكتمل`;
    progressPercent.textContent = `${arabicNumber(percent)}٪`;
    progressBar.style.width = `${percent}%`;
    progressTrack.setAttribute('aria-valuenow', String(percent));
  }

  function renderAzkarItems() {
    azkarList.innerHTML = '';
    const categoryProgress = progress[String(activeCategory.ID)] || {};
    const firstVisibleIndex = (currentAzkarPage - 1) * azkarPageSize;
    const visibleAzkar = activeAzkar.slice(firstVisibleIndex, firstVisibleIndex + azkarPageSize);

    visibleAzkar.forEach((zekr) => {
      const item = document.createElement('article');
      const count = Math.min(Number(categoryProgress[zekr.ID]) || 0, zekr.repeat);
      item.className = `azkar-item${count >= zekr.repeat ? ' completed' : ''}`;

      const itemHeader = document.createElement('div');
      itemHeader.className = 'azkar-item-header';
      itemHeader.textContent = `ذكر ${zekr.ID}`;

      const text = document.createElement('p');
      text.className = 'azkar-text';
      text.textContent = zekr.ARABIC_TEXT;

      const itemFooter = document.createElement('div');
      itemFooter.className = 'azkar-item-footer';

      const repeat = document.createElement('span');
      repeat.className = 'azkar-repeat';
      repeat.textContent = `التكرار المطلوب: ${arabicNumber(zekr.repeat)}`;

      const countButton = document.createElement('button');
      countButton.type = 'button';
      countButton.className = 'azkar-count-btn';
      countButton.disabled = count >= zekr.repeat;
      countButton.textContent = `${arabicNumber(count)} / ${arabicNumber(zekr.repeat)}`;
      countButton.setAttribute('aria-label', `تكرار الذكر ${count} من ${zekr.repeat}`);
      countButton.addEventListener('click', () => {
        const savedCategoryProgress = progress[String(activeCategory.ID)] || {};
        const nextCount = Math.min((Number(savedCategoryProgress[zekr.ID]) || 0) + 1, zekr.repeat);
        savedCategoryProgress[zekr.ID] = nextCount;
        progress[String(activeCategory.ID)] = savedCategoryProgress;
        saveProgress();

        countButton.textContent = `${arabicNumber(nextCount)} / ${arabicNumber(zekr.repeat)}`;
        countButton.disabled = nextCount >= zekr.repeat;
        countButton.setAttribute('aria-label', `تكرار الذكر ${nextCount} من ${zekr.repeat}`);
        item.classList.toggle('completed', nextCount >= zekr.repeat);
        updateCategoryProgress();
      });

      const shareButton = document.createElement('button');
      shareButton.type = 'button';
      shareButton.className = 'btn btn-secondary azkar-share-btn';
      shareButton.textContent = 'مشاركة';
      shareButton.addEventListener('click', async () => {
        const shareText = `${zekr.ARABIC_TEXT}\n${activeCategory.TITLE} · حصن المسلم`;
        try {
          if (navigator.share) await navigator.share({ title: activeCategory.TITLE, text: shareText });
          else if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(shareText);
            shareButton.textContent = 'تم النسخ';
          } else {
            const textarea = document.createElement('textarea');
            textarea.value = shareText;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            textarea.remove();
            shareButton.textContent = 'تم النسخ';
          }
        } catch (error) {
          if (error.name !== 'AbortError') shareButton.textContent = 'تعذرت المشاركة';
        }
      });

      itemFooter.append(repeat, countButton, shareButton);
      item.append(itemHeader, text, itemFooter);
      azkarList.appendChild(item);
    });

    updateCategoryProgress();
    updateAzkarPageNavigation();
  }

  function renderCategories(filter = '') {
    categoryList.innerHTML = '';
    const normalizedFilter = filter.trim().toLocaleLowerCase('ar');
    const matchingCategories = categories.filter((category) =>
      category.TITLE.toLocaleLowerCase('ar').includes(normalizedFilter)
    );

    if (!matchingCategories.length) {
      categoryList.innerHTML = '<p class="azkar-status">لا توجد أبواب مطابقة للبحث.</p>';
      return;
    }

    matchingCategories.forEach((category) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `azkar-category-btn${activeCategory?.ID === category.ID ? ' active' : ''}`;
      button.textContent = category.TITLE;
      button.addEventListener('click', () => loadCategory(category));
      categoryList.appendChild(button);
    });
  }

  async function loadCategory(category) {
    activeCategory = category;
    currentAzkarPage = 1;
    const requestId = ++loadRequestId;
    categoryTitle.textContent = category.TITLE;
    azkarList.innerHTML = '<p class="azkar-status">جارٍ تحميل الأذكار...</p>';
    updateAzkarPageNavigation();
    renderCategories(searchInput.value);

    try {
      const textUrl = category.TEXT.replace(/^http:/, 'https:');
      const response = await fetch(textUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (requestId !== loadRequestId) return;

      activeAzkar = Object.values(payload)[0].map((zekr) => ({
        ...zekr,
        repeat: Math.max(1, Number.parseInt(zekr.REPEAT, 10) || 1)
      }));
      renderAzkarItems();
    } catch (error) {
      if (requestId !== loadRequestId) return;
      activeAzkar = [];
      azkarList.innerHTML = '<p class="azkar-status">تعذر تحميل هذا الباب. تحقق من الاتصال وحاول مرة أخرى.</p>';
      updateCategoryProgress();
      updateAzkarPageNavigation();
      console.error(error);
    }
  }

  function changeAzkarPage(direction) {
    const totalPages = Math.ceil(activeAzkar.length / azkarPageSize);
    const nextPage = currentAzkarPage + direction;
    if (nextPage < 1 || nextPage > totalPages) return;
    currentAzkarPage = nextPage;
    renderAzkarItems();
    azkarList.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  prevAzkarPageButton.addEventListener('click', () => changeAzkarPage(-1));
  nextAzkarPageButton.addEventListener('click', () => changeAzkarPage(1));
  searchInput.addEventListener('input', () => renderCategories(searchInput.value));
  resetProgressButton.addEventListener('click', () => {
    if (!activeCategory) return;
    delete progress[String(activeCategory.ID)];
    saveProgress();
    renderAzkarItems();
  });

  async function loadCategories() {
    try {
      const response = await fetch('https://www.hisnmuslim.com/api/ar/husn_ar.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      categories = payload['العربية'] || [];
      if (!categories.length) throw new Error('No Arabic Azkar categories found');

      renderCategories();
      const morningEveningCategory = categories.find((category) => category.TITLE.includes('الصباح والمساء'));
      await loadCategory(morningEveningCategory || categories[0]);
    } catch (error) {
      categoryTitle.textContent = 'تعذر تحميل الأذكار';
      categoryList.innerHTML = '<p class="azkar-status">تعذر تحميل فهرس الأذكار. تحقق من الاتصال وحاول مرة أخرى.</p>';
      azkarList.innerHTML = '';
      console.error(error);
    }
  }

  updateAzkarPageNavigation();
  loadCategories();
});

document.addEventListener('DOMContentLoaded', () => {
  const wirdGoalSelect = document.getElementById('wirdGoalSelect');
  if (!wirdGoalSelect) return;

  const wirdPagesRead = document.getElementById('wirdPagesRead');
  const wirdGoalText = document.getElementById('wirdGoalText');
  const wirdDateLabel = document.getElementById('wirdDateLabel');
  const markWirdPageButton = document.getElementById('markWirdPageBtn');
  const resetWirdButton = document.getElementById('resetWirdBtn');
  const wirdProgressBar = document.getElementById('wirdProgressBar');
  const wirdProgressTrack = document.querySelector('.wird-module .library-progress-track');
  const weeklyReadingProgress = document.getElementById('weeklyReadingProgress');
  const tasbeehPhraseSelect = document.getElementById('tasbeehPhraseSelect');
  const tasbeehTargetSelect = document.getElementById('tasbeehTargetSelect');
  const tasbeehTapButton = document.getElementById('tasbeehTapBtn');
  const tasbeehCount = document.getElementById('tasbeehCount');
  const tasbeehProgressText = document.getElementById('tasbeehProgressText');
  const tasbeehProgressBar = document.getElementById('tasbeehProgressBar');
  const tasbeehProgressTrack = document.querySelector('.tasbeeh-module .library-progress-track');
  const resetTasbeehButton = document.getElementById('resetTasbeehBtn');
  const copyTravelDuaButton = document.getElementById('copyTravelDuaBtn');
  const copyDuaStatus = document.getElementById('copyDuaStatus');

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const wirdCountKey = `alhuda-wird-count-${todayKey}`;
  const wirdGoalKey = 'alhuda-wird-goal';
  const tasbeehCountsKey = 'alhuda-tasbeeh-counts';
  const tasbeehTargetKey = 'alhuda-tasbeeh-target';
  const weeklyReadingKey = 'alhuda-reading-week-v1';
  let pagesRead = Number(localStorage.getItem(wirdCountKey)) || 0;
  let tasbeehCounts = {};
  let weeklyReading = {};

  try {
    weeklyReading = JSON.parse(localStorage.getItem(weeklyReadingKey) || '{}');
    if (!weeklyReading || typeof weeklyReading !== 'object' || Array.isArray(weeklyReading)) weeklyReading = {};
  } catch (error) {
    weeklyReading = {};
  }

  try {
    tasbeehCounts = JSON.parse(localStorage.getItem(tasbeehCountsKey) || '{}');
  } catch (error) {
    tasbeehCounts = {};
  }

  const savedGoal = localStorage.getItem(wirdGoalKey);
  if ([...wirdGoalSelect.options].some((option) => option.value === savedGoal)) {
    wirdGoalSelect.value = savedGoal;
  }

  const savedTasbeehTarget = localStorage.getItem(tasbeehTargetKey);
  if (savedTasbeehTarget === '33' || savedTasbeehTarget === '100') {
    tasbeehTargetSelect.value = savedTasbeehTarget;
  }

  function formatCount(value) {
    return new Intl.NumberFormat('ar-EG').format(value);
  }

  function updateWird() {
    const goal = Number(wirdGoalSelect.value);
    const percent = Math.min(100, Math.round((pagesRead / goal) * 100));
    wirdPagesRead.textContent = formatCount(pagesRead);
    wirdGoalText.textContent = `من ${formatCount(goal)} صفحات`;
    wirdProgressBar.style.width = `${percent}%`;
    wirdProgressTrack.setAttribute('aria-valuenow', String(percent));
    markWirdPageButton.disabled = pagesRead >= goal;
    markWirdPageButton.textContent = pagesRead >= goal ? 'اكتمل ورد اليوم' : 'أتممت صفحة';
  }

  function dateStorageKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function renderWeeklyReading() {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const entry = weeklyReading[dateStorageKey(date)];
      const count = Array.isArray(entry?.pages) ? entry.pages.length : 0;
      return { date, count };
    });
    const maximum = Math.max(1, ...days.map((day) => day.count));
    weeklyReadingProgress.innerHTML = '';
    days.forEach(({ date, count }) => {
      const column = document.createElement('div');
      column.className = 'week-day-column';
      column.title = `${new Intl.DateTimeFormat('ar-EG', { weekday: 'long' }).format(date)}: ${formatCount(count)} صفحة`;
      const bar = document.createElement('span');
      bar.className = 'week-day-bar';
      bar.style.setProperty('--day-fill', `${count ? Math.max(8, Math.round((count / maximum) * 100)) : 0}%`);
      const label = document.createElement('small');
      label.textContent = new Intl.DateTimeFormat('ar-EG', { weekday: 'short' }).format(date);
      column.append(bar, label);
      weeklyReadingProgress.appendChild(column);
    });
  }

  function recordReadPage(pageNumber) {
    const key = dateStorageKey(new Date());
    const entry = weeklyReading[key] || { pages: [] };
    if (!Array.isArray(entry.pages)) entry.pages = [];
    if (!entry.pages.includes(Number(pageNumber))) entry.pages.push(Number(pageNumber));
    weeklyReading[key] = entry;
    localStorage.setItem(weeklyReadingKey, JSON.stringify(weeklyReading));
    renderWeeklyReading();
  }

  function updateTasbeeh() {
    const phrase = tasbeehPhraseSelect.value;
    const count = Number(tasbeehCounts[phrase]) || 0;
    const target = Number(tasbeehTargetSelect.value);
    const percent = Math.min(100, Math.round((count / target) * 100));
    tasbeehCount.textContent = formatCount(count);
    tasbeehProgressText.textContent = `${formatCount(count)} من ${formatCount(target)}`;
    tasbeehProgressBar.style.width = `${percent}%`;
    tasbeehProgressTrack.setAttribute('aria-valuenow', String(percent));
    tasbeehTapButton.setAttribute('aria-label', `سبّح ${tasbeehPhraseSelect.selectedOptions[0].textContent}، ${count} مرة`);
  }

  wirdDateLabel.textContent = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }).format(today);
  updateWird();
  updateTasbeeh();
  renderWeeklyReading();

  window.addEventListener('huda-quran-page-updated', (event) => recordReadPage(event.detail.page));

  wirdGoalSelect.addEventListener('change', () => {
    localStorage.setItem(wirdGoalKey, wirdGoalSelect.value);
    updateWird();
  });

  markWirdPageButton.addEventListener('click', () => {
    pagesRead += 1;
    localStorage.setItem(wirdCountKey, String(pagesRead));
    const key = dateStorageKey(new Date());
    const lastReadPage = Number(localStorage.getItem('alhuda-quran-last-page'))
      || Number(localStorage.getItem('alhuda-quran-saved-page')) || 1;
    recordReadPage(lastReadPage);
    updateWird();
  });

  resetWirdButton.addEventListener('click', () => {
    pagesRead = 0;
    localStorage.removeItem(wirdCountKey);
    updateWird();
  });

  tasbeehPhraseSelect.addEventListener('change', updateTasbeeh);
  tasbeehTargetSelect.addEventListener('change', () => {
    localStorage.setItem(tasbeehTargetKey, tasbeehTargetSelect.value);
    updateTasbeeh();
  });

  tasbeehTapButton.addEventListener('click', () => {
    const phrase = tasbeehPhraseSelect.value;
    tasbeehCounts[phrase] = (Number(tasbeehCounts[phrase]) || 0) + 1;
    localStorage.setItem(tasbeehCountsKey, JSON.stringify(tasbeehCounts));
    updateTasbeeh();
  });

  resetTasbeehButton.addEventListener('click', () => {
    tasbeehCounts[tasbeehPhraseSelect.value] = 0;
    localStorage.setItem(tasbeehCountsKey, JSON.stringify(tasbeehCounts));
    updateTasbeeh();
  });

  copyTravelDuaButton.addEventListener('click', async () => {
    const duaText = document.getElementById('travelDuaText').textContent.trim();
    try {
      await navigator.clipboard.writeText(duaText);
      copyDuaStatus.textContent = 'تم نسخ الدعاء';
    } catch (error) {
      const textarea = document.createElement('textarea');
      textarea.value = duaText;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      textarea.remove();
      copyDuaStatus.textContent = copied ? 'تم نسخ الدعاء' : 'تعذر النسخ تلقائيًا';
    }
  });
});
