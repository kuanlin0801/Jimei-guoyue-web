// 集美國小國樂團「成果與榮譽」資料（由新到舊）。
// 競賽榮譽分「樂團團體獎」與「個人獎」；演出紀錄為公開演出／音樂會。
// 資料來源：社團 Facebook 粉專（得獎海報、活動海報）。

// 公開演出／音樂會
export const performances = [
  { date: '2026',       title: '成果發表會',                                  venue: '集美國小演藝廳', note: '曲目含〈臺灣追想曲〉' },
  { date: '2026/05/15', title: '三校國樂校際交流音樂會「樂韻三地・響動茶鄉」', venue: '南投・弓鞋國小躬學館' },
  { date: '2026/03/22', title: '花博樂齡永續公益市集',                          venue: '花博公園新生園區' },
  { date: '2026/02/27', title: '春光樂語傳情韻',                                venue: '三重通圳里市民活動中心' },
  { date: '2025/11/01', title: '「樂響公園」音樂會',                            venue: '玫瑰公園（三重區集美街112巷23號）' },
  { date: '2025/06/08', title: '113學年度音樂會「翡翠」',                       venue: '集美國小演藝廳' },
  { date: '2025/02/15', title: '「因為有你，世界變得更甜蜜」音樂會',           venue: '北投老爺酒店' },
  { date: '2025/01/04', title: '童樂初響・國樂體驗營',                          venue: '集美國小一樓合奏教室' },
  { date: '2024/12/22', title: '聖誕演奏會',                                    venue: '三重都廳大院（都廳大院農會市集）' },
  { date: '2024/01/13', title: '成果發表會「HAPPY FIESTA」',                   venue: '集美國小演藝廳' },
  { date: '歷年',       title: '社區、廟會擊樂演出（多場）',                    venue: '三重在地宮廟等' },
];

// 樂團團體獎
export const teamAwards = [
  { year: '114學年度', competition: '全國學生音樂比賽',   item: '團體項目',       result: '晉級北區決賽', tier: 'normal' },
  { year: '113學年度', competition: '全國學生音樂比賽',   item: '絲竹室內樂合奏', result: '優等第一名',   tier: 'gold' },
  { year: '113學年度', competition: '新北市學生音樂比賽', item: '絲竹室內樂合奏', result: '特優',         tier: 'gold' },
];

// 個人獎（依賽事分組，組內由新到舊）
export const soloAwardGroups = [
  {
    group: '卓越盃音樂公開賽',
    awards: [
      { year: '2026', name: '吳宥緗', item: '琵琶獨奏（國小六年級組）', result: '第一名',     tier: 'gold' },
      { year: '2025', name: '蘇柏安', item: '排鼓獨奏（國小六年級組）', result: '金獎第一名', tier: 'gold', note: '卓越盃國際音樂公開賽' },
      { year: '2025', name: '蘇柏安', item: '排鼓獨奏',                 result: '第三名',     tier: 'bronze' },
      { year: '2025', name: '朱鴻朗', item: '排鼓獨奏',                 result: '第二名',     tier: 'silver' },
      { year: '2024', name: '朱鴻朗', item: '排鼓獨奏（國小五年級組）', result: '第一名',     tier: 'gold', note: '台灣卓越盃音樂公開賽' },
    ],
  },
  {
    group: '全國器樂大賽北區',
    awards: [
      { year: '2025', name: '蘇柏安', item: '排鼓（國小六年級組）', result: '金獎', tier: 'gold' },
      { year: '2025', name: '黃銘禹', item: '揚琴（國小五年級組）', result: '金獎', tier: 'gold' },
      { year: '2025', name: '張可潔', item: '二胡（國小五年級組）', result: '金獎', tier: 'gold' },
      { year: '2025', name: '翁睿志', item: '揚琴（國小五年級組）', result: '銀獎', tier: 'silver' },
      { year: '2025', name: '吳宥緗', item: '琵琶（國小五年級組）', result: '銀獎', tier: 'silver' },
      { year: '2025', name: '粘芳語', item: '揚琴（國小三年級組）', result: '銅獎', tier: 'bronze' },
      { year: '2024', name: '黃銘禹', item: '揚琴（國小四年級組）', result: '銀獎', tier: 'silver' },
    ],
  },
  {
    group: '學生音樂比賽（113學年度）',
    awards: [
      { year: '新北市', name: '黃銘禹', item: '揚琴獨奏B組', result: '優等第一名',   tier: 'gold' },
      { year: '新北市', name: '吳宥緗', item: '琵琶獨奏A組', result: '優等第一名',   tier: 'gold' },
      { year: '全國',   name: '黃銘禹', item: '揚琴獨奏B組', result: '優等（第六名）', tier: 'normal' },
      { year: '全國',   name: '吳宥緗', item: '琵琶獨奏A組', result: '優等',         tier: 'normal' },
    ],
  },
];
