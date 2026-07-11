// 集美國樂「暑訓作業繳交」通知：家長送出 Google 表單後，自動寄一封含繳交細節＋影片連結的信給老師。
// 綁定：開啟表單連動的「回應試算表」→ 擴充功能 → Apps Script → 貼上本檔並存檔。
// 觸發器：編輯器左側時鐘圖示（觸發器）→ 新增觸發器 → 函式 onFormSubmit、
//         事件來源「來自試算表」、事件類型「表單提交時」。
// 首次會要求授權寄信權限（MailApp）；寄件者顯示為此試算表擁有者（站方 Google 帳號）。
// 欄位不寫死：直接讀試算表表頭，表單日後增減題目、改題目文字都不必改本檔。

const TEACHERS = 'jay80306@gmail.com, zoe70355@gmail.com';   // 老師收件人（多位用逗號分隔）

function onFormSubmit(e) {
  const sheet   = e.range.getSheet();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const answers = e.values;   // 與 headers 同一順序

  let studentName = '', songTitle = '', parentEmail = '';
  const lines = [];
  headers.forEach((title, i) => {
    title = String(title).trim();
    const ans = String(answers[i] || '').trim();
    if (!title) return;
    if (/timestamp|時間戳記/i.test(title)) return;   // 跳過系統時間欄
    if (ans === '') return;                          // 空欄不列（影片二選一，另一欄會空）
    if (title.indexOf('姓名') > -1) studentName = studentName || ans;
    if (/哪一首|作業|曲目/.test(title)) songTitle = songTitle || ans;
    if (/email|電子郵件/i.test(title)) parentEmail = parentEmail || ans;
    lines.push(`${title}：${ans}`);
  });

  const tag     = [studentName, songTitle].filter(Boolean).join(' — ');
  const subject = `【集美國樂】作業繳交${tag ? '：' + tag : ''}`;
  const body    = `有一筆新的暑訓作業繳交：\n\n${lines.join('\n')}\n\n— 集美國樂團網站自動通知`;

  // 家長 email 合法才設為回覆對象，老師按「回覆」即可直接回家長。
  const options = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(parentEmail) ? { replyTo: parentEmail } : {};
  MailApp.sendEmail(TEACHERS, subject, body, options);
}
