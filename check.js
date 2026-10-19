// מנוע המשוב האוטומטי: בדיקה לפי כללים (בלי שרת ובלי AI).
// הבדיקה היא היוריסטית – היא מחפשת מילים וביטויים, ולא מבינה את הביולוגיה.
(function () {
  var NIQQUD = /[֑-ׇ]/g;

  function norm(s) {
    return (s || "")
      .replace(NIQQUD, "")
      .replace(/[׳'’`"״]/g, "")
      .toLowerCase()
      .replace(/[.,;:!?()\[\]{}\-–—_\/\\←→↓↑*•]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function stem(w) {
    var n = 0;
    while (w.length > 3 && n < 2 && /^[והבלמשכ]/.test(w)) { w = w.slice(1); n++; }
    return w;
  }

  function contentStems(s) {
    var out = {};
    norm(s).split(" ").forEach(function (w) {
      if (w.length >= 3) out[stem(w)] = true;
    });
    return Object.keys(out);
  }

  function countMatches(re, s) {
    var m = s.match(re);
    return m ? m.length : 0;
  }

  var CONNECTORS = /(גורם|גורמת|גורמים|יגרום|תגרום|גרם|כתוצאה|בעקבות|מביא|מביאה|יביא|תביא|מוביל|מובילה|יוביל|תוביל|לכן|מכיוון|מאחר|בגלל|כך ש|וכך|ובכך|בכך)/g;
  var DIRECTION = /(יורד|ירד|תרד|ירדה|פוחת|פוחתת|פחות|יפחת|תפחת|עולה|עלה|יעלה|תעלה|גדל|גדלה|יגדל|קטן|קטנה|יקטן|תקטן|ירידה|עליה|עלייה|הקטנה|הגדלה|הפחתה|מוריד|מעלה|מצטמצם|מצטמצמת|מחסור|גבוה|נמוך|מעכב|מקטין|מגדיל)/g;
  var TELEO = /(כדי ש|כדי ל|על מנת|בשביל|בכדי|רוצים|רוצה|רצון|צריכים|צריך ל|מנסה|מנסים|מחליט|מחליטים|למען|נועד|נועדה|מטרת)/g;

  var LEVELS = [
    { name: "אטומים/מולקולות", re: /(חמצן|co|המוגלובין|מולקול|atp|גלוקוז|אטום|פחמן)/ },
    { name: "תא", re: /(^|\s)[והבלמשכ]{0,2}(תא|תאי|תאים|תאית|מיטוכונדר\w*)(\s|$)/ },
    { name: "רקמה/איבר/מערכת", re: /(רקמ|שריר|נאדי|ריא|(^|\s)[והבלמשכ]?לב(\s|$)|חדר|איבר|אברי|אברים|כלי דם|נימ|מערכת)/ },
    { name: "אורגניזם", re: /(אדם|גוף|אורגניזם|מעשן|חולה|תינוק|יצור)/ },
    { name: "אוכלוסייה/מערכת אקולוגית", re: /(אוכלוסי|מערכת אקולוגית|ביוספרה)/ }
  ];

  // status: ok | warn | bad
  function analyze(text, q) {
    var n = norm(text);
    var words = n ? n.split(" ").length : 0;
    var res = [];

    // 1. אורך
    res.push({
      id: "length",
      label: "תיאור תהליך מפורט",
      status: words >= 40 ? "ok" : words >= 20 ? "warn" : "bad",
      detail:
        words >= 40
          ? "התשובה מפורטת (" + words + " מילים)."
          : "התשובה קצרה (" + words + " מילים). תהליך דורש בדרך כלל 3–5 שלבים עוקבים, כל אחד במשפט משלו."
    });

    // 2. מעבר לנוסח השאלה
    var qStems = {};
    contentStems(q.text).forEach(function (w) { qStems[w] = true; });
    var aStems = contentStems(text);
    var fresh = aStems.filter(function (w) { return !qStems[w]; }).length;
    var ratio = aStems.length ? fresh / aStems.length : 0;
    res.push({
      id: "beyond",
      label: "הוספת מידע מעבר לנאמר בשאלה",
      status: ratio >= 0.6 ? "ok" : ratio >= 0.4 ? "warn" : "bad",
      detail:
        ratio >= 0.6
          ? "התשובה מוסיפה תוכן שלא כתוב בשאלה."
          : "נראה שחלק גדול מהתשובה חוזר על נוסח השאלה. הוסיפו את ה'כיצד' ואת ה'למה' – מה קורה בין הסיבה לתוצאה."
    });

    // 3. מילות קישור סיבתיות
    var conn = countMatches(CONNECTORS, n);
    res.push({
      id: "connectors",
      label: "שרשור סיבתי (מילות קישור)",
      status: conn >= 3 ? "ok" : conn >= 1 ? "warn" : "bad",
      detail:
        conn >= 3
          ? "יש מילות קישור סיבתיות שמחברות בין השלבים."
          : "מעט מילות קישור (נמצאו " + conn + "). בין כל שני שלבים כתבו 'גורם ל…' או 'כתוצאה מכך…'."
    });

    // 4. כיווניות
    var dir = countMatches(DIRECTION, n);
    res.push({
      id: "direction",
      label: "כיווניות התהליך (עולה / יורד)",
      status: dir >= 2 ? "ok" : dir === 1 ? "warn" : "bad",
      detail:
        dir >= 2
          ? "התשובה מתארת כיווניות (עלייה, ירידה, הקטנה…)."
          : "חסרה כיווניות. כתבו מה עולה ומה יורד בכל שלב (למשל: 'ריכוז החמצן בדם יורד')."
    });

    // 5. כיסוי שלבים
    var covered = [], missing = [];
    q.steps.forEach(function (s) { (s.re.test(n) ? covered : missing).push(s.label); });
    var frac = covered.length / q.steps.length;
    res.push({
      id: "steps",
      label: "כיסוי שלבי התהליך, בלי לדלג",
      status: frac >= 0.75 ? "ok" : frac >= 0.5 ? "warn" : "bad",
      detail:
        missing.length === 0
          ? "כל השלבים המרכזיים הופיעו."
          : "לא זיהינו אצלך את השלבים: " + missing.join(" · "),
      covered: covered,
      missing: missing
    });

    // 6. רמות ארגון
    var hit = LEVELS.filter(function (l) { return l.re.test(n); });
    res.push({
      id: "levels",
      label: "שימוש בכמה רמות ארגון",
      status: hit.length >= 3 ? "ok" : hit.length === 2 ? "ok" : "bad",
      detail:
        hit.length >= 2
          ? "זוהו " + hit.length + " רמות ארגון: " + hit.map(function (l) { return l.name; }).join(", ") + "."
          : "זוהתה רמת ארגון אחת בלבד. כדאי להתייחס ל-2–3 רמות (למשל מולקולה ← תא ← איבר ← אורגניזם)."
    });

    // 7. חשיבה תכליתית
    var tele = n.match(TELEO) || [];
    res.push({
      id: "teleology",
      label: "חשיבה מנגנונית ולא תכליתית",
      status: tele.length === 0 ? "ok" : tele.length === 1 ? "warn" : "bad",
      detail:
        tele.length === 0
          ? "לא נמצאו ניסוחים שמייחסים לגוף רצון או מטרה."
          : "נמצאו ניסוחים שעלולים לבטא תכלית או האנשה: \"" + tele.join("\", \"") + "\". בביולוגיה תופעה אחת מובילה לאחרת, והגוף לא 'רוצה' ולא 'מנסה'."
    });

    var ok = res.filter(function (r) { return r.status === "ok"; }).length;
    return { criteria: res, ok: ok, total: res.length, words: words };
  }

  window.Checker = { analyze: analyze, norm: norm };
})();
