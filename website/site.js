const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#site-nav');

if (menuButton && navigation) {
  menuButton.addEventListener('click', () => {
    const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!isOpen));
    menuButton.setAttribute('aria-label', isOpen ? 'فتح القائمة' : 'إغلاق القائمة');
    navigation.classList.toggle('is-open', !isOpen);
  });

  navigation.addEventListener('click', (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', 'فتح القائمة');
      navigation.classList.remove('is-open');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', 'فتح القائمة');
      navigation.classList.remove('is-open');
      menuButton.focus();
    }
  });
}

document.querySelectorAll('[data-year]').forEach((element) => {
  element.textContent = String(new Date().getFullYear());
});

const apkLink = document.querySelector('#download-apk');
const releaseStatus = document.querySelector('#release-status');

if (apkLink instanceof HTMLAnchorElement && releaseStatus) {
  const releaseTag = document.querySelector('#release-tag');
  const releaseSize = document.querySelector('#release-size');
  const releaseDate = document.querySelector('#release-date');
  const releaseApiUrl = 'https://api.github.com/repos/jwjj3463-dotcom/Venting/releases/latest';
  const fallbackMessage =
    'تعذر تحديث تفاصيل الإصدار الآن. يظل زر التنزيل متصلًا بأحدث APK رسمي على GitHub.';
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);

  fetch(releaseApiUrl, {
    headers: { Accept: 'application/vnd.github+json' },
    signal: controller.signal,
  })
    .then((response) => {
      if (!response.ok) throw new Error(`GitHub release request failed: ${response.status}`);
      return response.json();
    })
    .then((release) => {
      const apk = Array.isArray(release.assets)
        ? release.assets.find((asset) => asset.name === 'app-release.apk')
        : undefined;
      if (!apk || !Number.isFinite(apk.size) || typeof release.tag_name !== 'string') {
        throw new Error('Latest GitHub release does not contain a valid APK asset');
      }

      const assetUrl = new URL(apk.browser_download_url);
      if (
        assetUrl.hostname !== 'github.com' ||
        !assetUrl.pathname.startsWith('/jwjj3463-dotcom/Venting/releases/download/')
      ) {
        throw new Error('Latest APK URL is not hosted by the official GitHub repository');
      }

      apkLink.href = assetUrl.href;
      if (releaseTag) releaseTag.textContent = release.tag_name;
      if (releaseSize) {
        releaseSize.textContent = `${(apk.size / 1024 / 1024).toFixed(1)} MB`;
      }
      if (releaseDate && typeof release.published_at === 'string') {
        const publishedAt = new Date(release.published_at);
        if (!Number.isNaN(publishedAt.getTime())) {
          releaseDate.textContent = new Intl.DateTimeFormat('ar', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }).format(publishedAt);
        }
      }
      releaseStatus.textContent = 'ملف APK رسمي. يبدأ التنزيل من GitHub مباشرةً.';
    })
    .catch((error) => {
      console.warn('Could not load the latest Fadfada release metadata.', error);
      releaseStatus.textContent = fallbackMessage;
    })
    .finally(() => window.clearTimeout(timeout));
}
