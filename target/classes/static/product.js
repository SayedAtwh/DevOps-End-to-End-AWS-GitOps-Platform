document.addEventListener('DOMContentLoaded', () => {
  const quranSection = document.getElementById('quran');
  const quranLibraryPane = document.getElementById('quranLibraryPane');
  const quranReaderPane = document.getElementById('quranReaderPane');
  const quranCatalogList = document.getElementById('quranCatalogList');
  const quranSearch = document.getElementById('quranSearch');
  const quranTabs = document.querySelectorAll('.quran-library-tab');
  const surahSelect = document.getElementById('surahSelect');
  const pageJumpForm = document.getElementById('pageJumpForm');
  const pageJumpInput = document.getElementById('pageJumpInput');
  const audioPreviousButton = document.getElementById('audioPrevSurahBtn');
  const audioNextButton = document.getElementById('audioNextSurahBtn');
  const settingsDialog = document.getElementById('settingsDialog');
  const moreDialog = document.getElementById('moreDialog');
  const audio = document.getElementById('quranAudioPlayer');
  const favoritePageButton = document.getElementById('favoritePageBtn');
  const hadithSearch = document.getElementById('hadithSearch');
  const hadithSearchEmpty = document.getElementById('hadithSearchEmpty');

  const favoritesKey = 'alhuda-quran-favorite-pages';
  const lastPageKey = 'alhuda-quran-last-page';
  let surahs = [];
  let activeQuranTab = 'surahs';
  let quranSearchRequestId = 0;
  let quranSearchTimer = null;
  let currentPage = Number(localStorage.getItem(lastPageKey)) || 1;
  let userCoordinates = null;
  let prayerData = null;
  let prayerTimer = null;
  let prayerNotificationTimer = null;
  let qiblaBearing = null;
  let compassHeading = null;
  let liveCompassEnabled = false;
  let favoritePages = [];

  try {
    favoritePages = JSON.parse(localStorage.getItem(favoritesKey) || '[]');
    if (!Array.isArray(favoritePages)) favoritePages = [];
  } catch (error) {
    favoritePages = [];
  }

  function openDialog(dialog) {
    if (dialog && !dialog.open) dialog.showModal();
  }

  function closeDialog(dialog) {
    if (dialog?.open) dialog.close();
  }

  document.getElementById('openSettingsBtn')?.addEventListener('click', () => openDialog(settingsDialog));
  document.getElementById('readerSettingsBtn')?.addEventListener('click', () => openDialog(settingsDialog));
  document.getElementById('openMoreBtn')?.addEventListener('click', () => openDialog(moreDialog));
  document.getElementById('openMoreSettingsBtn')?.addEventListener('click', () => {
    closeDialog(moreDialog);
    openDialog(settingsDialog);
  });

  document.querySelectorAll('[data-close-dialog]').forEach((button) => {
    button.addEventListener('click', () => closeDialog(button.closest('dialog')));
  });

  document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) closeDialog(dialog);
    });
  });

  const themeSelect = document.getElementById('themeSelect');
  const quranFontSelect = document.getElementById('quranFontSelect');
  const ayahContainer = document.getElementById('ayahContainer');

  function setTheme(theme) {
    const validTheme = ['light', 'sepia', 'dark'].includes(theme) ? theme : 'light';
    document.body.dataset.theme = validTheme;
    themeSelect.value = validTheme;
    localStorage.setItem('alhuda-theme', validTheme);
  }

  function setQuranFont(font) {
    const validFont = font === 'amiri' ? 'amiri' : 'naskh';
    ayahContainer.style.fontFamily = validFont === 'amiri' ? '"Amiri", serif' : '"Noto Naskh Arabic", serif';
    quranFontSelect.value = validFont;
    localStorage.setItem('alhuda-quran-font', validFont);
  }

  setTheme(localStorage.getItem('alhuda-theme') || 'light');
  setQuranFont(localStorage.getItem('alhuda-quran-font') || 'naskh');
  themeSelect.addEventListener('change', () => setTheme(themeSelect.value));
  quranFontSelect.addEventListener('change', () => setQuranFont(quranFontSelect.value));

  function openQuranReader(pageNumber) {
    quranLibraryPane.hidden = true;
    quranReaderPane.hidden = false;
    document.body.classList.add('reader-active');
    quranSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const targetPage = Number(pageNumber);
    if (targetPage >= 1 && targetPage <= 604) {
      pageJumpInput.value = String(targetPage);
      pageJumpForm.requestSubmit();
    }
  }

  function openQuranLibrary() {
    quranReaderPane.hidden = true;
    quranLibraryPane.hidden = false;
    document.body.classList.remove('reader-active');
    quranSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  document.getElementById('quranBackBtn').addEventListener('click', openQuranLibrary);

  function updateAudioNavigation() {
    if (!surahs.length) return;
    const selectedIndex = Number(surahSelect.value);
    audioPreviousButton.disabled = selectedIndex <= 0;
    audioNextButton.disabled = selectedIndex >= surahs.length - 1;
  }

  function changeAudioSurah(direction) {
    if (!surahs.length) return;
    const selectedIndex = Number(surahSelect.value);
    const nextIndex = selectedIndex + direction;
    if (nextIndex < 0 || nextIndex >= surahs.length) return;
    openQuranReader();
    surahSelect.value = String(nextIndex);
    surahSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }

  audioPreviousButton.addEventListener('click', () => changeAudioSurah(-1));
  audioNextButton.addEventListener('click', () => changeAudioSurah(1));
  surahSelect.addEventListener('change', updateAudioNavigation);

  document.querySelectorAll('a[href="#quran"]').forEach((link) => {
    link.addEventListener('click', openQuranLibrary);
  });
  document.getElementById('continueReadingHomeBtn').addEventListener('click', () => {
    openQuranReader(Number(localStorage.getItem(lastPageKey)) || Number(localStorage.getItem('alhuda-quran-saved-page')) || 1);
  });

  function renderQuranCatalog() {
    quranCatalogList.innerHTML = '';
    const query = quranSearch.value.trim().toLocaleLowerCase('ar');

    if (activeQuranTab === 'search') {
      if (query.length < 2) {
        quranCatalogList.innerHTML = '<p class="catalog-status">اكتب كلمتين على الأقل للبحث في الآيات.</p>';
        return;
      }
      const requestId = ++quranSearchRequestId;
      quranCatalogList.innerHTML = '<p class="catalog-status">جارٍ البحث في الآيات...</p>';
      clearTimeout(quranSearchTimer);
      quranSearchTimer = setTimeout(async () => {
        try {
          const response = await fetch(`https://api.alquran.cloud/v1/search/${encodeURIComponent(query)}/all/quran-uthmani`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const payload = await response.json();
          if (requestId !== quranSearchRequestId) return;
          const matches = payload.data?.matches || [];
          quranCatalogList.innerHTML = '';
          if (!matches.length) {
            quranCatalogList.innerHTML = '<p class="catalog-status">لا توجد آيات مطابقة.</p>';
            return;
          }
          matches.slice(0, 50).forEach((match) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'quran-search-result';
            const text = document.createElement('span');
            text.textContent = match.text;
            const reference = document.createElement('small');
            reference.textContent = `${match.surah.name} · الآية ${new Intl.NumberFormat('ar-EG').format(match.numberInSurah)}`;
            button.append(text, reference);
            button.addEventListener('click', async () => {
              try {
                const detailResponse = await fetch(`https://api.alquran.cloud/v1/ayah/${match.number}/quran-uthmani`);
                const detail = await detailResponse.json();
                if (detail.data?.page) openQuranReader(detail.data.page);
              } catch (error) {
                quranCatalogList.insertAdjacentHTML('afterbegin', '<p class="catalog-status">تعذر فتح موضع الآية الآن.</p>');
              }
            });
            quranCatalogList.appendChild(button);
          });
        } catch (error) {
          if (requestId !== quranSearchRequestId) return;
          quranCatalogList.innerHTML = '<p class="catalog-status">تعذر البحث الآن. تحقق من الاتصال وحاول مرة أخرى.</p>';
        }
      }, 300);
      return;
    }

    if (activeQuranTab === 'ayahs') {
      let savedAyahs = [];
      try {
        savedAyahs = JSON.parse(localStorage.getItem('alhuda-quran-ayah-bookmarks-v1') || '[]');
      } catch (error) {
        savedAyahs = [];
      }
      if (!Array.isArray(savedAyahs) || !savedAyahs.length) {
        quranCatalogList.innerHTML = '<p class="catalog-status">الآيات التي تحفظها ستظهر هنا.</p>';
        return;
      }
      const matchingAyahs = savedAyahs.filter((ayahNumber) => String(ayahNumber).includes(query));
      if (!matchingAyahs.length) {
        quranCatalogList.innerHTML = '<p class="catalog-status">لا توجد آيات محفوظة مطابقة.</p>';
        return;
      }
      matchingAyahs.forEach((ayahNumber) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'quran-favorite-item';
        button.textContent = `الآية ${new Intl.NumberFormat('ar-EG').format(ayahNumber)}`;
        button.addEventListener('click', async () => {
          try {
            const response = await fetch(`https://api.alquran.cloud/v1/ayah/${ayahNumber}/quran-uthmani`);
            const payload = await response.json();
            if (payload.data?.page) openQuranReader(payload.data.page);
          } catch (error) {
            quranCatalogList.insertAdjacentHTML('afterbegin', '<p class="catalog-status">تعذر فتح الآية الآن.</p>');
          }
        });
        quranCatalogList.appendChild(button);
      });
      return;
    }

    if (activeQuranTab === 'surahs') {
      const matches = surahs.filter((surah) =>
        `${surah.number} ${surah.name} ${surah.englishName} ${surah.revelationType}`.toLocaleLowerCase('ar').includes(query)
      );

      if (!matches.length) {
        quranCatalogList.innerHTML = '<p class="catalog-status">لا توجد سور مطابقة للبحث.</p>';
        return;
      }

      matches.forEach((surah) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'quran-surah-item';
        const number = document.createElement('span');
        number.className = 'surah-number-badge';
        number.textContent = String(surah.number).padStart(2, '0');

        const title = document.createElement('span');
        title.className = 'surah-item-title';
        const arabicName = document.createElement('strong');
        arabicName.textContent = surah.name;
        const englishName = document.createElement('small');
        englishName.textContent = surah.englishName;
        title.append(arabicName, englishName);

        const meta = document.createElement('span');
        meta.className = 'surah-item-meta';
        const revelation = surah.revelationType === 'Meccan' ? 'مكية' : 'مدنية';
        meta.textContent = `${surah.numberOfAyahs} آيات · ${revelation}`;

        button.append(number, title, meta);
        button.addEventListener('click', () => {
          surahSelect.value = String(surah.number - 1);
          openQuranReader();
          surahSelect.dispatchEvent(new Event('change', { bubbles: true }));
        });
        quranCatalogList.appendChild(button);
      });
      return;
    }

    if (activeQuranTab === 'juz') {
      for (let juz = 1; juz <= 30; juz += 1) {
        const label = `الجزء ${new Intl.NumberFormat('ar-EG').format(juz)}`;
        if (query && !label.toLocaleLowerCase('ar').includes(query)) continue;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'quran-juz-item';
        button.textContent = label;
        button.addEventListener('click', async () => {
          try {
            const response = await fetch(`https://api.alquran.cloud/v1/juz/${juz}/quran-uthmani`);
            const payload = await response.json();
            const firstAyah = payload.data?.ayahs?.[0];
            if (firstAyah?.page) openQuranReader(firstAyah.page);
          } catch (error) {
            quranCatalogList.insertAdjacentHTML('afterbegin', '<p class="catalog-status">تعذر فتح الجزء الآن.</p>');
          }
        });
        quranCatalogList.appendChild(button);
      }
      return;
    }

    if (activeQuranTab === 'last') {
      const lastPage = Number(localStorage.getItem(lastPageKey)) || Number(localStorage.getItem('alhuda-quran-saved-page'));
      if (!lastPage) {
        quranCatalogList.innerHTML = '<p class="catalog-status">ستظهر هنا آخر صفحة تقرؤها.</p>';
        return;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quran-favorite-item';
      button.textContent = `متابعة القراءة · صفحة ${lastPage}`;
      button.addEventListener('click', () => openQuranReader(lastPage));
      quranCatalogList.appendChild(button);
      return;
    }

    const matchingPages = favoritePages.filter((page) => String(page).includes(query));
    if (!matchingPages.length) {
      quranCatalogList.innerHTML = '<p class="catalog-status">لم تحفظ صفحات للمفضلة بعد. استخدم رمز النجمة أثناء القراءة.</p>';
      return;
    }

    matchingPages.forEach((page) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quran-favorite-item';
      button.textContent = `صفحة ${page}`;
      button.addEventListener('click', () => openQuranReader(page));
      quranCatalogList.appendChild(button);
    });
  }

  quranTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      activeQuranTab = tab.dataset.quranTab;
      if (activeQuranTab !== 'search') {
        quranSearchRequestId += 1;
        clearTimeout(quranSearchTimer);
      }
      quranTabs.forEach((item) => {
        const active = item === tab;
        item.classList.toggle('active', active);
        item.setAttribute('aria-selected', String(active));
      });
      quranSearch.placeholder = activeQuranTab === 'search'
        ? 'ابحث بكلمة أو عبارة من الآية'
        : activeQuranTab === 'surahs' ? 'ابحث باسم السورة أو رقمها'
          : activeQuranTab === 'ayahs' ? 'ابحث برقم الآية المحفوظة' : 'اكتب للبحث';
      renderQuranCatalog();
    });
  });

  quranSearch.addEventListener('input', renderQuranCatalog);
  window.addEventListener('huda-surah-catalog-loaded', (event) => {
    surahs = event.detail || [];
    updateAudioNavigation();
    renderQuranCatalog();
    const params = new URLSearchParams(window.location.search);
    if (params.has('page') && window.location.hash === '#quran') {
      quranLibraryPane.hidden = true;
      quranReaderPane.hidden = false;
      document.body.classList.add('reader-active');
    }
  });

  function updateFavoritePageButton() {
    const isFavorite = favoritePages.includes(currentPage);
    favoritePageButton.textContent = isFavorite ? '★' : '☆';
    favoritePageButton.setAttribute('aria-label', isFavorite ? 'إزالة الصفحة من المفضلة' : 'إضافة الصفحة للمفضلة');
    favoritePageButton.title = isFavorite ? 'إزالة من المفضلة' : 'إضافة للمفضلة';
  }

  favoritePageButton.addEventListener('click', () => {
    favoritePages = favoritePages.includes(currentPage)
      ? favoritePages.filter((page) => page !== currentPage)
      : [...favoritePages, currentPage].sort((first, second) => first - second);
    localStorage.setItem(favoritesKey, JSON.stringify(favoritePages));
    updateFavoritePageButton();
  });

  window.addEventListener('huda-quran-page-updated', (event) => {
    currentPage = event.detail.page;
    updateAudioNavigation();
    document.getElementById('homeReadingSurah').textContent = event.detail.surahName;
    document.getElementById('homeReadingPage').textContent = `صفحة ${currentPage}`;
    updateFavoritePageButton();
    if (activeQuranTab === 'last' || activeQuranTab === 'favorites') renderQuranCatalog();
  });

  const initialHash = window.location.hash;
  const initialParams = new URLSearchParams(window.location.search);
  if (initialHash === '#quran' && (initialParams.has('page') || initialParams.has('surah'))) {
    quranLibraryPane.hidden = true;
    quranReaderPane.hidden = false;
    document.body.classList.add('reader-active');
  } else {
    quranReaderPane.hidden = true;
    quranLibraryPane.hidden = false;
  }

  function updateActiveNavigation(sectionId) {
    document.querySelectorAll('[data-nav-section]').forEach((item) => {
      const active = item.dataset.navSection === sectionId;
      item.classList.toggle('active', active);
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }

  document.querySelectorAll('[data-nav-section]').forEach((item) => {
    item.addEventListener('click', () => {
      updateActiveNavigation(item.dataset.navSection);
      if (item.dataset.navSection === 'quran') openQuranLibrary();
    });
  });

  if ('IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver((entries) => {
      const visibleEntry = entries.filter((entry) => entry.isIntersecting)
        .sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0];
      if (visibleEntry) updateActiveNavigation(visibleEntry.target.id);
    }, { rootMargin: '-20% 0px -65% 0px', threshold: [0, 0.1, 0.3] });
    document.querySelectorAll('main > section[id]').forEach((section) => sectionObserver.observe(section));
  }

  document.getElementById('hadithSearch').addEventListener('input', () => {
    const query = hadithSearch.value.trim().toLocaleLowerCase('ar');
    let visibleCollections = 0;
    document.querySelectorAll('.hadith-collection').forEach((collection) => {
      const matches = `${collection.dataset.search} ${collection.textContent}`.toLocaleLowerCase('ar').includes(query);
      collection.hidden = !matches;
      if (matches) visibleCollections += 1;
    });
    hadithSearchEmpty.hidden = visibleCollections !== 0;
  });

  async function loadDailyHadith() {
    const title = document.getElementById('dailyHadithTitle');
    const text = document.getElementById('dailyHadithText');
    const grade = document.getElementById('dailyHadithGrade');
    const source = document.getElementById('dailyHadithSource');
    const reference = document.getElementById('dailyHadithReference');

    try {
      const listResponse = await fetch('https://hadeethenc.com/api/v1/hadeeths/list/?language=ar&category_id=5&per_page=10&page=1');
      if (!listResponse.ok) throw new Error(`HTTP ${listResponse.status}`);
      const listPayload = await listResponse.json();
      const items = listPayload.data || [];
      if (!items.length) throw new Error('No hadith records available');
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
      const selectedHadith = items[dayOfYear % items.length];
      const detailResponse = await fetch(`https://hadeethenc.com/api/v1/hadeeths/one/?language=ar&id=${selectedHadith.id}`);
      if (!detailResponse.ok) throw new Error(`HTTP ${detailResponse.status}`);
      const hadith = await detailResponse.json();
      title.textContent = hadith.title;
      text.textContent = hadith.hadeeth;
      grade.textContent = hadith.grade || 'حديث مختار';
      source.textContent = hadith.attribution || '';
      reference.href = `https://hadeethenc.com/ar/browse/hadith/${hadith.id}`;
    } catch (error) {
      title.textContent = 'تعذر تحميل الحديث الآن';
      text.textContent = 'يمكنك تصفح المجموعات الأصلية أدناه.';
      grade.textContent = '';
      console.error(error);
    }
  }

  loadDailyHadith();

  const prayerNames = [
    { key: 'Fajr', name: 'الفجر' },
    { key: 'Sunrise', name: 'الشروق', notPrayer: true },
    { key: 'Dhuhr', name: 'الظهر' },
    { key: 'Asr', name: 'العصر' },
    { key: 'Maghrib', name: 'المغرب' },
    { key: 'Isha', name: 'العشاء' }
  ];
  const obligatoryPrayerNames = prayerNames.filter((prayer) => !prayer.notPrayer);

  function parsePrayerTime(value) {
    const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
    return match ? `${match[1].padStart(2, '0')}:${match[2]}` : '--:--';
  }

  function nextPrayerFromNow() {
    if (!prayerData) return null;
    const now = new Date();
    for (const prayer of obligatoryPrayerNames) {
      const [hours, minutes] = parsePrayerTime(prayerData.timings[prayer.key]).split(':').map(Number);
      const time = new Date(now);
      time.setHours(hours, minutes, 0, 0);
      if (time > now) return { ...prayer, time };
    }
    const firstPrayer = obligatoryPrayerNames[0];
    const [hours, minutes] = parsePrayerTime(prayerData.timings[firstPrayer.key]).split(':').map(Number);
    const time = new Date(now);
    time.setDate(time.getDate() + 1);
    time.setHours(hours, minutes, 0, 0);
    return { ...firstPrayer, time };
  }

  function formatCountdown(milliseconds) {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  function renderPrayerTimes() {
    if (!prayerData) return;
    const upcoming = nextPrayerFromNow();
    const list = document.getElementById('prayerTimesList');
    const homeList = document.getElementById('homePrayerList');
    list.innerHTML = '';
    homeList.innerHTML = '';

    prayerNames.forEach((prayer) => {
      const timeText = parsePrayerTime(prayerData.timings[prayer.key]);
      const mainItem = document.createElement('div');
      mainItem.className = `prayer-time-item${upcoming?.key === prayer.key ? ' active' : ''}`;
      const mainName = document.createElement('span');
      mainName.textContent = prayer.name;
      const mainTime = document.createElement('strong');
      mainTime.textContent = timeText;
      mainItem.append(mainName, mainTime);
      list.appendChild(mainItem);

      if (!prayer.notPrayer) {
        const homeItem = document.createElement('div');
        homeItem.className = `home-prayer-item${upcoming?.key === prayer.key ? ' active' : ''}`;
        const homeName = document.createElement('span');
        homeName.textContent = prayer.name;
        const homeTime = document.createElement('strong');
        homeTime.textContent = timeText;
        homeItem.append(homeName, homeTime);
        homeList.appendChild(homeItem);
      }
    });

    document.getElementById('nextPrayerName').textContent = upcoming?.name || 'غير متاح';
    document.getElementById('homeNextPrayerName').textContent = upcoming?.name || 'غير متاح';
    document.getElementById('nextPrayerTime').textContent = upcoming ? `الساعة ${parsePrayerTime(prayerData.timings[upcoming.key])}` : '';
    document.getElementById('hijriDateLabel').textContent = prayerData.date?.hijri?.date
      ? `${prayerData.date.hijri.weekday.ar} ${prayerData.date.hijri.date} هـ`
      : '';
    updatePrayerCountdown();
  }

  function updatePrayerCountdown() {
    if (!prayerData) return;
    const upcoming = nextPrayerFromNow();
    const countdown = upcoming ? formatCountdown(upcoming.time - new Date()) : '--:--:--';
    document.getElementById('nextPrayerCountdown').textContent = countdown;
    document.getElementById('homePrayerCountdown').textContent = countdown;
  }

  function updatePrayerNotificationControl() {
    const button = document.getElementById('enablePrayerNotificationsBtn');
    const status = document.getElementById('prayerNotificationStatus');
    const enabled = localStorage.getItem('alhuda-prayer-notifications') === 'true';
    if (!('Notification' in window)) {
      button.disabled = true;
      status.textContent = 'المتصفح لا يدعم تنبيهات الصلاة.';
      return;
    }
    button.textContent = enabled ? 'إيقاف التنبيهات' : 'تفعيل تنبيهات الصلاة';
    status.textContent = enabled
      ? 'التنبيهات تعمل ما دام الموقع مفتوحًا.'
      : 'يمكنك تفعيل تنبيه الصلاة القادمة.';
  }

  function schedulePrayerNotification() {
    if (prayerNotificationTimer) clearTimeout(prayerNotificationTimer);
    if (localStorage.getItem('alhuda-prayer-notifications') !== 'true'
      || !('Notification' in window) || Notification.permission !== 'granted' || !prayerData) return;
    const upcoming = nextPrayerFromNow();
    if (!upcoming) return;
    const delay = Math.max(1000, upcoming.time.getTime() - Date.now());
    prayerNotificationTimer = setTimeout(() => {
      new Notification(`حان وقت صلاة ${upcoming.name}`, { body: 'تقبل الله طاعتكم.' });
      schedulePrayerNotification();
    }, delay);
  }

  document.getElementById('enablePrayerNotificationsBtn').addEventListener('click', async () => {
    const button = document.getElementById('enablePrayerNotificationsBtn');
    const status = document.getElementById('prayerNotificationStatus');
    if (!('Notification' in window)) return;
    if (localStorage.getItem('alhuda-prayer-notifications') === 'true') {
      localStorage.removeItem('alhuda-prayer-notifications');
      if (prayerNotificationTimer) clearTimeout(prayerNotificationTimer);
      updatePrayerNotificationControl();
      return;
    }
    if (Notification.permission === 'denied') {
      status.textContent = 'إذن التنبيهات مرفوض من المتصفح. غيّر الإذن من إعدادات الموقع.';
      return;
    }
    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
    if (permission !== 'granted') {
      status.textContent = 'لم يتم السماح بإرسال التنبيهات.';
      return;
    }
    localStorage.setItem('alhuda-prayer-notifications', 'true');
    updatePrayerNotificationControl();
    schedulePrayerNotification();
  });
  updatePrayerNotificationControl();

  async function loadPrayerTimes(url, locationName) {
    const status = document.getElementById('prayerLocationStatus');
    status.textContent = 'جارٍ تحميل المواقيت...';
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (payload.code !== 200 || !payload.data?.timings) throw new Error('Prayer times unavailable');
      prayerData = payload.data;
      document.getElementById('prayerCityLabel').textContent = locationName;
      status.textContent = 'مواقيت اليوم حسب طريقة الحساب المحلية.';
      renderPrayerTimes();
      if (prayerTimer) clearInterval(prayerTimer);
      prayerTimer = setInterval(updatePrayerCountdown, 1000);
      schedulePrayerNotification();
    } catch (error) {
      status.textContent = 'تعذر تحميل المواقيت. تحقق من الاتصال وحاول مرة أخرى.';
      console.error(error);
    }
  }

  const prayerLocationButton = document.getElementById('requestLocationBtn');
  function updatePrayerForCurrentLocation() {
    const status = document.getElementById('prayerLocationStatus');
    if (!navigator.geolocation) {
      status.textContent = 'المتصفح لا يدعم تحديد الموقع. المواقيت المعروضة للقاهرة.';
      return;
    }
    status.textContent = 'بانتظار إذن تحديد الموقع...';
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      userCoordinates = { latitude: coords.latitude, longitude: coords.longitude };
      loadPrayerTimes(`https://api.aladhan.com/v1/timings?latitude=${coords.latitude}&longitude=${coords.longitude}&method=5`, 'موقعك الحالي');
    }, () => {
      status.textContent = 'لم يُسمح بتحديد الموقع. المواقيت المعروضة للقاهرة.';
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }

  prayerLocationButton.addEventListener('click', updatePrayerForCurrentLocation);
  loadPrayerTimes('https://api.aladhan.com/v1/timingsByCity?city=Cairo&country=Egypt&method=5', 'القاهرة · طريقة الحساب المصرية');

  function calculateQibla(latitude, longitude) {
    const toRadians = (degrees) => degrees * Math.PI / 180;
    const toDegrees = (radians) => radians * 180 / Math.PI;
    const kaabaLatitude = toRadians(21.4225);
    const latitudeRadians = toRadians(latitude);
    const longitudeDifference = toRadians(39.8262 - longitude);
    const y = Math.sin(longitudeDifference) * Math.cos(kaabaLatitude);
    const x = Math.cos(latitudeRadians) * Math.sin(kaabaLatitude)
      - Math.sin(latitudeRadians) * Math.cos(kaabaLatitude) * Math.cos(longitudeDifference);
    const bearing = (toDegrees(Math.atan2(y, x)) + 360) % 360;
    const earthRadiusKm = 6371;
    const deltaLatitude = kaabaLatitude - latitudeRadians;
    const deltaLongitude = longitudeDifference;
    const haversine = Math.sin(deltaLatitude / 2) ** 2
      + Math.cos(latitudeRadians) * Math.cos(kaabaLatitude) * Math.sin(deltaLongitude / 2) ** 2;
    const distance = 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine));
    return { bearing: Math.round(bearing), distance: Math.round(distance) };
  }

  function showQiblaForCoordinates(latitude, longitude) {
    const result = calculateQibla(latitude, longitude);
    qiblaBearing = result.bearing;
    document.getElementById('qiblaAngle').textContent = `${result.bearing}°`;
    document.getElementById('qiblaDistance').textContent = `المسافة إلى الكعبة نحو ${new Intl.NumberFormat('ar-EG').format(result.distance)} كم`;
    document.getElementById('qiblaStatus').textContent = liveCompassEnabled
      ? 'حرّك هاتفك حتى يشير السهم إلى القبلة.'
      : 'السهم يوضح اتجاه القبلة نسبةً إلى الشمال.';
    updateQiblaNeedle();
  }

  function updateQiblaNeedle() {
    if (qiblaBearing === null) return;
    const relativeBearing = (qiblaBearing - (liveCompassEnabled ? compassHeading || 0 : 0) + 360) % 360;
    document.getElementById('qiblaNeedle').style.transform = `rotate(${relativeBearing}deg)`;
  }

  function handleDeviceOrientation(event) {
    const heading = Number.isFinite(event.webkitCompassHeading)
      ? event.webkitCompassHeading
      : Number.isFinite(event.alpha) ? (360 - event.alpha) % 360 : null;
    if (heading === null) return;
    compassHeading = heading;
    updateQiblaNeedle();
  }

  document.getElementById('enableLiveCompassBtn').addEventListener('click', async () => {
    const button = document.getElementById('enableLiveCompassBtn');
    const status = document.getElementById('qiblaStatus');
    if (liveCompassEnabled) {
      liveCompassEnabled = false;
      compassHeading = null;
      window.removeEventListener('deviceorientation', handleDeviceOrientation);
      button.textContent = 'تشغيل البوصلة الحية';
      status.textContent = 'السهم يوضح اتجاه القبلة نسبةً إلى الشمال.';
      updateQiblaNeedle();
      return;
    }
    if (!window.DeviceOrientationEvent) {
      status.textContent = 'مستشعر الاتجاه غير متاح على هذا الجهاز.';
      return;
    }
    let permission = 'granted';
    if (typeof window.DeviceOrientationEvent.requestPermission === 'function') {
      try {
        permission = await window.DeviceOrientationEvent.requestPermission();
      } catch (error) {
        permission = 'denied';
      }
    }
    if (permission !== 'granted') {
      status.textContent = 'لم يتم السماح باستخدام مستشعر الاتجاه.';
      return;
    }
    liveCompassEnabled = true;
    window.addEventListener('deviceorientation', handleDeviceOrientation);
    button.textContent = 'إيقاف البوصلة الحية';
    status.textContent = 'جارٍ انتظار اتجاه الهاتف...';
  });

  document.getElementById('locateQiblaBtn').addEventListener('click', () => {
    if (userCoordinates) {
      showQiblaForCoordinates(userCoordinates.latitude, userCoordinates.longitude);
      return;
    }
    const status = document.getElementById('qiblaStatus');
    if (!navigator.geolocation) {
      status.textContent = 'المتصفح لا يدعم تحديد الموقع.';
      return;
    }
    status.textContent = 'بانتظار إذن تحديد الموقع...';
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      userCoordinates = { latitude: coords.latitude, longitude: coords.longitude };
      showQiblaForCoordinates(coords.latitude, coords.longitude);
    }, () => {
      status.textContent = 'لم يُسمح بتحديد الموقع. فعّل الموقع ثم حاول مرة أخرى.';
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 });
  });

  const todayDateLabel = document.getElementById('todayDateLabel');
  todayDateLabel.textContent = new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).format(new Date());

  const offlineStatus = document.getElementById('offlineStatus');
  function updateOfflineStatus() {
    offlineStatus.textContent = navigator.onLine ? 'المحتوى المفتوح يُحفظ للاستخدام دون اتصال' : 'أنت الآن دون اتصال';
  }
  window.addEventListener('online', updateOfflineStatus);
  window.addEventListener('offline', updateOfflineStatus);
  updateOfflineStatus();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').catch((error) => console.error('Service worker registration failed', error));
  }
});