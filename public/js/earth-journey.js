/* A dependency-free 3D sphere projected into canvas. Geographic coordinates
 * come from Natural Earth; no tile service, location permission or API key. */
(function () {
    'use strict';
    const host = document.getElementById('earthJourney');
    if (!host) return;
    const canvas = document.getElementById('earthCanvas');
    const context = canvas.getContext('2d');
    const status = document.getElementById('earthJourneyStatus');
    const pause = document.getElementById('earthJourneyPause');
    const replay = document.getElementById('earthJourneyReplay');
    const title = document.getElementById('earthJourneyTitle');
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const radians = Math.PI / 180;
    const destination = { lat: 14.42143, lng: 121.44583 };
    let geometry = [], lakes = [], width = 0, height = 0, frame = 0, elapsed = 0, previous = 0;
    let visible = false, ready = false, loading = false, failed = false, paused = false, complete = false;
    const duration = 6800;
    const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
    const vector = (lng, lat) => {
        const a = lng * radians, b = lat * radians;
        return [Math.cos(b) * Math.cos(a), Math.sin(b), Math.cos(b) * Math.sin(a)];
    };
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const target = vector(destination.lng, destination.lat);
    const colors = getComputedStyle(host);
    const color = name => colors.getPropertyValue(`--earth-${name}`).trim();

    function draw() {
        if (!context || !width || !height) return;
        const rotate = smooth((elapsed - 900) / 2000);
        const zoom = smooth((elapsed - 2800) / 4000);
        const lat = 22 + (destination.lat - 22) * rotate;
        const lng = 48 + (destination.lng - 48) * rotate;
        const forward = vector(lng, lat);
        const right = [-Math.sin(lng * radians), 0, Math.cos(lng * radians)];
        const up = [-Math.sin(lat * radians) * Math.cos(lng * radians), Math.cos(lat * radians), -Math.sin(lat * radians) * Math.sin(lng * radians)];
        const radius = Math.min(width, height) * .355 * Math.exp(zoom * Math.log(34));
        const cx = width / 2, cy = height * .49;
        // Orthographic 3D camera; increasing focal scale moves toward Siniloan.
        const project = point => [cx + radius * dot(point, right), cy - radius * dot(point, up), dot(point, forward)];
        context.clearRect(0, 0, width, height);
        const atmosphere = context.createRadialGradient(cx, cy, Math.min(radius, width) * .7, cx, cy, Math.max(radius * 1.17, width * .7));
        atmosphere.addColorStop(0, '#0355f330'); atmosphere.addColorStop(1, '#0355f300');
        context.fillStyle = atmosphere; context.fillRect(0, 0, width, height);
        context.save();
        context.beginPath(); context.arc(cx, cy, radius, 0, Math.PI * 2); context.clip();
        context.fillStyle = color('ocean'); context.fillRect(0, 0, width, height);
        context.fillStyle = color('land'); context.strokeStyle = color('coast'); context.lineWidth = .7;
        for (const ring of geometry) {
            const points = ring.map(project);
            if (points.every(p => p[2] <= 0) || points.every(p => p[0] < -4) || points.every(p => p[0] > width + 4) || points.every(p => p[1] < -4) || points.every(p => p[1] > height + 4)) continue;
            context.beginPath();
            // Clip polygon edges to the visible hemisphere, retaining a clean rim.
            const front = points.filter(p => p[2] >= 0);
            if (front.length < 3) continue;
            front.forEach((p, i) => i ? context.lineTo(p[0], p[1]) : context.moveTo(p[0], p[1]));
            context.closePath(); context.fill(); context.stroke();
        }
        context.fillStyle = color('ocean');
        for (const ring of lakes) {
            const points = ring.map(project);
            if (points.some(point => point[2] < 0)) continue;
            context.beginPath();
            points.forEach((p, i) => i ? context.lineTo(p[0], p[1]) : context.moveTo(p[0], p[1]));
            context.closePath(); context.fill(); context.stroke();
        }
        context.strokeStyle = color('grid'); context.lineWidth = .5;
        const gridStep = zoom > .75 ? 1 : zoom > .4 ? 5 : 15;
        const line = points => {
            context.beginPath(); let pen = false;
            points.forEach(point => { const p = project(point); if (p[2] < 0) { pen = false; return; } if (pen) context.lineTo(p[0], p[1]); else context.moveTo(p[0], p[1]); pen = true; }); context.stroke();
        };
        const extent = Math.min(180, 110 / Math.exp(zoom * Math.log(34)));
        for (let a = Math.floor((lng - extent) / gridStep) * gridStep; a < lng + extent; a += gridStep) {
            const points = []; for (let b = Math.max(-89, lat - extent); b <= Math.min(89, lat + extent); b += .5) points.push(vector(a, b)); line(points);
        }
        for (let b = Math.floor((lat - extent) / gridStep) * gridStep; b <= Math.min(89, lat + extent); b += gridStep) {
            if (b < -89) continue;
            const points = []; for (let a = lng - extent; a <= lng + extent; a += .5) points.push(vector(a, b)); line(points);
        }
        const shade = context.createRadialGradient(cx - radius * .3, cy - radius * .35, radius * .1, cx, cy, radius);
        shade.addColorStop(0, '#729fce10'); shade.addColorStop(.7, '#00000000'); shade.addColorStop(1, '#000b1ecc');
        context.fillStyle = shade; context.fillRect(0, 0, width, height);
        context.restore();
        if (zoom < .3) {
            context.strokeStyle = '#729fce70'; context.lineWidth = 1;
            context.beginPath(); context.arc(cx, cy, radius, 0, Math.PI * 2); context.stroke();
        }
        const pin = project(target);
        if (pin[2] > 0) {
            context.strokeStyle = color('accent'); context.fillStyle = '#f8fafc';
            context.beginPath(); context.arc(pin[0], pin[1], 12, 0, Math.PI * 2); context.stroke();
            context.beginPath(); context.arc(pin[0], pin[1], 4, 0, Math.PI * 2); context.fill();
        }
        host.dataset.arrived = String(zoom > .88);
    }

    function cancel() { cancelAnimationFrame(frame); frame = 0; previous = 0; }
    function tick(now) {
        frame = 0;
        if (!visible || document.hidden || paused || complete) return;
        if (previous) elapsed = Math.min(duration, elapsed + Math.min(now - previous, 80));
        previous = now;
        draw();
        if (elapsed >= duration) {
            complete = true; pause.disabled = true;
            status.textContent = 'Siniloan, Laguna · Your search starts here';
            title.textContent = 'To a place that feels like yours.';
            canvas.setAttribute('aria-label', 'Earth zoomed in to Siniloan, Laguna, Philippines');
        } else frame = requestAnimationFrame(tick);
    }
    function resume() {
        if (ready && visible && !document.hidden && !paused && !complete && !frame) frame = requestAnimationFrame(tick);
    }
    function rest() {
        cancel(); elapsed = duration; complete = true; pause.disabled = true;
        draw(); title.textContent = 'A place that feels like yours.';
        status.textContent = 'Siniloan, Laguna · Your search starts here';
    }
    async function load() {
        if (ready || loading || failed) return;
        loading = true;
        try {
            if (!context) throw new Error('Canvas unavailable');
            const response = await fetch('/images/earth-land.geojson');
            if (!response.ok) throw new Error('Coastline unavailable');
            const data = await response.json();
            geometry = data.rings.map(ring => ring.map(([lng, lat]) => vector(lng, lat)));
            lakes = (data.lakes || []).map(ring => ring.map(([lng, lat]) => vector(lng, lat)));
            ready = true; replay.disabled = false; pause.disabled = false;
            draw(); if (motion.matches) rest(); else { status.textContent = 'Earth → Philippines → Siniloan'; resume(); }
        } catch (_) {
            failed = true; host.dataset.arrived = 'true';
            title.textContent = 'Find your place in Siniloan.';
            status.textContent = 'Explore Siniloan with rental discovery';
        } finally {
            loading = false;
        }
    }
    const resize = new ResizeObserver(() => {
        const rect = host.getBoundingClientRect(); width = rect.width; height = rect.height;
        const ratio = Math.min(devicePixelRatio || 1, 2);
        canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
        context?.setTransform(ratio, 0, 0, ratio, 0, 0); draw();
    });
    resize.observe(host);
    const observer = new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        if (visible) { if (!ready && !failed) load(); else resume(); } else cancel();
    }, { threshold: .25 });
    observer.observe(host);
    pause.addEventListener('click', () => {
        paused = !paused;
        pause.setAttribute('aria-label', paused ? 'Resume Earth journey' : 'Pause Earth journey');
        pause.innerHTML = window.domiknowIcon(paused ? 'play' : 'pause');
        if (paused) cancel(); else resume();
    });
    replay.addEventListener('click', () => {
        cancel(); elapsed = 0; paused = false; complete = false; pause.disabled = false;
        pause.setAttribute('aria-label', 'Pause Earth journey'); pause.innerHTML = window.domiknowIcon('pause');
        title.textContent = 'From a world of possibilities.';
        canvas.setAttribute('aria-label', 'Three-dimensional Earth traveling toward Siniloan, Laguna, Philippines');
        if (motion.matches) rest(); else { status.textContent = 'Earth → Philippines → Siniloan'; draw(); resume(); }
    });
    motion.addEventListener('change', () => { if (motion.matches && ready) rest(); });
    document.addEventListener('visibilitychange', () => document.hidden ? cancel() : resume());
    window.addEventListener('pagehide', cancel);
    window.addEventListener('pageshow', resume);
}());
