(function () {
  var C = window.CONTENT, CFG = window.CONFIG, R = window.Report, esc = R.esc;
  var KEY = "process-explanation-tool-v1";

  var STAGES = [
    { id: "start", label: "התחלה" },
    { id: "trial", label: "ניסיון" },
    { id: "learn", label: "לימוד" },
    { id: "fix", label: "תיקון" },
    { id: "practice", label: "תרגול" },
    { id: "finish", label: "סיכום ושליחה" }
  ];

  function fresh() {
    return {
      name: "", mode: "class", stage: "start", furthest: 0, returnTo: null,
      trial: { text: "", t0: null, secs: null, done: false },
      fix: { chain: ["", ""], text: "", t0: null, secs: null, done: false, selfScore: "", selfWhy: "", changes: "" },
      practice: { chain: ["", ""], endText: "", text: "", t0: null, secs: null, done: false },
      lessonFeedback: "", lessonRating: 0
    };
  }

  var S = load();
  var msg = {};      // הודעות שגיאה לפי שלב
  var cache = null;  // PDF שנוצר

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { var o = JSON.parse(raw); return Object.assign(fresh(), o); }
    } catch (e) {}
    return fresh();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  function words(t) { return (t || "").trim().split(/\s+/).filter(Boolean).length; }
  function idx(id) { return STAGES.findIndex(function (s) { return s.id === id; }); }

  function goto(id) {
    S.stage = id;
    S.furthest = Math.max(S.furthest, idx(id));
    save(); render(); window.scrollTo(0, 0);
  }

  // ---------- רכיבים ----------
  function howto(inner) {
    return '<details class="howto"' + (S.mode === "self" ? " open" : "") + "><summary>📋 פירוט: מה עושים בשלב הזה?</summary>" + inner + "</details>";
  }
  function learnBtn() {
    return '<button class="btn secondary small" data-act="openLearn">📖 פירוט לימוד</button>';
  }
  function timerSpan(o) {
    if (o.done) return '<span class="timer">⏱ ' + R.fmtSecs(o.secs) + "</span>";
    return '<span class="timer" id="timer" data-stage="' + S.stage + '">⏱ ' + (o.t0 ? "" : "מתחיל כשמתחילים לכתוב") + "</span>";
  }
  function pills(arr) {
    return '<div class="learn-chain">' + arr.map(function (p, i) {
      return (i ? '<span class="ar">←</span>' : "") + '<span class="pill">' + esc(p) + "</span>";
    }).join("") + "</div>";
  }

  function chainEditor(key, q, endFixed) {
    var o = S[key], h = '<div class="chain">';
    h += '<div class="node fixed">' + esc(q.chainStart) + "</div>";
    o.chain.forEach(function (v, i) {
      h += '<div class="arrow">↓ <small>גורם ל…</small></div>';
      if (o.done) h += '<div class="node">' + esc(v || "—") + "</div>";
      else h += '<div class="node"><div class="nodeline"><input type="text" data-chain="' + key + '" data-i="' + i +
        '" value="' + esc(v) + '" placeholder="שלב ' + (i + 1) + '"><button class="del" data-act="delStep" data-key="' + key + '" data-i="' + i + '" title="מחיקת שלב">✕</button></div></div>';
    });
    if (!o.done) h += '<div class="arrow"><button class="btn secondary small" data-act="addStep" data-key="' + key + '">+ הוספת שלב</button></div>';
    h += '<div class="arrow">↓ <small>גורם ל…</small></div>';
    if (endFixed) h += '<div class="node fixed">' + esc(q.chainEnd) + "</div>";
    else if (o.done) h += '<div class="node fixed">' + esc(o.endText || "—") + "</div>";
    else h += '<div class="node"><input type="text" data-bind="practice.endText" value="' + esc(o.endText) + '" placeholder="' + esc(q.chainEndPlaceholder) + '"></div>';
    return h + "</div>";
  }

  function copyBtn(key, o) {
    if (o.done) return "";
    return '<p class="muted" style="margin:0 0 6px">אחרי שבניתם שרשור, אפשר להעתיק אותו לתיבת התשובה ולערוך אותו שם, בלי לכתוב הכול מחדש.</p>' +
      '<button class="btn secondary small" style="margin:0 0 8px" data-act="copyChain" data-key="' + key + '">⬇ העתקת השרשור לתיבת התשובה</button>';
  }

  function errBox(k) { return msg[k] ? '<div class="msg">' + esc(msg[k]) + "</div>" : ""; }

  // ---------- שלבים ----------
  function vStart() {
    return '<div class="card"><h2>שלום! 👋</h2>' +
      "<p>בכלי הזה מתרגלים כתיבת הסבר תהליכי בביולוגיה. התהליך:</p>" +
      "<ol><li>כותבים תשובה לשאלה, כמו שאתם רגילים (תרגיל ניסיון).</li>" +
      "<li>לומדים את שיטת השרשור הסיבתי.</li>" +
      "<li>חוזרים לאותה שאלה וכותבים תשובה מתוקנת. הכלי נותן משוב.</li>" +
      "<li>מתרגלים על שאלה חדשה.</li>" +
      "<li>מורידים דוח PDF ושולחים אותו למורה בוואטסאפ.</li></ol>" +
      '<label class="field" for="nm">שם מלא</label><input type="text" id="nm" data-bind="name" value="' + esc(S.name) + '" autocomplete="name">' +
      '<label class="field">איך לומדים היום?</label><div class="modes">' +
      modeOpt("class", "בשיעור עם המורה", "המורה מלמד בכיתה, והכלי משמש לתרגול ולמשוב.") +
      modeOpt("self", "לימוד עצמי", "הכלי מסביר בכל שלב מה לעשות, ויש בו חומר לימוד מלא.") +
      "</div>" + errBox("start") +
      '<button class="btn" data-act="start">מתחילים</button>' +
      (S.furthest > 0 ? '<button class="btn secondary" data-act="reset">התחלה מחדש (מוחק הכול)</button>' : "") + "</div>";
  }
  function modeOpt(v, t, d) {
    return '<label class="mode' + (S.mode === v ? " sel" : "") + '"><input type="radio" name="mode" value="' + v + '"' + (S.mode === v ? " checked" : "") +
      '><span><b>' + t + "</b><br><span class='muted'>" + d + "</span></span></label>";
  }

  function vTrial() {
    var q = C.qCO, o = S.trial;
    return '<div class="card"><h2>תרגיל ניסיון: ' + q.title + "</h2>" +
      howto("<ol><li>קראו את השאלה.</li><li>כתבו תשובה כמו שאתם כותבים בדרך כלל, בלי להתכונן ובלי לחפש.</li><li>הזמן נמדד, אז ענו ברצינות.</li><li>לוחצים על 'סיימתי'. שימו לב: אחרי הלחיצה אי אפשר לשנות את התשובה, כי נחזור אליה בסוף.</li></ol>") +
      '<div class="question">' + esc(q.text) + "</div>" +
      '<div class="row" style="margin-top:10px"><span class="muted">התשובה שלך:</span><span class="spacer"></span>' + timerSpan(o) + "</div>" +
      '<textarea data-bind="trial.text" ' + (o.done ? "readonly" : "") + ' placeholder="כתבו כאן את התשובה…">' + esc(o.text) + "</textarea>" +
      errBox("trial") +
      (o.done
        ? '<p class="muted">התשובה ננעלה. עוברים ללימוד.</p><button class="btn" data-act="toLearn">להמשיך ללימוד ←</button>'
        : '<button class="btn" data-act="submitTrial">סיימתי, להמשיך ללימוד</button>' + learnBtn()) +
      "</div>";
  }

  function vLearn() {
    var back = S.returnTo ? "חזרה לתרגיל" : "הבנתי, עוברים לתיקון";
    return '<div class="card"><h2>לימוד: איך כותבים הסבר תהליכי</h2>' +
      (S.mode === "class" ? '<div class="note">בשיעור: עקבו אחרי ההסבר של המורה. החומר כאן נשאר זמין לכם גם אחר כך.</div>' : "") +

      "<h3>1. הרעיון המרכזי: חשיבה מנגנונית, לא תכליתית</h3>" +
      "<p>ביולוגיה היא שרשרת של תהליכים שמובילה לתוצאה: תופעה אחת גורמת לתופעה הבאה. הגוף לא עושה דברים 'על מנת ש…' והתאים לא 'רוצים' כלום. תשובה טובה מסבירה <b>כיצד</b> ו<b>למה</b>, ולא חוזרת על השאלה בניסוח אחר.</p>" +
      '<div class="question">אצל תינוק מסוים המחיצה בין החדרים לא נסגרה באופן טבעי לאחר הלידה. מה הסכנה בכך?</div>' +
      '<div class="bad"><span class="tag">דוגמה לתשובה לקויה: חזרה על השאלה</span>כאשר המחיצה לא נסגרת יש ערבוב של דם מהחלק הימני עם דם מהחלק השמאלי.<br><span class="muted">אין כאן הסבר תהליכי, לא ה“כיצד” ולא ה“למה”. זו חזרה מהירה על מה שכבר נאמר, בלי תוספת.</span></div>' +
      '<div class="alert"><b>⚠ שגיאה חשובה במיוחד: האנשה</b><p>אסור לתאר את הגוף, התאים או המולקולות כאילו יש להם רצון, כוונה או מטרה. אין תא ש"רוצה", ואין גוף ש"מנסה". יש רק סיבה ותוצאה: תופעה אחת גורמת לתופעה הבאה.</p>' +
      '<table class="fb"><thead><tr><th>✖ האנשה / תכלית</th><th>✔ ניסוח מנגנוני</th></tr></thead><tbody>' +
      '<tr><td>התאים רוצים שיגיע אליהם חמצן</td><td>התאים זקוקים לחמצן כחומר גלם לנשימה תאית, וכשכמותו יורדת קצב הנשימה התאית יורד</td></tr>' +
      '<tr><td>הגוף מנסה לפצות על המחסור</td><td>המחסור בחמצן מעורר תגובה פיזיולוגית שמעלה את קצב הנשימה</td></tr>' +
      '<tr><td>על מנת שייווצר ATP, מתרחשת נשימה תאית</td><td>בנשימה תאית נוצר ATP</td></tr>' +
      '<tr><td>כדי שהדם יקבל חמצן, החמצן עובר אליו מהנאדיות</td><td>החמצן עובר מהנאדיות לדם בדיפוזיה, כי ריכוזו בנאדיות גבוה יותר מאשר בדם</td></tr></tbody></table>' +
      '<p class="muted">מילים שצריכות להדליק נורה אדומה: "על מנת ש…", "כדי ש…", "רוצה", "מנסה", "צריך", "מחליט". הכלי יסמן לכם אותן במשוב.</p></div>' +
      '<div class="bad"><span class="tag">⚠ דוגמה לתשובה לקויה: האנשה וטאוטולוגיה</span>על מנת שהגוף יעשה נשימה תאית כמו שצריך, <u>התאים רוצים</u> שיגיע אליהם כמות מספיקה של חמצן… בגלל שהמחיצה לא הצליחה להיסגר, דם מהצד הימני מסתנן לצד השמאלי, פחות חמצן מגיע לתאים והם לא יכולים לעשות את כל הנשימה התאית <u>שהם רוצים</u>.<br><span class="muted">יש כאן חזרות והאנשה של התהליך. בביולוגיה אין “רצון” או “צורך”, יש סיבה ותוצאה. התהליך לא קורה “על מנת ש…”, תופעה אחת מובילה לאחרת.</span></div>' +

      "<h3>2. ארבעה צעדים לתכנון שרשור סיבתי</h3>" +
      '<details class="step" open><summary>א. זיהוי הסיבה והתוצאה</summary><p>מצאו בשאלה את הסיבה ואת התוצאה וסמנו אותן. כלי עזר: <b>מה שהתרחש קודם הוא הסיבה, ומה שהתרחש אחר כך הוא התוצאה.</b></p><div class="learn-chain"><span class="pill">סיבה: המחיצה בין החדרים לא נסגרה</span><span class="pill">תוצאה: סכנה לתינוק</span></div></details>' +
      '<details class="step"><summary>ב. יצירת תבנית לתשובה</summary><p>מקמו את הסיבה בתחילת השורה ואת התוצאה בסופה, עם רווח מספק ביניהן.</p><div class="answer-box">המחיצה בין החדרים לא נסגרה ________________ סכנה לתינוק שנולד.</div></details>' +
      '<details class="step"><summary>ג. בניית השרשור הסיבתי</summary><p>כתבו רצף תהליכים עוקבים בזמן, מהסיבה ועד התוצאה, <b>בלי לדלג על שלבים</b>. הכניסו (ככל שקשור לעניין) מושגים ועקרונות ביולוגיים, ולכמה שיותר רמות ארגון. בין כל שני שלבים סמנו חץ שמשמעותו "גורם ל…" או "כתוצאה מכך".</p>' +
      pills(["המחיצה בין החדרים לא נסגרה", "דם עני בחמצן ייכנס לחדר השמאלי", "דם עני בחמצן יתערבב בדם עשיר בחמצן", "ריכוז החמצן בדם הזורם לאברי הגוף יורד", "פחות חמצן מגיע לתאים ברקמות", "קצב הנשימה התאית יורד", "מחסור באנרגיה זמינה לפעילות החיים של התאים", "סכנה לתינוק שנולד"]) + "</details>" +
      '<details class="step"><summary>ד. כתיבת התשובה</summary><p>עברו על התבנית בקריאה ביקורתית. במקום כל חץ קראו "כתוצאה מכך" או "גורם ל…". הקפידו על כיווניות (מוריד / מעלה / מוסיף / גורע). התשובה צריכה להיות זורמת והגיונית, לרוב גם לאדם שלא לומד ביולוגיה. אם היא לא זורמת, בדקו שלא קפצתם קדימה ואחורה על ציר הזמן.</p>' +
      '<div class="good"><span class="tag">תשובה טובה</span>כאשר אצל תינוק שנולד המחיצה בין החדרים לא נסגרה, דם עני בחמצן, שהגיע מהגוף, ייכנס לחדר השמאלי ויתערבב בדם עשיר בחמצן שהגיע מהריאות. כך ריכוז החמצן בדם הזורם מחדר שמאל לאברי הגוף יירד. כתוצאה מכך פחות חמצן יגיע בזרם הדם אל התאים שברקמות. ירידה זו בכמות החמצן, שהוא חומר גלם בתהליך הנשימה התאית, תגרום להקטנת קצב הנשימה התאית. הפחתת הנשימה התאית, תהליך שבו נוצרת בגוף אנרגיה זמינה, תגרום למחסור באנרגיה זמינה הדרושה לפעילות החיים של התאים, דבר שיעמיד בסכנה את הפעילות התקינה של מערכות הגוף של התינוק שנולד.</div></details>' +

      "<h3>3. כשבשאלה נתונה רק הסיבה או רק התוצאה</h3>" +
      '<div class="question">מספר הנאדיות בריאה הוא עצום (מעל 300 מיליון). הסבירו מדוע.</div>' +
      "<p>לפעמים בשאלה עצמה נתונה רק הסיבה או רק התוצאה. אז:</p><ul>" +
      "<li>משלימים את החסר מתוך הידע שלנו.</li>" +
      "<li>מחפשים את <b>הסיבה הראשונית ביותר</b> או את <b>התוצאה הסופית ביותר</b> שחסרה, כדי להציג את התהליך בשלמותו, ולא נקודה שנמצאת באמצע התהליך.</li>" +
      "<li>אם שאלו <b>מדוע</b> משהו קורה, שואלים על הסיבה, ולכן מה שנתון הוא התוצאה.</li>" +
      "<li>אם שאלו <b>למה משהו גורם</b> (או מה עלול לקרות), שואלים על התוצאה, ולכן מה שנתון הוא הסיבה.</li></ul>" +
      "<p>בשאלה על הנאדיות נתונה התוצאה (מספר הנאדיות עצום). מה היה קודם? רמז: לא מספיק לכתוב 'יחס שטח פנים לנפח'. צריך שלב לפניו:</p>" +
      pills(["מעבר הגזים נעשה דרך קרום נאדיות הריאה", "יחס שטח פנים לנפח", "מספר הנאדיות בריאה עצום"]) +

      "<h3>4. טיפ: רמות ארגון</h3>" +
      "<p>כשעונים על שאלה עם תהליך, כדאי להתייחס לפחות לשתיים או שלוש רמות ארגון. למשל בשאלה על מערכת הנשימה: אטומים (חמצן), מולקולות (המוגלובין), רקמה (נאדיות), איבר (ריאות), אורגניזם (מאפיין חיים שלו), אוכלוסייה (בעלי חיים וצמחים). אפשר לרשום בצד את רמות הארגון ולוודא שהתייחסתם ל-2–3 מהן.</p>" +

      "<h3>5. עוד כמה כללים</h3><ul>" +
      "<li>תארו 2–5 שלבים בדרך, ותגדירו את כיווניות התהליך.</li>" +
      "<li>שימו לב מה בדיוק שאלו, ואם יש עיקרון ביולוגי רלוונטי (לא תמיד יהיה).</li>" +
      "<li>כתבו חד וברור: הוסיפו מידע מעבר לנאמר בשאלה, אבל רק תכנים רלוונטיים.</li><li><b>בדקו שלא האנשתם:</b> אין “רוצה”, “מנסה” או “על מנת ש…”. רק סיבה ותוצאה.</li></ul>" +
      '<h3>סיכום: מבנה תשובה משמ"ת</h3><img class="summary-img" src="assets/summary-mashmat.png" alt="תשובה משמ״ת: מבנה, שרשור סיבתי, עקרונות ביולוגיים, מקרה מקרו, מושגים ביולוגיים, תסגרו את התשובה">' +
      '<div style="margin-top:12px"><button class="btn" data-act="learnDone">' + back + "</button></div></div>";
  }

  function feedbackBlock(key) {
    var q = key === "fix" ? C.qCO : C.qPN;
    if (key === "fix") {
      var r1 = Checker.analyze(S.trial.text, q), r2 = Checker.analyze(S.fix.text, q);
      return '<div class="card"><h2>משוב אוטומטי: מה השתנה?</h2>' + R.compareTable(r1, r2) +
        '<div class="note">זו בדיקה אוטומטית לפי כללים. היא מחפשת מילים ושלבים ולא מבינה ביולוגיה, ולכן המורה הוא הקובע בסוף. ✔ = עומד בקריטריון, ! = חלקית, ✖ = חסר.</div>' +
        '<details class="step"><summary>דוגמה לתשובה טובה, להשוואה</summary><div class="answer-box">' + esc(q.model) + "</div></details></div>";
    }
    var r = Checker.analyze(S.practice.text, q);
    return '<div class="card"><h2>משוב אוטומטי על התשובה</h2>' + R.feedbackTable(r) +
      '<div class="note">זו בדיקה אוטומטית לפי כללים, והמורה הוא הקובע בסוף.</div>' +
      '<details class="step"><summary>דוגמה לתשובה אפשרית, להשוואה</summary><div class="answer-box">' + esc(q.model) + "</div></details></div>";
  }

  function vFix() {
    var q = C.qCO, o = S.fix, h;
    h = '<div class="card"><h2>תיקון: עונים שוב על שאלת ה-CO</h2>' +
      howto("<ol><li>קראו שוב את השאלה.</li><li>בנו שרשור סיבתי: הסיבה והתוצאה כבר כתובות. הוסיפו לפחות שני שלבים באמצע, לפי הסדר.</li><li>קראו את השרשור, ובמקום כל חץ קראו 'גורם ל…' או 'כתוצאה מכך'.</li><li>כתבו את התשובה כטקסט זורם, עם כיווניות (יורד/עולה) ובלי דילוגים.</li><li>הכלי ייתן משוב ויציג השוואה לתשובה הראשונה שלכם.</li></ol>") +
      '<div class="question">' + esc(q.text) + "</div>" +
      "<h3>שלב 1: בונים את השרשור</h3>" + chainEditor("fix", q, true) +
      '<div class="row"><h3 style="margin:8px 0">שלב 2: כותבים את התשובה</h3><span class="spacer"></span>' + timerSpan(o) + "</div>" + copyBtn("fix", o) +
      '<textarea data-bind="fix.text" ' + (o.done ? "readonly" : "") + ' placeholder="כתבו כאן את התשובה המתוקנת…">' + esc(o.text) + "</textarea>" + errBox("fix");
    if (!o.done) {
      h += '<button class="btn" data-act="submitFix">שליחה וקבלת משוב</button>' + learnBtn() + "</div>";
      return h;
    }
    h += "</div>" + feedbackBlock("fix");
    h += '<div class="card"><h2>רפלקציה: משווים בין שתי התשובות</h2>' +
      '<div class="cols"><div><h3>תשובה ראשונה</h3><div class="answer-box">' + esc(S.trial.text) + "</div></div><div><h3>תשובה מתוקנת</h3><div class=\"answer-box\">" + esc(o.text) + "</div></div></div>" +
      '<p class="muted">אפשר למלא כמה שרוצים, גם מילה אחת. לא חייבים למלא הכול כדי להמשיך.</p><label class="field" for="ss">איזה ציון (0–100) הייתם נותנים לעצמכם על התשובה הראשונה?</label><input type="number" id="ss" min="0" max="100" inputmode="numeric" data-bind="fix.selfScore" value="' + esc(o.selfScore) + '">' +
      '<label class="field">נמקו את הציון</label><textarea class="short" data-bind="fix.selfWhy">' + esc(o.selfWhy) + "</textarea>" +
      '<label class="field">האם חל שינוי בין התשובות? פרטו מה השתנה לדעתכם.</label><textarea class="short" data-bind="fix.changes">' + esc(o.changes) + "</textarea>" +
      '<p class="muted">ותמיד תזכרו לעשות רפלקציה: מה עשיתם טוב, מה אתם לוקחים מזה, ומה אפשר לשפר. לא להתבאס, ללמוד.</p>' +
      '<button class="btn" data-act="toPractice">להמשיך לתרגול נוסף ←</button></div>';
    return h;
  }

  function vPractice() {
    var q = C.qPN, o = S.practice, h;
    h = '<div class="card"><h2>תרגול: ' + q.title + "</h2>" +
      howto("<ol><li>קראו את השאלה וזהו מה נתון בה, סיבה או תוצאה.</li><li>הסיבה כתובה בשרשור. הוסיפו שלבים בדרך, ובסוף כתבו מהי התוצאה הסופית.</li><li>כתבו את התשובה כטקסט זורם: מילות קישור סיבתיות, כיווניות, מושגים ביולוגיים ו-2–3 רמות ארגון.</li><li>אל תכתבו 'על מנת ש…' או 'התאים רוצים'. תארו סיבה ותוצאה.</li></ol>") +
      '<div class="question">' + esc(q.text) + "</div><p class='muted'>" + esc(q.hint) + "</p>" +
      "<h3>שלב 1: בונים את השרשור</h3>" + chainEditor("practice", q, false) +
      '<div class="row"><h3 style="margin:8px 0">שלב 2: כותבים את התשובה</h3><span class="spacer"></span>' + timerSpan(o) + "</div>" + copyBtn("practice", o) +
      '<textarea data-bind="practice.text" ' + (o.done ? "readonly" : "") + ' placeholder="כתבו כאן את התשובה…">' + esc(o.text) + "</textarea>" + errBox("practice");
    if (!o.done) return h + '<button class="btn" data-act="submitPractice">שליחה וקבלת משוב</button>' + learnBtn() + "</div>";
    return h + "</div>" + feedbackBlock("practice") +
      '<div class="card"><button class="btn" data-act="toFinish">לסיכום ולשליחת הדוח ←</button></div>';
  }

  function vFinish() {
    var ready = cache != null;
    return '<div class="card"><h2>סיכום ושליחת הדוח</h2>' +
      "<p>כמעט סיימנו! כתבו משוב קצר על השיעור (מה היה טוב, מה היה קשה, מה הייתם משנים). המשוב מגיע אל " + esc(CFG.teacherName || "המורה") + " בתוך הדוח.</p>" +
      '<label class="field">איך היה השיעור?</label><div class="row" id="stars">' +
      [1, 2, 3, 4, 5].map(function (n) {
        return '<button class="btn small ' + (S.lessonRating >= n ? "" : "secondary") + '" data-act="rate" data-n="' + n + '" aria-label="' + n + ' כוכבים">★</button>';
      }).join("") + "</div>" +
      '<label class="field" for="lf">משוב על השיעור</label><textarea id="lf" class="short" data-bind="lessonFeedback">' + esc(S.lessonFeedback) + "</textarea>" +
      '<h3>הדוח כולל</h3><ul><li>שם, תאריך וזמני כתיבה</li><li>התשובה הראשונה מול התשובה המתוקנת</li><li>משוב אוטומטי, ציון עצמי ונימוק</li><li>תשובה ומשוב על שאלת דלקת הריאות</li><li>משוב על השיעור</li></ul>' +
      errBox("finish") + '<div id="status" class="muted"></div>' +
      '<div id="actions">' + actions(ready) + "</div></div>" +
      '<div class="card"><button class="btn secondary" data-act="reset">להתחיל מחדש (מוחק הכול)</button></div>';
  }
  function actions(ready) {
    if (!ready) return '<button class="btn" data-act="makeReport">📄 הכנת הדוח</button>';
    return '<button class="btn green" data-act="share">📤 שליחה בוואטסאפ</button>' +
      '<button class="btn secondary" data-act="dlPDF">⬇ הורדת PDF</button>' +
      '<button class="btn secondary" data-act="dlPNG">🖼 הורדה כתמונה</button>' +
      '<button class="btn secondary small" data-act="makeReport">הכנה מחדש</button>' +
      '<p class="muted">במחשב או אם השיתוף לא נפתח: הקובץ יורד למכשיר, ואז מצרפים אותו בשיחה בוואטסאפ.</p>';
  }

  // ---------- רינדור ----------
  var VIEWS = { start: vStart, trial: vTrial, learn: vLearn, fix: vFix, practice: vPractice, finish: vFinish };

  function render() {
    document.getElementById("app").innerHTML = VIEWS[S.stage]();
    var cur = idx(S.stage);
    document.getElementById("stepper").innerHTML = STAGES.map(function (s, i) {
      var cls = i === cur ? "active" : i < S.furthest ? "done" : "";
      return '<button class="' + cls + '" data-act="nav" data-id="' + s.id + '"' + (i > S.furthest ? " disabled" : "") + ">" + (i < cur && i > 0 ? "✓ " : "") + s.label + "</button>";
    }).join("");
    document.getElementById("appTitle").textContent = CFG.appTitle || document.title;
    tick();
  }

  function tick() {
    var el = document.getElementById("timer");
    if (!el) return;
    var o = S[el.getAttribute("data-stage")];
    if (o && o.t0 && !o.done) {
      var s = Math.round((Date.now() - o.t0) / 1000);
      el.textContent = "⏱ " + Math.floor(s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60);
    }
  }
  setInterval(tick, 1000);

  // ---------- אירועים ----------
  function setPath(path, val) {
    var p = path.split("."), o = S;
    for (var i = 0; i < p.length - 1; i++) o = o[p[i]];
    o[p[p.length - 1]] = val;
  }

  document.addEventListener("input", function (e) {
    var t = e.target;
    var path = t.getAttribute("data-bind");
    if (path) {
      setPath(path, t.value);
      var parts = path.split(".");
      if (parts.length === 2 && S[parts[0]] && "t0" in S[parts[0]] && !S[parts[0]].t0 && t.value) S[parts[0]].t0 = Date.now();
      if (S.stage === "finish") { cache = null; var a = document.getElementById("actions"); if (a) a.innerHTML = actions(false); }
      save();
      return;
    }
    var ck = t.getAttribute("data-chain");
    if (ck) {
      S[ck].chain[+t.getAttribute("data-i")] = t.value;
      if (!S[ck].t0 && t.value) S[ck].t0 = Date.now();
      save();
    }
  });

  document.addEventListener("change", function (e) {
    if (e.target.name === "mode") { S.mode = e.target.value; save(); render(); }
  });

  function filled(arr) { return arr.filter(function (x) { return x.trim(); }).length; }

  function finishTimer(o) { o.secs = o.t0 ? Math.round((Date.now() - o.t0) / 1000) : null; o.done = true; }

  var ACT = {
    start: function () {
      if (!S.name.trim()) { msg.start = "כתבו את השם שלכם כדי להמשיך."; return render(); }
      msg.start = ""; goto("trial");
    },
    reset: function () {
      if (confirm("למחוק את כל מה שכתבתם ולהתחיל מחדש?")) { S = fresh(); cache = null; msg = {}; save(); render(); window.scrollTo(0, 0); }
    },
    nav: function (el) { S.returnTo = null; goto(el.getAttribute("data-id")); },
    openLearn: function () { S.returnTo = S.stage; goto("learn"); },
    submitTrial: function () {
      if (words(S.trial.text) < 5) { msg.trial = "כתבו תשובה לפני שממשיכים."; return render(); }
      msg.trial = ""; finishTimer(S.trial); save(); render();
    },
    toLearn: function () { S.returnTo = null; goto("learn"); },
    learnDone: function () {
      if (S.returnTo) { var r = S.returnTo; S.returnTo = null; goto(r); } else goto("fix");
    },
    addStep: function (el) { S[el.getAttribute("data-key")].chain.push(""); save(); render(); },
    delStep: function (el) {
      var o = S[el.getAttribute("data-key")];
      if (o.chain.length > 1) o.chain.splice(+el.getAttribute("data-i"), 1);
      save(); render();
    },
    copyChain: function (el) {
      var key = el.getAttribute("data-key"), o = S[key], q = key === "fix" ? C.qCO : C.qPN;
      var strip = function (t) { return t.replace(/\s*\([^)]*\)\s*$/, ""); };
      var steps = o.chain.filter(function (x) { return x.trim(); });
      var end = key === "fix" ? strip(q.chainEnd) : (o.endText || "").trim();
      if (!steps.length && !end) { msg[key] = "קודם כתבו שלבים בשרשור, ואז אפשר להעתיק אותו."; return render(); }
      if (o.text.trim() && !confirm("בתיבת התשובה כבר יש טקסט. להחליף אותו בשרשור?")) return;
      var lines = [strip(q.chainStart)].concat(steps).concat(end ? [end] : []);
      o.text = lines.map(function (l, i) { return i ? "כתוצאה מכך " + l.trim() : l.trim(); }).join(".\n") + ".";
      if (!o.t0) o.t0 = Date.now();
      msg[key] = ""; save(); render();
    },
    submitFix: function () {
      if (filled(S.fix.chain) < 2) { msg.fix = "בנו שרשור עם לפחות שני שלבים באמצע."; return render(); }
      if (words(S.fix.text) < 8) { msg.fix = "כתבו את התשובה המלאה לפני השליחה."; return render(); }
      msg.fix = ""; S.fix.chain = S.fix.chain.filter(function (x) { return x.trim(); }); finishTimer(S.fix); save(); render();
    },
    toPractice: function () { msg.reflect = ""; goto("practice"); },
    submitPractice: function () {
      var p = S.practice;
      if (filled(p.chain) < 2 || !p.endText.trim()) { msg.practice = "בנו שרשור עם לפחות שני שלבים באמצע, וכתבו את התוצאה הסופית."; return render(); }
      if (words(p.text) < 8) { msg.practice = "כתבו את התשובה המלאה לפני השליחה."; return render(); }
      msg.practice = ""; p.chain = p.chain.filter(function (x) { return x.trim(); }); finishTimer(p); save(); render();
    },
    toFinish: function () { goto("finish"); },
    rate: function (el) { S.lessonRating = +el.getAttribute("data-n"); cache = null; save(); render(); },
    makeReport: async function () {
      if (!S.name.trim()) { msg.finish = "חסר שם. חזרו לשלב ההתחלה."; return render(); }
      var st = document.getElementById("status");
      st.textContent = "מכין את הדוח… זה לוקח כמה שניות.";
      try {
        var results = {
          trial: Checker.analyze(S.trial.text, C.qCO),
          fix: Checker.analyze(S.fix.text, C.qCO),
          practice: Checker.analyze(S.practice.text, C.qPN)
        };
        var host = document.getElementById("reportHost");
        host.innerHTML = R.buildReportHTML(S, results, CFG);
        var blob = await R.buildPDF(host);
        cache = { pdf: blob };
        document.getElementById("status").textContent = "הדוח מוכן ✔";
        document.getElementById("actions").innerHTML = actions(true);
      } catch (err) {
        console.error(err);
        document.getElementById("status").textContent = "הייתה בעיה ביצירת הדוח. נסו שוב, או צלמו מסך של הדף.";
      }
    },
    dlPDF: function () { download(cache.pdf, fileName("pdf")); },
    dlPNG: async function () {
      var st = document.getElementById("status"); st.textContent = "מכין תמונה…";
      try { var b = await R.buildPNG(document.getElementById("reportHost")); download(b, fileName("png")); st.textContent = "התמונה ירדה ✔"; }
      catch (e) { st.textContent = "יצירת התמונה נכשלה."; }
    },
    share: async function () {
      var file = new File([cache.pdf], fileName("pdf"), { type: "application/pdf" });
      var text = "שלום, זה הדוח שלי מתרגיל כתיבת הסבר תהליכי: " + S.name;
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "דוח תרגול", text: text });
          return;
        }
      } catch (e) { if (e && e.name === "AbortError") return; }
      download(cache.pdf, fileName("pdf"));
      var phone = (CFG.teacherPhone || "").replace(/\D/g, "");
      window.open("https://wa.me/" + phone + "?text=" + encodeURIComponent(text), "_blank");
      document.getElementById("status").textContent = "הדוח ירד למכשיר. בוואטסאפ לחצו על הסיכה 📎 וצרפו אותו.";
    }
  };

  function fileName(ext) {
    var n = (S.name || "student").trim().replace(/[^֐-׿a-zA-Z0-9]+/g, "_");
    return "דוח_" + n + "_" + new Date().toISOString().slice(0, 10) + "." + ext;
  }
  function download(blob, name) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-act]");
    if (!el || el.disabled) return;
    var f = ACT[el.getAttribute("data-act")];
    if (f) f(el);
  });

  render();
})();
