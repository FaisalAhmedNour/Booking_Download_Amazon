import { useEffect, useRef } from 'react';
import guideHtml from './guideHtml.js';

/** Searchable user guide (static content ported from the Electron app). */
export default function Guide() {
  const body = useRef(null);
  const nav = useRef(null);
  const search = useRef(null);

  useEffect(() => {
    const b = body.current;
    const n = nav.current;
    if (!b || !n) return;
    const secs = [...b.querySelectorAll('.gsec')];
    n.innerHTML = secs.map((s) => `<a data-id="${s.id}">${s.querySelector('h2')?.textContent || ''}</a>`).join('');
    n.querySelectorAll('a').forEach((l) => {
      l.onclick = () => {
        const el = document.getElementById(l.dataset.id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
    });
    const onScroll = () => {
      let cur = secs[0]?.id;
      secs.forEach((s) => {
        if (s.offsetTop - b.scrollTop < 140) cur = s.id;
      });
      n.querySelectorAll('a').forEach((l) => l.classList.toggle('on', l.dataset.id === cur));
    };
    b.addEventListener('scroll', onScroll);
    return () => b.removeEventListener('scroll', onScroll);
  }, []);

  const onSearch = (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (!body.current || !nav.current) return;
    const secs = [...body.current.querySelectorAll('.gsec')];
    secs.forEach((s) => {
      const hit = !q || (s.textContent + ' ' + (s.dataset.t || '')).toLowerCase().includes(q);
      s.classList.toggle('hide', !hit);
      s.querySelectorAll('details').forEach((d) => {
        d.open = !!q && d.textContent.toLowerCase().includes(q);
      });
    });
    nav.current.querySelectorAll('a').forEach((l) => {
      const target = document.getElementById(l.dataset.id);
      l.style.display = target && target.classList.contains('hide') ? 'none' : '';
    });
  };

  return (
    <section id="guideView" className="bb-guide guide">
      <aside className="gtoc card">
        <input type="text" ref={search} onChange={onSearch} placeholder="🔎 Search the guide…" />
        <nav ref={nav} id="gNav" />
      </aside>
      <article className="gbody" id="gBody" ref={body} dangerouslySetInnerHTML={{ __html: guideHtml }} />
    </section>
  );
}
