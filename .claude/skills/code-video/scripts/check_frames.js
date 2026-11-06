#!/usr/bin/env node
/*
  코드 영상 점검 스크립트 — 무작위/지정 시점 프레임을 스틸로 뽑고, 렌더 속도와 오류를 확인한다.

  사용법:
    node check_frames.js <영상.html> <출력폴더> [시점들] [--sheet]
      시점들: "2,10.5,33" 처럼 쉼표로. 생략하면 전체 길이에서 고르게 12장 + 무작위 4장
      --sheet: 모든 스틸을 한 장의 비교 시트(sheet.png)로도 묶음

  필요: playwright (require('playwright')), chromium
  영상 HTML 조건: window.renderAt(t) 함수, #ui 오버레이(숨김 처리용), 'msg' 요소에 '클릭' 문구가 뜨면 준비 완료
*/
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');

(async () => {
  const [html, outDir, timesArg] = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const sheet = process.argv.includes('--sheet');
  if (!html || !outDir) { console.log('사용법: node check_frames.js <영상.html> <출력폴더> [시점들] [--sheet]'); process.exit(1); }
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 960, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|net::/.test(m.text())) errs.push(m.text()); });

  const t0 = Date.now();
  await p.goto('file://' + path.resolve(html));
  await p.waitForFunction(() => { const m = document.getElementById('msg'); return m && m.textContent.includes('클릭'); }, null, { timeout: 120000 })
    .catch(e => errs.push('준비 대기 시간 초과: ' + e.message));
  console.log(`미리 그리기: ${Date.now() - t0}ms`);
  await p.evaluate(() => { const u = document.getElementById('ui'); if (u) u.classList.add('hide'); });

  const END = await p.evaluate(() => (typeof END !== 'undefined' ? END : 60));
  let times = timesArg ? timesArg.split(',').map(Number) : [];
  if (!times.length) {
    for (let i = 0; i < 12; i++) times.push(+((i + .5) * END / 12).toFixed(2));
    for (let i = 0; i < 4; i++) times.push(+(Math.random() * END).toFixed(2));
    times.sort((a, b) => a - b);
  }

  // 전체 구간 렌더 속도 (0.25초 간격)
  const perf = await p.evaluate(END => {
    const o = []; let sum = 0, n = 0, worst = 0;
    for (let t = 0; t < END; t += .25) { const a = performance.now(); window.renderAt(t); const d = performance.now() - a; sum += d; n++; worst = Math.max(worst, d); if (d > 120) o.push(t.toFixed(2) + 's:' + d.toFixed(0) + 'ms'); }
    return { avg: sum / n, worst, slow: o };
  }, END);
  console.log(`렌더 평균 ${perf.avg.toFixed(1)}ms/프레임 (24fps 예산 42ms) · 최대 ${perf.worst.toFixed(0)}ms`);
  if (perf.slow.length) console.log('120ms 넘는 프레임(같은 간격으로 반복되면 메모리 정리일 가능성):', perf.slow.slice(0, 20).join(' '));

  const files = [];
  for (const t of times) {
    await p.evaluate(t => window.renderAt(t), t);
    const f = path.join(outDir, `t${String(t).replace('.', '_')}.png`);
    await p.locator('canvas').first().screenshot({ path: f });
    files.push([t, f]);
  }
  console.log(`스틸 ${files.length}장 저장: ${outDir}`);

  if (sheet) {
    const cols = 4, w = 480;
    const htmlSheet = `<body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(${cols},${w}px);gap:4px">` +
      files.map(([t, f]) => `<div style="position:relative"><img src="file://${path.resolve(f)}" style="width:${w}px;display:block"><b style="position:absolute;left:2px;top:2px;background:#fff;font:12px sans-serif;padding:0 3px">${t}s</b></div>`).join('') + '</body>';
    const sp = path.join(outDir, 'sheet.html'); fs.writeFileSync(sp, htmlSheet);
    const q = await b.newPage({ viewport: { width: cols * (w + 4), height: 600 } });
    await q.goto('file://' + path.resolve(sp)); await q.waitForTimeout(400);
    await q.screenshot({ path: path.join(outDir, 'sheet.png'), fullPage: true });
    console.log('비교 시트: ' + path.join(outDir, 'sheet.png'));
  }
  console.log(errs.length ? '오류:\n  ' + errs.join('\n  ') : '오류 없음');
  await b.close();
})();
