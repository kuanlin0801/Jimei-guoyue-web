// 頁碼補零；寬度依總頁數（25 頁 → 2 位 → "01".."25"）
export function pad(n, width = 2) {
  return String(n).padStart(width, '0');
}

// 產生頁面清單；dir 預設站內 /intro，圖檔命名須與轉檔腳本一致
export function buildPages(count, { dir = '/intro' } = {}) {
  const pages = [];
  for (let i = 1; i <= count; i++) {
    const p = pad(i);
    pages.push({
      index: i,
      src: `${dir}/page-${p}.jpg`,
      thumb: `${dir}/thumb-${p}.jpg`,
      alt: `樂團介紹 第 ${i} 頁`,
    });
  }
  return pages;
}

// 頁碼標籤
export function formatPageLabel(current, total) {
  return `${current} / ${total}`;
}
