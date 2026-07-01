// 社團三個 Google 日曆的單一設定來源，行事曆頁與首頁「近期行程」共用。
// 取得 ID：Google 日曆 → 設定 → 該日曆「整合日曆」→ 日曆 ID（…@group.calendar.google.com）。
// color 用 Google 嵌入支援的色票；name 用於圖例與清單。
// ⚠️ 每個日曆需在 Google「活動的存取權限」設為「公開供大眾使用＋查看所有活動詳細資訊」，
//    網站訪客（含首頁清單透過 API 讀取）才看得到活動標題。
export const calendars = [
  { name: '全團常態課與展演', id: '22c5761d79fad72e0446bf355a9e95bc5316d127709efa635a3ffa4d8f67d027@group.calendar.google.com', color: '#e4c441' },
  { name: '加強課', id: 'ad21c45b8e0ec03cbb4257b29342ed7804349e650a4f24efde32ed840a7abcc6@group.calendar.google.com', color: '#d81b60' },
  { name: '低音組分部課', id: 'ae55bd08ac5c4362f5e8443a73480aa86a955b8ce09acc62fc3aa0d4b4ede7d2@group.calendar.google.com', color: '#f09300' },
  { name: '暑期集訓', id: '617ff5ed5f1de469bf47541c15ceaa4d798ec9268a8bd3049d5354e68fd31fa0@group.calendar.google.com', color: '#c0ca33' },
];
