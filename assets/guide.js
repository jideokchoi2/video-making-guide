/* 한음쌤의 영상 실습 도우미 — 공용 스크립트
   1) 상단 단계 내비게이션 그리기  2) 복사 버튼  3) 브라우저 저장(실패해도 동작) */
(function () {
  const STEPS = [
    { href: 'index.html', n: '홈', label: '처음' },
    { href: 'flow.html', n: '1', label: 'Flow 시작' },
    { href: 'character.html', n: '2', label: '캐릭터' },
    { href: 'story.html', n: '3', label: '스토리보드' },
    { href: 'scenes.html', n: '4', label: '씬 영상' },
    { href: 'finish.html', n: '5', label: '완성·점검' },
    { href: 'models.html', n: '★', label: '모델 비교' },
  ];
  const here = location.pathname.split('/').pop() || 'index.html';

  // 상단 바: <div id="topbar"></div> 자리에 그림
  const slot = document.getElementById('topbar');
  if (slot) {
    slot.className = 'topbar';
    slot.innerHTML =
      '<div class="topbar-in"><a class="brand" href="index.html">한음쌤의 <b>영상 실습</b> 도우미</a>' +
      '<ul class="steps">' +
      STEPS.map(s =>
        `<li><a href="${s.href}"${s.href === here ? ' aria-current="page"' : ''}><span class="n">${s.n}</span>${s.label}</a></li>`
      ).join('') +
      '</ul></div>';
  }

  // 복사: data-copy="요소 id" 를 가진 버튼
  document.addEventListener('click', async e => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    const src = document.getElementById(btn.dataset.copy);
    const text = src ? (src.value ?? src.innerText) : '';
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement('textarea'); ta.value = text;
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    const old = btn.textContent;
    btn.textContent = '복사됨 ✓'; btn.classList.add('done');
    setTimeout(() => { btn.textContent = old; btn.classList.remove('done'); }, 1400);
  });

  // 저장 도우미 (사생활 보호 모드 등에서 실패해도 페이지는 정상 동작)
  window.Store = {
    get(k, d) { try { const v = localStorage.getItem('vg:' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem('vg:' + k, JSON.stringify(v)); } catch {} },
  };

  // 폼 값 자동 저장/복원: <form data-save="키">
  window.bindForm = function (form, onChange) {
    const key = form.dataset.save;
    const saved = Store.get(key, {});
    for (const el of form.elements) {
      if (!el.name || !(el.name in saved)) continue;
      if (el.type === 'radio' || el.type === 'checkbox') el.checked = [].concat(saved[el.name]).includes(el.value);
      else el.value = saved[el.name];
    }
    const read = () => {
      const data = {};
      for (const el of form.elements) {
        if (!el.name) continue;
        if (el.type === 'radio') { if (el.checked) data[el.name] = el.value; }
        else if (el.type === 'checkbox') { (data[el.name] ||= []); if (el.checked) data[el.name].push(el.value); }
        else data[el.name] = el.value.trim();
      }
      return data;
    };
    const run = () => { const d = read(); Store.set(key, d); onChange(d); };
    form.addEventListener('input', run);
    form.addEventListener('change', run);
    form.addEventListener('submit', e => e.preventDefault());
    run();
  };
})();
