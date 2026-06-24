// 活動支援設定。每個需要人手的活動一筆。
// formUrl：報名 Google 表單連結；responsesCsvUrl：表單回覆試算表發布的 CSV。
// 開發先用 /sample-support-responses.csv 範例；上線換成真實連結。
export const supportEvents = [
  {
    id: 'showcase-0712',
    name: '暑期成果發表會',
    date: '2026-07-12',
    formUrl: 'https://docs.google.com/forms/REPLACE',
    responsesCsvUrl: '/sample-support-responses.csv',
    needs: [
      { label: '搬運樂器', target: 4 },
      { label: '現場場佈', target: 5 },
      { label: '攝影記錄', target: 2 },
      { label: '餐點茶水', target: 2 },
    ],
  },
];
