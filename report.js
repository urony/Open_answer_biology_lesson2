// בניית טבלאות משוב ודוח PDF/תמונה
(function () {
  var ICON = { ok: "✔", warn: "!", bad: "✖" };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function fmtSecs(s) {
    if (s == null) return "—";
    var m = Math.floor(s / 60), r = s % 60;
    return m + ":" + (r < 10 ? "0" : "") + r + " דקות";
  }

  function badge(st) { return '<span class="badge ' + st + '">' + ICON[st] + "</span>"; }

  // טבלת משוב לתשובה אחת
  function feedbackTable(r) {
    var h = '<div class="score-line">עמדת ב-' + r.ok + " מתוך " + r.total + " קריטריונים</div>";
    h += '<table class="fb"><tbody>';
    r.criteria.forEach(function (c) {
      h += "<tr><td style='width:34px'>" + badge(c.status) + "</td><td><b>" + esc(c.label) +
        '</b><span class="detail">' + esc(c.detail) + "</span></td></tr>";
    });
    return h + "</tbody></table>";
  }

  // השוואה בין התשובה הראשונה לתשובה המתוקנת
  function compareTable(r1, r2) {
    var h = '<div class="score-line">תשובה ראשונה: ' + r1.ok + "/" + r1.total +
      " &nbsp;←&nbsp; תשובה מתוקנת: " + r2.ok + "/" + r2.total + "</div>";
    h += '<table class="fb"><thead><tr><th>קריטריון</th><th>ראשונה</th><th>מתוקנת</th></tr></thead><tbody>';
    r2.criteria.forEach(function (c, i) {
      var a = r1.criteria[i];
      h += "<tr><td><b>" + esc(c.label) + '</b><span class="detail">' + esc(c.detail) + "</span></td><td>" +
        badge(a.status) + "</td><td>" + badge(c.status) + "</td></tr>";
    });
    return h + "</tbody></table>";
  }

  function buildReportHTML(s, results, cfg) {
    var date = new Date().toLocaleDateString("he-IL");
    var t = function (x) { return esc(x || "—"); };
    var parts = [];

    parts.push(
      '<div class="rsec"><h1>דוח תרגול: כתיבת הסבר תהליכי</h1><div class="meta"><b>שם התלמיד/ה:</b> ' +
      esc(s.name) + " &nbsp;|&nbsp; <b>תאריך:</b> " + date + "</div></div>"
    );

    parts.push(
      '<div class="rsec"><h2>1. שאלת ה-CO: תשובה ראשונה מול תשובה מתוקנת</h2>' +
      '<div class="two"><div><h3>תשובה ראשונה (לפני הלימוד) · ' + fmtSecs(s.trial.secs) +
      '</h3><div class="ans">' + t(s.trial.text) + "</div></div>" +
      '<div><h3>תשובה מתוקנת (אחרי הלימוד) · ' + fmtSecs(s.fix.secs) +
      '</h3><div class="ans">' + t(s.fix.text) + "</div></div></div></div>"
    );

    var chain = s.fix.chain.filter(Boolean);
    parts.push(
      '<div class="rsec"><h3>השרשור הסיבתי שהתלמיד/ה בנה/תה</h3><div class="chainline">' +
      esc(window.CONTENT.qCO.chainStart) + " ← " +
      chain.map(esc).join(" ← ") + (chain.length ? " ← " : "") +
      esc(window.CONTENT.qCO.chainEnd) + "</div></div>"
    );

    parts.push(
      '<div class="rsec"><h2>משוב אוטומטי: השוואה</h2>' + compareTable(results.trial, results.fix) +
      '<div class="note">המשוב האוטומטי הוא בדיקה לפי כללים (מילות קישור, כיווניות, שלבים ועוד) ולא הערכה של המורה.</div></div>'
    );

    parts.push(
      '<div class="rsec"><h2>הערכה עצמית</h2>' +
      "<p><b>ציון שהייתי נותן/ת לתשובה הראשונה:</b> " + (s.fix.selfScore ? esc(s.fix.selfScore) + " / 100" : "—") + "</p>" +
      "<p><b>נימוק:</b> " + t(s.fix.selfWhy) + "</p>" +
      "<p><b>מה השתנה בין התשובות:</b> " + t(s.fix.changes) + "</p></div>"
    );

    var pChain = s.practice.chain.filter(Boolean);
    parts.push(
      '<div class="rsec"><h2>2. שאלת דלקת הריאות (תרגול)</h2>' +
      '<div class="meta">' + esc(window.CONTENT.qPN.text) + " · זמן כתיבה: " + fmtSecs(s.practice.secs) + "</div>" +
      '<div class="chainline"><b>שרשור:</b> ' + esc(window.CONTENT.qPN.chainStart) + " ← " +
      pChain.map(esc).join(" ← ") + (pChain.length ? " ← " : "") + esc(s.practice.endText || "—") + "</div>" +
      '<h3>התשובה</h3><div class="ans">' + t(s.practice.text) + "</div></div>"
    );

    parts.push(
      '<div class="rsec"><h2>משוב אוטומטי על שאלת דלקת הריאות</h2>' + feedbackTable(results.practice) + "</div>"
    );

    parts.push(
      '<div class="rsec"><h2>משוב ל' + esc(cfg.teacherName || "מורה") + " על השיעור</h2>" +
      (s.lessonRating ? "<p><b>דירוג:</b> " + "★".repeat(s.lessonRating) + "☆".repeat(5 - s.lessonRating) + "</p>" : "") +
      '<div class="ans">' + t(s.lessonFeedback) + "</div></div>"
    );

    return '<div class="report">' + parts.join("") + "</div>";
  }

  // הופך את הדוח ל-PDF: כל בלוק מצולם בנפרד כדי לא לחתוך טקסט באמצע
  async function buildPDF(host) {
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
    var jsPDF = window.jspdf.jsPDF;
    var pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
    var PW = pdf.internal.pageSize.getWidth();
    var PH = pdf.internal.pageSize.getHeight();
    var M = 28, W = PW - 2 * M, maxY = PH - M;
    var y = M;
    var secs = host.querySelectorAll(".rsec");
    for (var i = 0; i < secs.length; i++) {
      var canvas = await html2canvas(secs[i], { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      var h = (canvas.height / canvas.width) * W;
      if (h <= maxY - M) {
        if (y + h > maxY) { pdf.addPage(); y = M; }
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", M, y, W, h);
        y += h;
      } else {
        // בלוק ארוך מעמוד: חותכים לפרוסות
        var sliceH = Math.floor(((maxY - M) / W) * canvas.width);
        for (var off = 0; off < canvas.height; off += sliceH) {
          var c2 = document.createElement("canvas");
          c2.width = canvas.width;
          c2.height = Math.min(sliceH, canvas.height - off);
          c2.getContext("2d").drawImage(canvas, 0, off, canvas.width, c2.height, 0, 0, canvas.width, c2.height);
          if (y > M) { pdf.addPage(); y = M; }
          var hh = (c2.height / c2.width) * W;
          pdf.addImage(c2.toDataURL("image/jpeg", 0.92), "JPEG", M, y, W, hh);
          y += hh;
        }
      }
    }
    return pdf.output("blob");
  }

  // תמונה אחת ארוכה של כל הדוח
  async function buildPNG(host) {
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
    var canvas = await html2canvas(host.querySelector(".report"), { scale: 1.6, backgroundColor: "#ffffff", useCORS: true });
    return new Promise(function (res) { canvas.toBlob(res, "image/png"); });
  }

  window.Report = {
    esc: esc, fmtSecs: fmtSecs, feedbackTable: feedbackTable, compareTable: compareTable,
    buildReportHTML: buildReportHTML, buildPDF: buildPDF, buildPNG: buildPNG
  };
})();
