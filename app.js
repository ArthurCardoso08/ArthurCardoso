
  // Fail-safe: a CDN/WebGL error must never leave the portfolio behind the loader.
  window.setTimeout(function () {
    var loader = document.querySelector('.loader');
    if (!loader) return;
    loader.remove();
    document.body.classList.remove('loading');
    document.querySelectorAll('.split-hero .line-mask>span').forEach(function (el) { el.style.transform = 'translateY(0)'; });
    document.querySelectorAll('.hero-in, .hero-in-r').forEach(function (el) { el.style.opacity = '1'; el.style.transform = 'none'; });
    try { if (window.portfolioLenis && window.portfolioLenis.start) window.portfolioLenis.start(); } catch (_) {}
  }, 2500);
  
;

  (() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
    const hasGSAP = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
    const $ = (s, c=document) => c.querySelector(s);
    const $$ = (s, c=document) => [...c.querySelectorAll(s)];

    // Fallback: if libs fail, just show everything
    if (!hasGSAP) {
      document.body.classList.remove('loading');
      $('.loader')?.remove();
      return;
    }
    gsap.registerPlugin(ScrollTrigger);

    /* ---------- Smooth scroll ---------- */
    let lenis = null;
    if (typeof Lenis !== 'undefined' && !reduce) {
      lenis = new Lenis({ duration: 1.15, smoothWheel: true, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
      lenis.stop();
      window.portfolioLenis = lenis;
    }
    $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
      const t = $(a.getAttribute('href')); if (!t) return;
      e.preventDefault();
      lenis ? lenis.scrollTo(t, { offset: -((document.querySelector('.nav')?.offsetHeight || 0) + 12), duration: 1.6 }) : t.scrollIntoView({ behavior: 'smooth' });
    }));
    const toTop = $('.to-top');
    if (toTop) {
      toTop.addEventListener('click', () => lenis ? lenis.scrollTo(0, { duration: 2 }) : scrollTo({ top: 0, behavior: 'smooth' }));
    }

    /* ---------- WebGL particle field ---------- */
    const gl = { morph1: 0, morph2: 0, scroll: 0, mx: 0, my: 0 };
    (function initGL(){
      if (typeof THREE === 'undefined') return;
      try {
      const canvas = $('#gl');
      let renderer;
      try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' }); }
      catch (e) { return; }
      const DPR = Math.min(devicePixelRatio, 1.75);
      renderer.setPixelRatio(DPR);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, .1, 100);
      camera.position.set(0, 0, 6.2);

      const N = innerWidth < 700 ? 7000 : 14000;
      const pos = new Float32Array(N*3), ring = new Float32Array(N*3), wave = new Float32Array(N*3), rnd = new Float32Array(N);
      const side = Math.ceil(Math.sqrt(N));
      for (let i=0;i<N;i++){
        // sphere (fibonacci)
        const y = 1 - (i/(N-1))*2, r = Math.sqrt(1-y*y), th = i*2.399963;
        const R = 1.75;
        pos[i*3] = Math.cos(th)*r*R; pos[i*3+1] = y*R; pos[i*3+2] = Math.sin(th)*r*R;
        // galaxy ring
        const a = Math.random()*Math.PI*2, rr = 1.6 + Math.pow(Math.random(),2)*2.4;
        ring[i*3] = Math.cos(a)*rr; ring[i*3+1] = (Math.random()-.5)*.18*(3.5/rr); ring[i*3+2] = Math.sin(a)*rr;
        // wave grid
        const gx = (i % side)/side - .5, gz = Math.floor(i/side)/side - .5;
        wave[i*3] = gx*12; wave[i*3+1] = 0; wave[i*3+2] = gz*9;
        rnd[i] = Math.random();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
      geo.setAttribute('aRing', new THREE.BufferAttribute(ring,3));
      geo.setAttribute('aWave', new THREE.BufferAttribute(wave,3));
      geo.setAttribute('aRand', new THREE.BufferAttribute(rnd,1));

      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uTime:{value:0}, uM1:{value:0}, uM2:{value:0}, uPx:{value:DPR}, uMouse:{value:new THREE.Vector2()}, uAccent:{value:new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--red').trim() || '#ff2a2a')} },
        vertexShader: `
          uniform float uTime,uM1,uM2,uPx; uniform vec2 uMouse; uniform vec3 uAccent;
          attribute vec3 aRing; attribute vec3 aWave; attribute float aRand;
          varying float vR; varying float vA;
          void main(){
            vec3 s = position;
            float n = sin(s.x*2.2+uTime*.9)*cos(s.y*2.4+uTime*.7)*sin(s.z*2.0+uTime*.6);
            s += normalize(s)*n*.22;
            vec3 g = aRing;
            float ang = uTime*.08*(2.6/length(aRing.xz));
            g.xz = mat2(cos(ang),-sin(ang),sin(ang),cos(ang))*g.xz;
            vec3 w = aWave;
            w.y = sin(w.x*.9+uTime*1.1)*.35 + cos(w.z*1.1+uTime*.8)*.3 - 1.2;
            vec3 p = mix(s, g, smoothstep(0.,1.,uM1));
            p = mix(p, w, smoothstep(0.,1.,uM2));
            p.xy += uMouse*.25*(1.-uM2);
            vec4 mv = modelViewMatrix*vec4(p,1.);
            gl_Position = projectionMatrix*mv;
            gl_PointSize = (1.4+aRand*2.4)*uPx*(5./-mv.z);
            vR = aRand;
            vA = .35+.65*smoothstep(-.4,1.,n+aRand*.6);
          }`,
        fragmentShader: `
          uniform vec3 uAccent;
          varying float vR; varying float vA;
          void main(){
            vec2 c = gl_PointCoord-.5; float d = length(c);
            if(d>.5) discard;
            float a = smoothstep(.5,0.,d);
            vec3 red = uAccent, white = vec3(1.,.93,.9);
            vec3 col = mix(red, white, step(.86, vR));
            gl_FragColor = vec4(col, a*vA*.8);
          }`
      });
      const pts = new THREE.Points(geo, mat);
      const group = new THREE.Group(); group.add(pts); scene.add(group);

      function size(){
        const w = innerWidth, h = innerHeight;
        renderer.setSize(w,h,false); camera.aspect = w/h; camera.updateProjectionMatrix();
        group.position.x = w > 980 ? 1.6 : 0;
      }
      size(); addEventListener('resize', size);
      let tx=0, ty=0;
      addEventListener('pointermove', e => { gl.mx = (e.clientX/innerWidth-.5)*2; gl.my = -(e.clientY/innerHeight-.5)*2; });
      const clock = new THREE.Clock();
      gsap.ticker.add(() => {
        const t = clock.getElapsedTime();
        mat.uniforms.uTime.value = reduce ? 0 : t;
        mat.uniforms.uM1.value = gl.morph1; mat.uniforms.uM2.value = gl.morph2;
        const accent = getComputedStyle(document.documentElement).getPropertyValue('--red').trim();
        if (accent) mat.uniforms.uAccent.value.set(accent);
        tx += (gl.mx - tx)*.05; ty += (gl.my - ty)*.05;
        mat.uniforms.uMouse.value.set(tx, ty);
        group.rotation.y = t*.06 + gl.scroll*Math.PI*1.4;
        group.rotation.x = .25 + gl.morph1*.35 - gl.morph2*.25 + ty*.1;
        renderer.render(scene, camera);
      });
      gl.group = group;
      } catch (error) {
        // WebGL may be unavailable on some devices; the rest of the portfolio still works.
        console.warn('Galaxy background unavailable:', error);
      }
    })();

    /* ---------- Split helpers ---------- */
    const manifesto = $('.words');
    if (manifesto) manifesto.innerHTML = manifesto.textContent.trim().split(/\s+/).map(w => {
      const hl = /primeiro|vendedor|segundos|exatamente/i.test(w);
      return `<span class="w${hl?' hl':''}">${w}</span>`;
    }).join(' ');

    /* ---------- Preloader → intro ---------- */
    const cnt = $('.cnt'), counter = { v: 0 };
    const intro = gsap.timeline({ paused: true });
    gsap.set('.split-hero .line-mask>span', { yPercent: 110 });
    gsap.set('.hero-in', { opacity: 0, y: 24 });
    gsap.set('.hero-in-r', { opacity: 0, scale: .92, rotate: 3 });
    intro
      .to('.loader-count, .loader-top, .loader-bot', { yPercent: -40, opacity: 0, duration: .6, ease: 'power3.in' })
      .to('.loader', { clipPath: 'inset(0 0 100% 0)', duration: 1, ease: 'expo.inOut' }, '-=.15')
      .to('.split-hero .line-mask>span', { yPercent: 0, duration: 1.2, stagger: .09, ease: 'expo.out' }, '-=.45')
      .to('.hero-in', { opacity: 1, y: 0, duration: 1, stagger: .08, ease: 'expo.out' }, '-=.9')
      .to('.hero-in-r', { opacity: 1, scale: 1, rotate: 0, duration: 1.4, ease: 'expo.out' }, '-=1.1')
      .add(() => { document.body.classList.remove('loading'); $('.loader').remove(); lenis?.start(); ScrollTrigger.refresh(); });
    gsap.set('.loader', { clipPath: 'inset(0 0 0% 0)' });
    gsap.to(counter, {
      v: 100, duration: reduce ? .2 : 2.1, ease: 'power2.inOut',
      onUpdate(){ cnt.textContent = String(Math.round(counter.v)).padStart(3,'0'); $('.loader-bar').style.width = counter.v + '%'; },
      onComplete(){ intro.play(); }
    });

    /* ---------- Scroll: global progress + GL morph ---------- */
    const pctEl = $('.hud-pct'), prog = $('.progress');
    ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate(self){
        prog.style.transform = `scaleX(${self.progress})`;
        pctEl.textContent = String(Math.round(self.progress*100)).padStart(3,'0');
        gl.scroll = self.progress;
      }
    });
    // sphere -> galaxy ring (manifesto → services)
    gsap.to(gl, { morph1: 1, ease: 'none', scrollTrigger: { trigger: 'body', start: 'top top', end: '35% top', scrub: 1 } });
    // A segunda fase transforma o anel em uma onda de partículas ao avançar pela página.
    gsap.to(gl, { morph2: 1, ease: 'none', scrollTrigger: { trigger: 'body', start: '35% top', end: '85% top', scrub: 1 } });
    // move field to center after hero
    ScrollTrigger.create({ trigger: '.manifesto', start: 'top bottom', end: 'top top', scrub: 1,
      onUpdate: s => { if (gl.group && innerWidth > 980) gl.group.position.x = 1.6*(1-s.progress); } });

    /* ---------- Hero parallax out ---------- */
    gsap.to('.hero-grid > div:first-child', { yPercent: -18, opacity: .2, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.portrait', { yPercent: 14, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.portrait-card img', { yPercent: -12, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.scroll-cue', { opacity: 0, scrollTrigger: { trigger: '.hero', start: 'top top', end: '15% top', scrub: true } });

    /* ---------- Marquee with scroll velocity ---------- */
    const track = $('.marquee-track'), item = $('.marquee-item');
    for (let i=0;i<3;i++) track.appendChild(item.cloneNode(true));
    let mx = 0, dir = 1, vel = 0;
    ScrollTrigger.create({ onUpdate: s => { dir = s.direction; vel = Math.min(Math.abs(s.getVelocity())/120, 30); } });
    gsap.ticker.add(() => {
      const w = item.offsetWidth;
      mx -= (1 + vel) * dir * (reduce ? 0 : 1);
      vel *= .92;
      if (mx <= -w) mx += w; if (mx > 0) mx -= w;
      track.style.transform = `translate3d(${mx}px,0,0) skewX(${-vel*dir*.35}deg)`;
    });

    /* ---------- Manifesto word scrub ---------- */
    gsap.to('.words .w', { opacity: 1, stagger: .1, ease: 'none',
      scrollTrigger: { trigger: '.manifesto', start: 'top 70%', end: 'bottom 60%', scrub: 1 } });

    /* ---------- Generic reveals ---------- */
    $$('.split').forEach(el => {
      gsap.from($$('.line-mask>span', el), { yPercent: 110, duration: 1.2, stagger: .1, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 85%' } });
    });
    gsap.set('.reveal', { opacity: 0 });
    ScrollTrigger.batch('.reveal', {
      start: 'top 88%',
      onEnter: b => gsap.fromTo(b, { opacity: 0, y: 40, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1, stagger: .1, ease: 'expo.out', overwrite: true })
    });

    // counters
    $$('.count').forEach(el => {
      const to = +el.dataset.to, o = { v: 0 };
      ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true,
        onEnter: () => gsap.to(o, { v: to, duration: 1.8, ease: 'power3.out', onUpdate: () => el.textContent = Math.round(o.v) }) });
    });

    // services 3D entrance
    gsap.from('.svc', { rotateX: 25, transformPerspective: 900, transformOrigin: '50% 100%', stagger: .12, duration: 1.3, ease: 'expo.out',
      scrollTrigger: { trigger: '.svc-grid', start: 'top 85%' } });

    /* ---------- Horizontal portfolio ---------- */
    const mm = gsap.matchMedia();
    mm.add('(min-width: 981px)', () => {
      const tr = $('.work-track');
      const dist = () => tr.scrollWidth - innerWidth;
      const tween = gsap.to(tr, { x: () => -dist(), ease: 'none',
        scrollTrigger: { trigger: '.work', start: 'top top', end: () => '+=' + dist(), pin: '.work-pin', scrub: 1, invalidateOnRefresh: true, anticipatePin: 1 } });
      $$('.project .bg').forEach(bg => {
        gsap.fromTo(bg, { xPercent: -8 }, { xPercent: 8, ease: 'none',
          scrollTrigger: { trigger: bg.parentElement, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
      });
      $$('.project').forEach(p => {
        gsap.from(p, { scale: .86, rotateY: -14, transformPerspective: 1200, opacity: .3, ease: 'none',
          scrollTrigger: { trigger: p, containerAnimation: tween, start: 'left 100%', end: 'left 55%', scrub: true } });
      });
    });

    /* ---------- Process line ---------- */
    const steps = $$('.step');
    gsap.to('.proc-line span', { scaleX: 1, ease: 'none',
      scrollTrigger: { trigger: '.proc', start: 'top 75%', end: 'bottom 55%', scrub: 1,
        onUpdate: s => steps.forEach((st,i) => st.classList.toggle('on', s.progress >= i/steps.length + .02)) } });
    gsap.from('.step', { opacity: 0, y: 30, stagger: .12, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.proc', start: 'top 80%' } });
    // mobile: activate steps individually
    mm.add('(max-width: 980px)', () => {
      steps.forEach(st => ScrollTrigger.create({ trigger: st, start: 'top 75%', onEnter: () => st.classList.add('on') }));
    });

    /* ---------- CTA giant text ---------- */
    gsap.fromTo('.cta-giant', { scale: .55, opacity: .2, letterSpacing: '.05em' }, { scale: 1, opacity: 1, letterSpacing: '-.045em', ease: 'none',
      scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'center center', scrub: 1 } });
    gsap.fromTo('.cta-ring', { scale: .4 }, { scale: 1.2, ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom bottom', scrub: true } });

    /* ---------- Nav hide on scroll down ---------- */
    const nav = $('.nav');
    ScrollTrigger.create({ start: 120, end: 'max', onUpdate: s => nav.classList.toggle('hide', s.direction === 1 && s.scroll() > 400) });

    /* ---------- Side index active ---------- */
    const links = $$('.side-index a');
    $$('[data-sec]').forEach(sec => {
      ScrollTrigger.create({ trigger: sec, start: 'top center', end: 'bottom center',
        onToggle: s => { if (s.isActive) links.forEach(l => l.classList.toggle('active', l.dataset.sec === sec.id)); } });
    });

    /* ---------- Clock ---------- */
    const tEl = $('.hud-time');
    const tick = () => tEl.textContent = new Intl.DateTimeFormat(document.documentElement.lang || 'pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date());
    tick(); setInterval(tick, 1000);

    /* ---------- Pointer interactions (desktop) ---------- */
    if (fine && !reduce) {
      const dot = $('.cursor'), ring = $('.cursor-ring'), lbl = $('.cursor-ring .lbl');
      const qd = { x: gsap.quickTo(dot, 'x', { duration: .08 }), y: gsap.quickTo(dot, 'y', { duration: .08 }) };
      const qr = { x: gsap.quickTo(ring, 'x', { duration: .45, ease: 'power3' }), y: gsap.quickTo(ring, 'y', { duration: .45, ease: 'power3' }) };
      addEventListener('pointermove', e => { qd.x(e.clientX); qd.y(e.clientY); qr.x(e.clientX); qr.y(e.clientY); });
      const cursorLabel = el => {
        const t = window.portfolioT || {};
        if (el.dataset.cursorI18n) return t[el.dataset.cursorI18n] || el.dataset.cursorI18n;
        if (el.dataset.cursor) return el.dataset.cursor;
        return el.getAttribute('target') === '_blank' ? (t.cursorOpen || 'ABRIR') : (t.cursorGo || 'IR');
      };
      $$('a, button, [data-cursor], [data-cursor-i18n]').forEach(el => {
        el.addEventListener('pointerenter', () => { ring.classList.add('hover'); lbl.textContent = cursorLabel(el); });
        el.addEventListener('pointerleave', () => ring.classList.remove('hover'));
      });

      // magnetic
      $$('.magnetic').forEach(el => {
        const xt = gsap.quickTo(el, 'x', { duration: .6, ease: 'elastic.out(1,.4)' });
        const yt = gsap.quickTo(el, 'y', { duration: .6, ease: 'elastic.out(1,.4)' });
        el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); xt((e.clientX - r.left - r.width/2)*.3); yt((e.clientY - r.top - r.height/2)*.4); });
        el.addEventListener('pointerleave', () => { xt(0); yt(0); });
      });

      // portrait tilt
      const card = $('[data-tilt]');
      const rx = gsap.quickTo(card, 'rotateX', { duration: .8, ease: 'power3' });
      const ry = gsap.quickTo(card, 'rotateY', { duration: .8, ease: 'power3' });
      $('.portrait').addEventListener('pointermove', e => { const r = card.getBoundingClientRect(); ry(((e.clientX-r.left)/r.width-.5)*16); rx(-((e.clientY-r.top)/r.height-.5)*16); });
      $('.portrait').addEventListener('pointerleave', () => { rx(0); ry(0); });
      // chips parallax
      addEventListener('pointermove', e => {
        const x = (e.clientX/innerWidth-.5), y = (e.clientY/innerHeight-.5);
        gsap.to('.chip-1', { x: x*-22, y: y*-18, duration: 1, ease: 'power3' });
        gsap.to('.chip-2', { x: x*26, y: y*20, duration: 1, ease: 'power3' });
      });

      // service spotlight
      $$('.svc').forEach(c => c.addEventListener('pointermove', e => {
        const r = c.getBoundingClientRect();
        c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px');
      }));
    }

    addEventListener('load', () => ScrollTrigger.refresh());
  })();
  
;

(function () {
  if (window === window.top) return;

  const allowedParentOrigins = ["https://www.perplexity.ai","https://perplexity.ai","https://testing.perplexity.ai","https://staging.perplexity.ai","https://*.preview.i.perplexity.ai","http://perplexity.localhost","http://localhost:1420","http://127.0.0.1:1420","http://localhost:3000","http://127.0.0.1:3000","http://localhost:5173","http://127.0.0.1:5173"];
  const MAX_FONT_BYTES = 500 * 1024;
  const MAX_TOTAL_FONT_BYTES = 2 * 1024 * 1024;
  const DEFAULT_LINE_HEIGHT = 16;
  let scrollForwarding = false;
  let scrollRaf = 0;
  let trustedTopOrigin = null;

  // Allow entries like "https://*.preview.i.perplexity.ai" — the wildcard
  // matches a single DNS label (no dots), so "https://*.foo" cannot stretch
  // across multiple labels.
  function matchesAllowedOrigin(origin) {
    if (!origin) return false;
    for (const entry of allowedParentOrigins) {
      if (!entry.includes("*")) {
        if (entry === origin) return true;
        continue;
      }
      const pattern = new RegExp(
        "^" +
          entry.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^.]+") +
          "$",
      );
      if (pattern.test(origin)) return true;
    }
    return false;
  }

  // Trust decision: when the sender is same-origin-visible (event.origin is a
  // real origin like https://www.perplexity.ai) we trust event.origin directly.
  // When event.origin is "null" (opaque broker srcdoc), we fall back to the
  // broker's stamped `parentOrigin` to identify the top window. The fallback
  // is claim-only — we rely on the browser's native `targetOrigin` enforcement
  // on the response path (see postToTrustedTop) to ensure replies can't be
  // delivered to anyone but the actual top window of that claimed origin.
  function getTrustedParentOrigin(event) {
    const forwardedParentOrigin =
      typeof event.data.parentOrigin === "string" ? event.data.parentOrigin : null;
    const parentOrigin = event.origin === "null" ? forwardedParentOrigin : event.origin;
    return matchesAllowedOrigin(parentOrigin) ? parentOrigin : null;
  }

  // All responses go to window.top with targetOrigin = the allowlisted origin.
  // An attacker that iframes us inside their own null-origin broker can claim
  // any parentOrigin they like, but the browser will drop the reply whenever
  // the real top's origin doesn't match — so the screenshot never leaves.
  function postToTrustedTop(message) {
    if (!trustedTopOrigin) return;
    try {
      window.top.postMessage(message, trustedTopOrigin);
    } catch (_error) {}
  }

  function inlineAll(original, clone) {
    if (original.nodeType !== 1 || clone.nodeType !== 1) return;

    try {
      const computedStyle = getComputedStyle(original);
      // cssText on a computed style is the serialized declaration in modern
      // Chromium/Safari — a single read beats enumerating ~400 longhand
      // properties. Firefox returns "" here, so we fall back on empty.
      const serialized = computedStyle.cssText;
      if (serialized) {
        clone.style.cssText = serialized;
      } else {
        const parts = new Array(computedStyle.length);
        for (let index = 0; index < computedStyle.length; index += 1) {
          const property = computedStyle[index];
          parts[index] = `${property}:${computedStyle.getPropertyValue(property)};`;
        }
        clone.style.cssText = parts.join("");
      }
    } catch (_error) {}

    const originalChildren = original.children;
    const clonedChildren = clone.children;
    for (
      let index = 0;
      index < originalChildren.length && index < clonedChildren.length;
      index += 1
    ) {
      inlineAll(originalChildren[index], clonedChildren[index]);
    }
  }

  function extractFontUrl(srcValue) {
    const matches = [
      ...srcValue.matchAll(
        /url\(["']?([^"')]+)["']?\)(?:\s*format\(["']?([^"')]+)["']?\))?/gi,
      ),
    ];
    if (matches.length === 0) return null;
    const woff2 = matches.find((m) => m[2] && m[2].toLowerCase().includes("woff2"));
    if (woff2) return woff2[1];
    const woff = matches.find((m) => m[2] && m[2].toLowerCase().includes("woff"));
    if (woff) return woff[1];
    return matches[0][1];
  }

  // Cache resolved font URL -> data URI across captures. Fonts on a page
  // essentially never change, and a batch run emits multiple captures back to
  // back — without this we'd refetch + re-base64 every time.
  const fontDataUriCache = new Map();
  const SRC_DECLARATION_RE = /src\s*:\s*[^;}]+/i;

  async function fetchAsDataUri(url) {
    if (fontDataUriCache.has(url)) return fontDataUriCache.get(url);
    let dataUri = null;
    try {
      const response = await fetch(url, { mode: "cors", credentials: "omit" });
      if (response.ok) {
        const blob = await response.blob();
        if (blob.size <= MAX_FONT_BYTES) {
          dataUri = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () =>
              resolve(typeof reader.result === "string" ? reader.result : null);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
        }
      }
    } catch (_error) {
      dataUri = null;
    }
    fontDataUriCache.set(url, dataUri);
    return dataUri;
  }

  function collectFontFaceRuleTexts() {
    const rules = [];
    for (const sheet of document.styleSheets) {
      let cssRules;
      try {
        cssRules = sheet.cssRules;
      } catch (_error) {
        continue;
      }
      if (!cssRules) continue;
      for (const rule of cssRules) {
        const cssText = rule.cssText || "";
        if (cssText.startsWith("@font-face")) rules.push(cssText);
      }
    }
    return rules;
  }

  async function buildInlinedFontCss() {
    const ruleTexts = collectFontFaceRuleTexts();
    if (ruleTexts.length === 0) return null;

    const resolved = ruleTexts.map((cssText) => {
      if (!SRC_DECLARATION_RE.test(cssText)) return null;
      const srcMatch = cssText.match(/src\s*:\s*([^;}]+)[;}]/i);
      if (!srcMatch) return null;
      const url = extractFontUrl(srcMatch[1]);
      if (!url) return null;
      try {
        return { cssText, url: new URL(url, document.baseURI).href };
      } catch (_error) {
        return null;
      }
    });

    const dataUris = await Promise.all(
      resolved.map((entry) => (entry ? fetchAsDataUri(entry.url) : Promise.resolve(null))),
    );

    const inlined = [];
    let totalBytes = 0;
    for (let index = 0; index < resolved.length; index += 1) {
      const entry = resolved[index];
      const dataUri = dataUris[index];
      if (!entry || !dataUri) continue;
      const approxBytes = dataUri.length * 0.75;
      if (totalBytes + approxBytes > MAX_TOTAL_FONT_BYTES) break;
      totalBytes += approxBytes;
      inlined.push(entry.cssText.replace(SRC_DECLARATION_RE, `src: url("${dataUri}")`));
    }
    return inlined.length > 0 ? inlined.join("\n") : null;
  }

  function stripExternal(clone) {
    const images = clone.querySelectorAll("img");
    for (let index = 0; index < images.length; index += 1) {
      const src = images[index].getAttribute("src");
      if (src && !src.startsWith("data:")) images[index].removeAttribute("src");
    }

    const elements = clone.querySelectorAll("*");
    for (let index = 0; index < elements.length; index += 1) {
      const style = elements[index].style.cssText;
      if (style && style.includes("url(")) {
        elements[index].style.cssText = style.replace(
          /url\(["']?(?!data:)[^)"']*["']?\)/gi,
          "none",
        );
      }
    }
  }

  function emitScroll() {
    scrollRaf = 0;
    if (!scrollForwarding) return;
    postToTrustedTop({
      type: "INLINE_EDIT_SCROLL",
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    });
  }

  window.addEventListener(
    "scroll",
    function () {
      if (!scrollForwarding || scrollRaf) return;
      scrollRaf = requestAnimationFrame(emitScroll);
    },
    { passive: true, capture: true },
  );

  async function handleCaptureRequest(event) {
    const requestId = event.data.requestId;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const width = window.innerWidth;
    const height = window.innerHeight;

    function postResult(dataUrl) {
      postToTrustedTop({
        type: "INLINE_EDIT_SCREENSHOT_RESULT",
        requestId,
        dataUrl,
        scrollX,
        scrollY,
      });
    }

    try {
      // Wait for any pending web fonts to resolve so both inline metrics and
      // the @font-face inlining below see the same loaded faces.
      if (document.fonts && document.fonts.ready) {
        try {
          await document.fonts.ready;
        } catch (_error) {}
      }

      const clone = document.documentElement.cloneNode(true);
      inlineAll(document.documentElement, clone);

      const removedNodes = clone.querySelectorAll("script,link[rel=\"stylesheet\"],style");
      for (let index = 0; index < removedNodes.length; index += 1) {
        removedNodes[index].remove();
      }

      stripExternal(clone);

      // Re-embed web fonts as data-URI @font-face rules so the SVG rasterizer
      // can resolve them — external font URLs aren't fetched during
      // foreignObject rendering, which would otherwise force a fallback face
      // and change text metrics.
      const inlinedFontCss = await buildInlinedFontCss();
      if (inlinedFontCss) {
        const styleEl = document.createElement("style");
        styleEl.textContent = inlinedFontCss;
        const head = clone.querySelector("head");
        if (head) head.appendChild(styleEl);
        else clone.insertBefore(styleEl, clone.firstChild);
      }

      const html = new XMLSerializer().serializeToString(clone);
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
        '<foreignObject width="100%" height="100%">' +
        `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;overflow:hidden">` +
        `<div style="position:relative;left:-${scrollX}px;top:-${scrollY}px">` +
        html +
        "</div></div></foreignObject></svg>";
      const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      const image = new Image();
      image.onload = function () {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(image, 0, 0);
        postResult(canvas.toDataURL("image/png"));
      };
      image.onerror = function () {
        postResult(null);
      };
      image.src = svgUrl;
    } catch (_error) {
      postResult(null);
    }
  }

  window.addEventListener("message", function (event) {
    if (!event.data) return;
    // Only accept messages from the direct parent frame. Blocks sibling /
    // unrelated-window postMessage senders that could otherwise reach us.
    if (event.source !== window.parent) return;

    const trustedParentOrigin = getTrustedParentOrigin(event);
    if (!trustedParentOrigin) return;
    trustedTopOrigin = trustedParentOrigin;

    if (event.data.type === "INLINE_EDIT_SCROLL_START") {
      scrollForwarding = true;
      emitScroll();
      return;
    }

    if (event.data.type === "INLINE_EDIT_SCROLL_STOP") {
      scrollForwarding = false;
      if (scrollRaf) cancelAnimationFrame(scrollRaf);
      scrollRaf = 0;
      return;
    }

    if (event.data.type === "INLINE_EDIT_SCROLL_BY") {
      const { deltaX, deltaY, deltaMode } = event.data;
      if (!scrollForwarding || !Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return;
      if (deltaMode !== 0 && deltaMode !== 1 && deltaMode !== 2) return;
      const lineHeight =
        parseFloat(getComputedStyle(document.documentElement).lineHeight) || DEFAULT_LINE_HEIGHT;
      const scaleX = deltaMode === 1 ? lineHeight : deltaMode === 2 ? window.innerWidth : 1;
      const scaleY = deltaMode === 1 ? lineHeight : deltaMode === 2 ? window.innerHeight : 1;
      // The selection overlay receives the wheel event instead of this iframe.
      // Instant scrolling preserves trackpad deltas even on smooth-scroll sites.
      window.scrollBy({ left: deltaX * scaleX, top: deltaY * scaleY, behavior: "instant" });
      emitScroll();
      return;
    }

    if (event.data.type !== "INLINE_EDIT_CAPTURE_REQUEST") return;

    handleCaptureRequest(event);
  });
})();



;

(() => {
  const WA_NUMBER = '5538992188316';
  const translations = {
    pt: {
      loaderTop:'Portfólio — 2026', loaderBot:'Inicializando experiência', hudOnline:'Online', hudScroll:'Scroll',
      sideIndexAria:'Índice de seções', sideHome:'Início', sideProjects:'Projetos', sideAbout:'Sobre', sideContact:'Contato',
      cursorOpen:'ABRIR', cursorView:'VER', cursorGo:'IR',
      ariaHome:'Arthur Cardoso — início', navMain:'Principal', navProjects:'Projetos', navAbout:'Sobre', navCta:'Vamos conversar',
      ariaCustom:'Personalização', ariaTheme:'Cor do tema', themeRed:'Vermelho', themeViolet:'Violeta', themeBlue:'Azul escuro', themePink:'Rosa', themeGreen:'Verde',
      available:'Disponível para novos projetos', heroL1:'Ideias que', heroL2:'ganham vida.', heroL3:'Projetos com', heroL4:'personalidade.',
      heroCopy:'Eu sou <strong>Arthur Cardoso</strong>, desenvolvedor web. Transformo ideias em experiências digitais com identidade visual, interação e código.',
      viewProjects:'Ver portfólio', contact:'Entrar em contato',
      metaA1:'Web', metaA2:'Desenvolvimento', metaB1:'UI', metaB2:'Design de interface', metaC1:'Meu', metaC2:'Estilo próprio',
      chipOnline:'✦ Online', chipReply:'Respondo em poucas horas', chip2Title:'Web developer', chip2Text:'Design · Interação · Código', scrollCue:'ROLE',
      imgPortrait:'Retrato de Arthur Neves Cardoso',
      mq1:'Desenvolvimento web', mq2:'Criatividade', mq3:'Experiências digitais', mq4:'Código',
      projectsLabel:'Projetos selecionados', projectsTitle:'Projetos que <span class="red">ganham vida.</span>',
      projectsIntro:'Uma seleção de experiências digitais que desenvolvi.', hint:'Continue rolando', liveTag:'No ar', stackMenu:'Cardápio',
      hotdogDesc:'Cardápio digital com pedidos integrados ao WhatsApp e experiência simples para o cliente.',
      pizzaDesc:'Site de delivery para pizzas, lanches e bebidas, com navegação direta e pedidos pelo WhatsApp.', visitSite:'Visitar site',
      aboutTag:'Sobre mim', aboutBig1:'Eu desenvolvo', aboutBig2:'experiências', aboutBig3:'digitais.',
      aboutIntro:'Sou <strong>Arthur Neves Cardoso</strong>, desenvolvedor web.',
      aboutCopy:'Gosto de unir design, código e animações para transformar ideias em experiências digitais funcionais e visualmente marcantes.',
      statResp:'Responsivo', statLoad:'Para carregar', statSell:'Página vendendo', statYour:'SUA', skillAnim:'Animações', skillAI:'IA',
      ctaTag:'Seu próximo projeto', ctaG1:'Vamos', ctaG2:'criar.', ctaSr:'Vamos criar',
      contactCopy:'Tem uma ideia ou projeto em mente? Vamos conversar e tirar do papel.', contactButton:'Falar sobre um projeto', instagram:'Ver Instagram',
      footerCopy:'Desenvolvimento web · Design de interface · Interações.', footContact:'Contato', ariaSocial:'Redes sociais', ariaTech:'Tecnologias',
      footNav:'Navegação', footServices:'Serviços', footPortfolio:'Portfólio', footProcess:'Processo',
      footCopy:'© 2026 Arthur Neves Cardoso. Todos os direitos reservados.', footPrivacy:'Política de Privacidade',
      docTitle:'Arthur Cardoso — Portfólio', metaDesc:'Arthur Neves Cardoso — desenvolvimento web, interfaces interativas e projetos digitais autorais.', ogLocale:'pt_BR',
      waNav:'Olá Arthur! Vi seu portfólio e quero conversar sobre um projeto.',
      waHero:'Olá Arthur! Quero criar uma landing page.',
      waCta:'Olá Arthur! Quero conversar sobre um projeto web.'
    },
    en: {
      loaderTop:'Portfolio — 2026', loaderBot:'Initializing experience', hudOnline:'Online', hudScroll:'Scroll',
      sideIndexAria:'Section index', sideHome:'Home', sideProjects:'Projects', sideAbout:'About', sideContact:'Contact',
      cursorOpen:'OPEN', cursorView:'VIEW', cursorGo:'GO',
      ariaHome:'Arthur Cardoso — home', navMain:'Main', navProjects:'Projects', navAbout:'About', navCta:'Let’s talk',
      ariaCustom:'Customization', ariaTheme:'Theme color', themeRed:'Red', themeViolet:'Violet', themeBlue:'Dark blue', themePink:'Pink', themeGreen:'Green',
      available:'Available for new projects', heroL1:'Ideas that', heroL2:'come alive.', heroL3:'Projects with', heroL4:'personality.',
      heroCopy:'I’m <strong>Arthur Cardoso</strong>, a web developer. I turn ideas into digital experiences through visual identity, interaction, and code.',
      viewProjects:'View projects', contact:'Get in touch',
      metaA1:'Web', metaA2:'Development', metaB1:'UI', metaB2:'Interface design', metaC1:'My', metaC2:'Own style',
      chipOnline:'✦ Online', chipReply:'I reply within a few hours', chip2Title:'Web developer', chip2Text:'Design · Interaction · Code', scrollCue:'ROLE',
      imgPortrait:'Portrait of Arthur Neves Cardoso',
      mq1:'Web development', mq2:'Creativity', mq3:'Digital experiences', mq4:'Code',
      projectsLabel:'Selected projects', projectsTitle:'Projects that <span class="red">come alive.</span>',
      projectsIntro:'A selection of digital experiences I have built.', hint:'Keep scrolling', liveTag:'Live', stackMenu:'Menu',
      hotdogDesc:'Digital menu with WhatsApp ordering and a simple customer experience.',
      pizzaDesc:'Delivery website for pizza, snacks, and drinks, with straightforward navigation and WhatsApp orders.', visitSite:'Visit website',
      aboutTag:'About me', aboutBig1:'I build', aboutBig2:'digital', aboutBig3:'experiences.',
      aboutIntro:'I’m <strong>Arthur Neves Cardoso</strong>, a web developer.',
      aboutCopy:'I combine design, code, and animation to turn ideas into functional, visually distinctive digital experiences.',
      statResp:'Responsive', statLoad:'To load', statSell:'Page that sells', statYour:'YOUR', skillAnim:'Animations', skillAI:'AI',
      ctaTag:'Your next project', ctaG1:'Let’s', ctaG2:'create.', ctaSr:'Let’s create',
      contactCopy:'Have an idea or project in mind? Let’s talk and bring it to life.', contactButton:'Discuss a project', instagram:'View Instagram',
      footerCopy:'Web development · Interface design · Interactions.', footContact:'Contact', ariaSocial:'Social networks', ariaTech:'Technologies',
      footNav:'Navigation', footServices:'Services', footPortfolio:'Portfolio', footProcess:'Process',
      footCopy:'© 2026 Arthur Neves Cardoso. All rights reserved.', footPrivacy:'Privacy Policy',
      docTitle:'Arthur Cardoso — Portfolio', metaDesc:'Arthur Neves Cardoso — web development, interactive interfaces, and original digital projects.', ogLocale:'en_US',
      waNav:'Hi Arthur! I saw your portfolio and want to talk about a project.',
      waHero:'Hi Arthur! I want to create a landing page.',
      waCta:'Hi Arthur! I want to talk about a web project.'
    },
    es: {
      loaderTop:'Portafolio — 2026', loaderBot:'Iniciando experiencia', hudOnline:'En línea', hudScroll:'Desplazar',
      sideIndexAria:'Índice de secciones', sideHome:'Inicio', sideProjects:'Proyectos', sideAbout:'Sobre mí', sideContact:'Contacto',
      cursorOpen:'ABRIR', cursorView:'VER', cursorGo:'IR',
      ariaHome:'Arthur Cardoso — inicio', navMain:'Principal', navProjects:'Proyectos', navAbout:'Sobre mí', navCta:'Hablemos',
      ariaCustom:'Personalización', ariaTheme:'Color del tema', themeRed:'Rojo', themeViolet:'Violeta', themeBlue:'Azul oscuro', themePink:'Rosa', themeGreen:'Verde',
      available:'Disponible para nuevos proyectos', heroL1:'Ideas que', heroL2:'cobran vida.', heroL3:'Proyectos con', heroL4:'personalidad.',
      heroCopy:'Soy <strong>Arthur Cardoso</strong>, desarrollador web. Transformo ideas en experiencias digitales con identidad visual, interacción y código.',
      viewProjects:'Ver proyectos', contact:'Contactar',
      metaA1:'Web', metaA2:'Desarrollo', metaB1:'UI', metaB2:'Diseño de interfaces', metaC1:'Mi', metaC2:'Estilo propio',
      chipOnline:'✦ En línea', chipReply:'Respondo en pocas horas', chip2Title:'Desarrollador web', chip2Text:'Diseño · Interacción · Código', scrollCue:'ROL',
      imgPortrait:'Retrato de Arthur Neves Cardoso',
      mq1:'Desarrollo web', mq2:'Creatividad', mq3:'Experiencias digitales', mq4:'Código',
      projectsLabel:'Proyectos seleccionados', projectsTitle:'Proyectos que <span class="red">cobran vida.</span>',
      projectsIntro:'Una selección de experiencias digitales que he desarrollado.', hint:'Sigue desplazando', liveTag:'En línea', stackMenu:'Menú',
      hotdogDesc:'Menú digital con pedidos por WhatsApp y una experiencia sencilla para el cliente.',
      pizzaDesc:'Sitio de delivery de pizzas, aperitivos y bebidas, con navegación directa y pedidos por WhatsApp.', visitSite:'Visitar sitio',
      aboutTag:'Sobre mí', aboutBig1:'Creo', aboutBig2:'experiencias', aboutBig3:'digitales.',
      aboutIntro:'Soy <strong>Arthur Neves Cardoso</strong>, desarrollador web.',
      aboutCopy:'Combino diseño, código y animaciones para transformar ideas en experiencias digitales funcionales y visualmente memorables.',
      statResp:'Responsivo', statLoad:'Para cargar', statSell:'Página que vende', statYour:'TU', skillAnim:'Animaciones', skillAI:'IA',
      ctaTag:'Tu próximo proyecto', ctaG1:'Vamos', ctaG2:'crear.', ctaSr:'Vamos a crear',
      contactCopy:'¿Tienes una idea o proyecto en mente? Hablemos y hagámoslo realidad.', contactButton:'Hablar de un proyecto', instagram:'Ver Instagram',
      footerCopy:'Desarrollo web · Diseño de interfaces · Interacciones.', footContact:'Contacto', ariaSocial:'Redes sociales', ariaTech:'Tecnologías',
      footNav:'Navegación', footServices:'Servicios', footPortfolio:'Portafolio', footProcess:'Proceso',
      footCopy:'© 2026 Arthur Neves Cardoso. Todos los derechos reservados.', footPrivacy:'Política de privacidad',
      docTitle:'Arthur Cardoso — Portafolio', metaDesc:'Arthur Neves Cardoso — desarrollo web, interfaces interactivas y proyectos digitales propios.', ogLocale:'es_ES',
      waNav:'¡Hola Arthur! Vi tu portafolio y quiero hablar sobre un proyecto.',
      waHero:'¡Hola Arthur! Quiero crear una landing page.',
      waCta:'¡Hola Arthur! Quiero hablar sobre un proyecto web.'
    }
  };
  const fallback = translations.pt;
  const pick = (t, key) => (t[key] !== undefined ? t[key] : fallback[key]);
  const setMeta = (selector, value) => {
    const el = document.querySelector(selector);
    if (el && value) el.setAttribute('content', value);
  };

  function setLanguage(lang) {
    const code = translations[lang] ? lang : 'pt';
    const t = translations[code];
    window.portfolioT = t;
    document.documentElement.lang = code === 'pt' ? 'pt-BR' : code;

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const value = pick(t, el.dataset.i18n);
      if (value !== undefined) el.innerHTML = value;
    });
    document.querySelectorAll('[data-i18n-attrs]').forEach(el => {
      el.dataset.i18nAttrs.split(';').forEach(pair => {
        const [attr, key] = pair.split(':').map(s => s.trim());
        const value = attr && key ? pick(t, key) : undefined;
        if (value) el.setAttribute(attr, value);
      });
    });
    document.querySelectorAll('[data-wa-msg]').forEach(el => {
      const message = pick(t, el.dataset.waMsg);
      if (message) el.href = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`;
    });

    document.title = t.docTitle;
    setMeta('meta[name="description"]', t.metaDesc);
    setMeta('meta[property="og:title"]', t.docTitle);
    setMeta('meta[property="og:description"]', t.metaDesc);
    setMeta('meta[property="og:locale"]', t.ogLocale);
    setMeta('meta[name="twitter:title"]', t.docTitle);
    setMeta('meta[name="twitter:description"]', t.metaDesc);

    const select = document.getElementById('language-select');
    if (select) select.value = code;
    try { localStorage.setItem('portfolio-language', code); } catch (e) {}
  }

  const themes={red:['#ff2a2a','#ff5a3c','rgba(255,42,42,.45)'],violet:['#a855f7','#d8b4fe','rgba(168,85,247,.45)'],blue:['#1746a2','#4f7de0','rgba(23,70,162,.48)'],pink:['#ff5ebc','#ff9bd6','rgba(255,94,188,.45)'],green:['#4ade80','#a3e635','rgba(74,222,128,.4)']};
  function setTheme(name){const c=themes[name]||themes.red;const root=document.documentElement;root.dataset.theme=name;root.style.setProperty('--red',c[0]);root.style.setProperty('--red-2',c[1]);root.style.setProperty('--red-glow',c[2]);root.style.setProperty('--accent-rgb',c[3]||'255,42,42');document.querySelectorAll('.theme-dot').forEach(b=>b.classList.toggle('active',b.dataset.theme===name));try{localStorage.setItem('portfolio-theme',name)}catch(e){}}
  const language=document.getElementById('language-select');
  let savedLang='pt',savedTheme='red';try{savedLang=localStorage.getItem('portfolio-language')||'pt';savedTheme=localStorage.getItem('portfolio-theme')||'red'}catch(e){}
  if(language){language.addEventListener('change',()=>setLanguage(language.value));}
  document.querySelectorAll('.theme-dot').forEach(b=>b.addEventListener('click',()=>setTheme(b.dataset.theme)));
  setLanguage(savedLang);setTheme(savedTheme);
})();

/* ===== Formulário de orçamento → WhatsApp (liquid glass) ===== */
(function () {
  var form = document.getElementById('quote-form');
  if (!form) return;
  var WA = 'https://wa.me/5538992188316?text=';
  var toggle = document.getElementById('quote-toggle');
  var Q = {
    pt: { title:'Orçamento rápido', toggle:'Pedir um orçamento', toggleSub:'Preencha em 30 segundos', toggleClose:'Fechar formulário', heading:'Conte sobre o seu projeto.', sub:'Preencha os campos e a mensagem chega direto no meu WhatsApp, já organizada.', lName:'Seu nome', lType:'Tipo de projeto', lDeadline:'Prazo', lBudget:'Orçamento aproximado', lDesc:'Conte mais (opcional)', pick:'Selecione uma opção', optInst:'Site institucional', optLanding:'Landing page', optMenu:'Cardápio digital', optSystem:'Sistema ou automação', optOther:'Outro', dlUrgent:'Urgente (até 2 semanas)', dlMonth:'Entre 1 e 2 meses', dlFlex:'Sem pressa', dlUnsure:'Ainda não sei', bgLow:'Até R$ 1.000', bgMid:'R$ 1.000 a R$ 3.000', bgHigh:'R$ 3.000 a R$ 8.000', bgTop:'Acima de R$ 8.000', bgUnsure:'Ainda não sei', note:'Ao enviar, o WhatsApp abre com o resumo pronto para você mandar.', send:'Enviar pelo WhatsApp', errName:'Informe seu nome.', errType:'Escolha o tipo de projeto.', msgHi:'Olá Arthur! Quero um orçamento.', mName:'Nome', mType:'Tipo de projeto', mDeadline:'Prazo', mBudget:'Orçamento', mDesc:'Detalhes' },
    en: { title:'Quick quote', toggle:'Request a quote', toggleSub:'Fill it in under 30 seconds', toggleClose:'Close form', heading:'Tell me about your project.', sub:'Fill in the fields and the message goes straight to my WhatsApp, already organized.', lName:'Your name', lType:'Project type', lDeadline:'Deadline', lBudget:'Approximate budget', lDesc:'Tell me more (optional)', pick:'Select an option', optInst:'Business website', optLanding:'Landing page', optMenu:'Digital menu', optSystem:'System or automation', optOther:'Other', dlUrgent:'Urgent (up to 2 weeks)', dlMonth:'1 to 2 months', dlFlex:'No rush', dlUnsure:'Not sure yet', bgLow:'Up to R$ 1,000', bgMid:'R$ 1,000 to R$ 3,000', bgHigh:'R$ 3,000 to R$ 8,000', bgTop:'Above R$ 8,000', bgUnsure:'Not sure yet', note:'When you send, WhatsApp opens with the summary ready to go.', send:'Send via WhatsApp', errName:'Please enter your name.', errType:'Choose a project type.', msgHi:'Hi Arthur! I would like a quote.', mName:'Name', mType:'Project type', mDeadline:'Deadline', mBudget:'Budget', mDesc:'Details' },
    es: { title:'Presupuesto rápido', toggle:'Pedir un presupuesto', toggleSub:'Complétalo en 30 segundos', toggleClose:'Cerrar formulario', heading:'Cuéntame sobre tu proyecto.', sub:'Completa los campos y el mensaje llega directo a mi WhatsApp, ya organizado.', lName:'Tu nombre', lType:'Tipo de proyecto', lDeadline:'Plazo', lBudget:'Presupuesto aproximado', lDesc:'Cuéntame más (opcional)', pick:'Selecciona una opción', optInst:'Sitio institucional', optLanding:'Landing page', optMenu:'Carta digital', optSystem:'Sistema o automatización', optOther:'Otro', dlUrgent:'Urgente (hasta 2 semanas)', dlMonth:'Entre 1 y 2 meses', dlFlex:'Sin prisa', dlUnsure:'Aún no lo sé', bgLow:'Hasta R$ 1.000', bgMid:'R$ 1.000 a R$ 3.000', bgHigh:'R$ 3.000 a R$ 8.000', bgTop:'Más de R$ 8.000', bgUnsure:'Aún no lo sé', note:'Al enviar, WhatsApp se abre con el resumen listo para mandar.', send:'Enviar por WhatsApp', errName:'Indica tu nombre.', errType:'Elige el tipo de proyecto.', msgHi:'¡Hola Arthur! Quiero un presupuesto.', mName:'Nombre', mType:'Tipo de proyecto', mDeadline:'Plazo', mBudget:'Presupuesto', mDesc:'Detalles' }
  };
  var select = document.getElementById('language-select');
  function lang() { return (select && Q[select.value]) ? select.value : 'pt'; }
  function applyLang() {
    var t = Q[lang()];
    document.querySelectorAll('[data-q]').forEach(function (el) {
      var v = t[el.dataset.q];
      if (v != null) el.textContent = v;
    });
    if (toggle) toggle.querySelector('[data-q="toggle"]').textContent = form.hidden ? t.toggle : t.toggleClose;
  }
  if (select) select.addEventListener('change', applyLang);
  applyLang();

  // Botão que expande/recolhe o formulário
  if (toggle) {
    toggle.addEventListener('click', function () {
      var opening = form.hidden;
      form.hidden = !opening;
      toggle.setAttribute('aria-expanded', String(opening));
      applyLang();
      if (opening) form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  // Brilho que acompanha o ponteiro (efeito de vidro líquido)
  form.addEventListener('pointermove', function (e) {
    var r = form.getBoundingClientRect();
    form.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    form.style.setProperty('--my', (e.clientY - r.top) + 'px');
  });

  var errBox = form.querySelector('.q-error');
  function fail(field, msg) {
    field.classList.add('invalid');
    errBox.textContent = msg;
    errBox.hidden = false;
    field.querySelector('input,select').focus();
  }

  form.addEventListener('input', function () {
    form.querySelectorAll('.q-field.invalid').forEach(function (f) { f.classList.remove('invalid'); });
    errBox.hidden = true;
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var t = Q[lang()];
    var els = form.elements;
    var name = els.namedItem('name').value.trim();
    var type = els.namedItem('type');
    var deadline = els.namedItem('deadline');
    var budget = els.namedItem('budget');
    var desc = els.namedItem('desc').value.trim();

    if (!name) return fail(els.namedItem('name').closest('.q-field'), t.errName);
    if (!type.value) return fail(type.closest('.q-field'), t.errType);

    var parts = [t.msgHi, '', t.mName + ': ' + name, t.mType + ': ' + type.options[type.selectedIndex].textContent];
    if (deadline.value) parts.push(t.mDeadline + ': ' + deadline.options[deadline.selectedIndex].textContent);
    if (budget.value) parts.push(t.mBudget + ': ' + budget.options[budget.selectedIndex].textContent);
    if (desc) parts.push(t.mDesc + ': ' + desc);

    window.open(WA + encodeURIComponent(parts.join('\n')), '_blank', 'noopener');
  });
})();
