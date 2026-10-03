import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useRoomState, Stream, Classwork, People, DoubtBot, Comments } from './Panels.jsx';
import { API, post, get, token } from './api.js';

const COLLEGE = 'Surya Engineering College';
const env = import.meta.env;
const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' },
  ...(env.VITE_TURN_URL ? [{ urls: env.VITE_TURN_URL, username: env.VITE_TURN_USER, credential: env.VITE_TURN_PASS }] : [])] };
const fmt = (at) => new Date(at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const auth = () => ({ auth: { token: token() } });

function Header({ name }) {
  const [ok, setOk] = useState(true);
  return (
    <header className="top">
      {ok ? <img className="logo" src="/logo.png" alt="Surya Engineering College logo" onError={() => setOk(false)} />
        : <div className="av logo-fb">SEC</div>}
      <div className="brand">
        <h1 className="college" aria-label={COLLEGE}>
          {[...COLLEGE].map((c, i) => <span key={i} style={{ animationDelay: `${300 + i * 55}ms` }}>{c === ' ' ? '\u00A0' : c}</span>)}
        </h1>
        <p className="tag">Classroom with AI</p>
      </div>
      {name && <div className="who"><span>{name}</span><div className="av" style={{ background: '#1d4e89' }}>{name[0]?.toUpperCase()}</div></div>}
    </header>
  );
}

function NotesBox({ notes }) {
  const n = typeof notes === 'string' ? { en: notes, ta: '' } : notes;
  const [lang, setLang] = useState('en');
  const clean = (n[lang] || 'Not available').replace(/\*\*/g, '').replace(/^\s*\*\s/gm, '- ');
  const wa = () => window.open('https://wa.me/?text=' + encodeURIComponent(`Class Notes (${COLLEGE})\n\n${clean}`), '_blank');
  const dl = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([clean], { type: 'text/plain' })); a.download = `class-notes-${lang}.txt`; a.click();
  };
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>AI Notes</h3>
        <div className="row">
          <button className={lang === 'en' ? '' : 'alt'} onClick={() => setLang('en')}>English</button>
          <button className={lang === 'ta' ? '' : 'alt'} onClick={() => setLang('ta')}>தமிழ்</button>
        </div>
      </div>
      <pre style={{ marginTop: 10 }}>{clean}</pre>
      <div className="row" style={{ marginTop: 12 }}>
        <button onClick={wa}>Share on WhatsApp</button><button className="alt" onClick={dl}>Download</button>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('sec_user')); } catch { return null; } });
  const [cur, setCur] = useState(null);
  const [classes, setClasses] = useState([]);
  const [err, setErr] = useState('');
  const [step, setStep] = useState('form'); const [otp, setOtp] = useState(''); const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: '', email: '', title: '', code: new URLSearchParams(location.search).get('join') || '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const load = () => get('/api/classes').then((d) => Array.isArray(d) && setClasses(d)).catch(() => {});

  useEffect(() => { if (user && !cur) { load(); const t = setInterval(load, 10000); return () => clearInterval(t); } }, [user, cur]); // LIVE badge refresh
  useEffect(() => { if (user && f.code) join(f.code); }, [user]); // invite link: auto join

  const sendCode = async () => {
    if (!f.name.trim() || !/^\S+@\S+\.\S+$/.test(f.email)) return setErr('Enter your name and a valid email');
    setBusy(true); const d = await post('/api/auth/send', { email: f.email }); setBusy(false);
    if (d.error) return setErr(d.error); setErr(''); setStep('code');
  };
  const verify = async () => {
    const d = await post('/api/auth/verify', { email: f.email, code: otp });
    if (d.error) return setErr(d.error);
    const u = { name: f.name.trim(), email: d.email };
    localStorage.setItem('sec_token', d.token); localStorage.setItem('sec_user', JSON.stringify(u)); setUser(u); setErr('');
  };
  const logout = () => { localStorage.removeItem('sec_user'); localStorage.removeItem('sec_token'); setUser(null); setCur(null); setClasses([]); setStep('form'); };
  const create = async () => {
    const d = await post('/api/classes/create', { title: f.title });
    if (d.error) return setErr(d.error);
    setF((x) => ({ ...x, title: '' })); setErr(''); setCur({ room: d.code, role: 'teacher' });
  };
  const join = async (code) => {
    const d = await post('/api/classes/join', { name: user.name, code });
    if (d.error) return setErr(d.error);
    history.replaceState(null, '', location.pathname); setF((x) => ({ ...x, code: '' })); setErr(''); setCur({ room: d.code, role: d.role });
  };
  const remove = async (c) => {
    const t = c.role === 'teacher';
    if (!confirm(t ? `Delete "${c.title}" and all its data? This cannot be undone.` : `Leave "${c.title}"?`)) return;
    await post(t ? '/api/classes/delete' : '/api/classes/leave', { room: c.code, code: c.code }); load();
  };

  return (
    <>
      <Header name={user?.name} />
      {!user ? (
        <div className="wrap"><div className="card hero">
          <h2>Log in to your classroom</h2>
          <div className="feats">
            <div><b>AI Notes</b><br />English and Tamil notes after every class</div>
            <div><b>Doubt Bot</b><br />Ask in Tamil or English, hear the answer</div>
            <div><b>Low Data Mode</b><br />Switches to audio only on slow networks</div>
          </div>
          {f.code && <div className="pill">Invite code <b>{f.code}</b>. You will join automatically after login.</div>}
          {step === 'form' ? (
            <div className="row">
              <input value={f.name} onChange={set('name')} placeholder="Your name" aria-label="Name" />
              <input value={f.email} onChange={set('email')} placeholder="Email" type="email" aria-label="Email" />
              <button onClick={sendCode} disabled={busy}>{busy ? 'Sending...' : 'Send login code'}</button>
            </div>
          ) : (
            <div className="row">
              <small>We sent a 6-digit code to {f.email}.</small>
              <input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-digit code" inputMode="numeric" maxLength={6} aria-label="Code" />
              <button onClick={verify}>Verify</button>
              <button className="alt" onClick={() => { setStep('form'); setOtp(''); setErr(''); }}>Back</button>
            </div>
          )}
          {err && <div className="pill">{err}</div>}
        </div></div>
      ) : cur ? (
        <Shell key={cur.room} role={cur.role} room={cur.room} name={user.name} onBack={() => setCur(null)} />
      ) : (
        <div className="wrap">
          <div className="row"><h2 className="sec" style={{ flex: 1 }}>Your classes</h2><button className="alt" onClick={logout}>Log out</button></div>
          {err && <div className="pill">{err}</div>}
          {!classes.length && <div className="card">No classes yet. Create one or join with a code below.</div>}
          <div className="grid">
            {classes.map((c) => (
              <div className="card cls" key={c.code} onClick={() => setCur({ room: c.code, role: c.role })}>
                <b>{c.title || c.code}</b><br /><small>Code: {c.code}</small>
                <div className="row" style={{ marginTop: 8 }}>
                  <span className="chip">{c.role}</span>{c.live && <span className="chip live">LIVE</span>}{c.schedule && <small>Next: {fmt(c.schedule.at)}</small>}
                  <button className="alt" style={{ marginLeft: 'auto', color: '#d93025' }} onClick={(e) => { e.stopPropagation(); remove(c); }}>{c.role === 'teacher' ? 'Delete' : 'Leave'}</button>
                </div>
              </div>))}
          </div>
          <div className="grid">
            <div className="card"><h3>Create a class (teacher)</h3>
              <div className="row"><input style={{ flex: 1 }} value={f.title} onChange={set('title')} placeholder="Class name, e.g. Data Structures" /><button onClick={create}>Create</button></div></div>
            <div className="card"><h3>Join a class (student)</h3>
              <div className="row"><input style={{ flex: 1 }} value={f.code} onChange={set('code')} placeholder="Class code" /><button onClick={() => join(f.code)}>Join</button></div></div>
          </div>
        </div>
      )}
    </>
  );
}

const TABS = ['Stream', 'Classwork', 'People', 'Live class'];
function Shell({ role, room, name, onBack }) {
  const [tab, setTab] = useState(0);
  const teacher = role === 'teacher';
  const st = useRoomState(room);
  const p = { st, room, name, teacher };
  const show = (i) => ({ display: tab === i ? 'block' : 'none' }); // Live tab stays mounted so the call continues
  return (
    <>
      <nav className="tabs"><button className="alt" style={{ margin: 'auto 8px' }} onClick={onBack}>&larr; Classes</button>
        {TABS.map((t, i) => <button key={t} className={'tab' + (tab === i ? ' on' : '')} onClick={() => setTab(i)}>{t}</button>)}</nav>
      <div style={show(0)}><Stream {...p} notes={st.notes ? <NotesBox notes={st.notes} /> : null} /></div>
      <div style={show(1)}><Classwork {...p} /></div>
      <div style={show(2)}><People {...p} /></div>
      <div style={show(3)}>{teacher ? <Teacher room={room} /> : <Student room={room} />}<Comments {...p} /></div>
      {!teacher && <DoubtBot room={room} />}
    </>
  );
}

function Tile({ stream, t }) {
  const ref = useRef();
  useEffect(() => { if (ref.current) ref.current.srcObject = stream; }, [stream]);
  return (
    <div className="vtile">
      <video ref={ref} autoPlay playsInline />
      {!t.cam && <div className="vcover">{(t.name || '?')[0].toUpperCase()}</div>}
      <span>{t.name}{t.mic ? '' : ' (muted)'}</span>
    </div>
  );
}

function Teacher({ room }) {
  const videoRef = useRef(); const sock = useRef(); const peers = useRef({}); const vsend = useRef({}); const remote = useRef({});
  const stream = useRef(); const rec = useRef(); const lowSet = useRef(new Set()); const state = useRef({ mic: true, cam: true });
  const [lang, setLang] = useState('ta-IN'); const [live, setLive] = useState(''); const [trans, setTrans] = useState('');
  const [tiles, setTiles] = useState({}); const [lowCount, setLowCount] = useState(0); const [busy, setBusy] = useState(false);
  const [mic, setMic] = useState(true); const [cam, setCam] = useState(true); const [msg, setMsg] = useState('');

  useEffect(() => {
    const s = (sock.current = io(API, auth()));
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((st) => {
      stream.current = st; videoRef.current.srcObject = st; s.emit('join', { room, role: 'teacher' });
    }).catch(() => setMsg('Allow camera and microphone access to teach.'));
    s.on('student-joined', async ({ id, name }) => {
      if (!stream.current) return;
      peers.current[id]?.close();
      const pc = new RTCPeerConnection(ICE); peers.current[id] = pc; remote.current[id] = new MediaStream();
      stream.current.getTracks().forEach((t) => { const snd = pc.addTrack(t, stream.current); if (t.kind === 'video') vsend.current[id] = snd; });
      pc.ontrack = (e) => { remote.current[id].addTrack(e.track); setTiles((t) => ({ ...t, [id]: { mic: false, cam: false, ...t[id], name } })); };
      pc.onicecandidate = (e) => e.candidate && s.emit('signal', { to: id, data: { ice: e.candidate } });
      await pc.setLocalDescription(await pc.createOffer());
      s.emit('signal', { to: id, data: { sdp: pc.localDescription } });
      s.emit('media', { ...state.current });
    });
    s.on('signal', async ({ from, data }) => {
      const pc = peers.current[from]; if (!pc) return;
      if (data.sdp) await pc.setRemoteDescription(data.sdp);
      if (data.ice) await pc.addIceCandidate(data.ice).catch(() => {});
    });
    s.on('student-left', (id) => {
      peers.current[id]?.close(); delete peers.current[id]; delete remote.current[id]; delete vsend.current[id];
      lowSet.current.delete(id); setLowCount(lowSet.current.size); setTiles(({ [id]: _, ...rest }) => rest);
    });
    s.on('media', ({ from, owner, mic, cam }) => !owner && setTiles((t) => (t[from] ? { ...t, [from]: { ...t[from], mic, cam } } : t)));
    s.on('quality', ({ from, low }) => { // slow student: stop sending video to that student only
      vsend.current[from]?.replaceTrack(low ? null : stream.current.getVideoTracks()[0]);
      low ? lowSet.current.add(from) : lowSet.current.delete(from); setLowCount(lowSet.current.size);
    });
    return () => { s.disconnect(); Object.values(peers.current).forEach((pc) => pc.close()); stream.current?.getTracks().forEach((t) => t.stop()); };
  }, [room]);

  const toggle = (kind) => {
    const t = stream.current?.getTracks().find((x) => x.kind === (kind === 'mic' ? 'audio' : 'video')); if (!t) return;
    t.enabled = !t.enabled; state.current[kind] = t.enabled; kind === 'mic' ? setMic(t.enabled) : setCam(t.enabled);
    sock.current.emit('media', { ...state.current });
  };
  const startNotes = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert('Please use Google Chrome for live transcript.');
    const r = (rec.current = new SR()); r.lang = lang; r.continuous = true; r.interimResults = false;
    r.onresult = (e) => { const text = e.results[e.results.length - 1][0].transcript; setLive((p) => p + ' ' + text); post('/api/transcript', { room, text }); };
    r.onend = () => rec.current && r.start();
    r.start(); setMsg('Listening. Speak in ' + (lang === 'ta-IN' ? 'Tamil' : 'English') + '.');
  };
  const translate = async () => {
    const d = await post('/api/translate', { text: live, to: lang === 'ta-IN' ? 'en' : 'ta' }); setTrans(d.text || d.error);
  };
  const endClass = async () => {
    setBusy(true); const r = rec.current; rec.current = null; r?.stop(); sock.current.emit('end-class', room);
    const d = await post('/api/notes', { room }); setMsg(d.error || 'Notes are ready in English and Tamil. Open the Stream tab.'); setBusy(false);
  };

  return (
    <div className="wrap">
      <div className="card">
        <video ref={videoRef} autoPlay muted playsInline />
        <div className="ctrlbar">
          <button className={'cbtn' + (mic ? '' : ' off')} onClick={() => toggle('mic')}>{mic ? 'Mic on' : 'Mic off'}</button>
          <button className={'cbtn' + (cam ? '' : ' off')} onClick={() => toggle('cam')}>{cam ? 'Camera on' : 'Camera off'}</button>
        </div>
        {lowCount > 0 && <div className="badge low" style={{ marginTop: 8 }}>{lowCount} student(s) on audio only</div>}
        {!!Object.keys(tiles).length && <div className="tilegrid">{Object.entries(tiles).map(([id, t]) => <Tile key={id} stream={remote.current[id]} t={t} />)}</div>}
      </div>
      <div className="card row">
        <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Speaking language">
          <option value="ta-IN">I speak Tamil</option><option value="en-IN">I speak English</option>
        </select>
        <button onClick={startNotes}>Start AI notes</button>
        <button className="alt" onClick={endClass} disabled={busy}>{busy ? 'Generating notes...' : 'End class and generate notes'}</button>
        {msg && <small style={{ flexBasis: '100%' }}>{msg}</small>}
      </div>
      <div className="card"><div className="row" style={{ justifyContent: 'space-between' }}><h3 style={{ margin: 0 }}>Live transcript</h3>
        {live && <button className="alt" onClick={translate}>Translate to {lang === 'ta-IN' ? 'English' : 'Tamil'}</button>}</div>
        <pre style={{ marginTop: 8 }}>{live || 'Start AI notes and speak. Your words appear here.'}</pre>
        {trans && <pre className="pill" style={{ marginTop: 10 }}>{trans}</pre>}
      </div>
    </div>
  );
}

function Student({ room }) {
  const videoRef = useRef(); const pcRef = useRef(); const sock = useRef(); const remote = useRef(new MediaStream());
  const forceLow = useRef(false); const lowRef = useRef(false); const vidK = useRef(0);
  const snd = useRef({}); const mine = useRef({}); const state = useRef({ mic: false, cam: false });
  const [lowBw, setLowBw] = useState(false); const [status, setStatus] = useState('Waiting for the teacher...');
  const [net, setNet] = useState({ v: 0, a: 0, saved: 0 }); const [mic, setMic] = useState(false); const [cam, setCam] = useState(false);
  const [tLive, setTLive] = useState(null); const [tState, setTState] = useState({ mic: true, cam: true }); const [err, setErr] = useState('');

  const applyMode = (low) => { lowRef.current = low; setLowBw(low); sock.current?.emit('quality', { room, low }); };

  useEffect(() => {
    const s = (sock.current = io(API, auth()));
    videoRef.current.srcObject = remote.current;
    const makePc = (from) => {
      pcRef.current?.close(); const pc = new RTCPeerConnection(ICE); pcRef.current = pc; snd.current = {};
      remote.current.getTracks().forEach((t) => remote.current.removeTrack(t));
      pc.ontrack = (e) => { remote.current.addTrack(e.track); setStatus('Live'); };
      pc.onicecandidate = (e) => e.candidate && s.emit('signal', { to: from, data: { ice: e.candidate } });
      return pc;
    };
    s.emit('join', { room, role: 'student' });
    s.on('signal', async ({ from, data }) => {
      if (data.sdp) {
        const pc = makePc(from); await pc.setRemoteDescription(data.sdp);
        pc.getTransceivers().forEach((t) => { t.direction = 'sendrecv'; snd.current[t.receiver.track.kind] = t.sender; }); // student mic/cam ku
        await pc.setLocalDescription(await pc.createAnswer());
        s.emit('signal', { to: from, data: { sdp: pc.localDescription } });
        ['audio', 'video'].forEach((k) => mine.current[k] && snd.current[k]?.replaceTrack(mine.current[k]));
        s.emit('media', { ...state.current });
      } else if (data.ice) pcRef.current?.addIceCandidate(data.ice).catch(() => {});
    });
    s.on('media', ({ owner, mic, cam }) => owner && setTState({ mic, cam }));
    s.on('teacher-status', ({ live }) => setTLive(live));
    s.on('denied', () => setStatus('You are not a member of this class.'));
    s.on('class-ended', () => setStatus('Class ended. Notes are in the Stream tab.'));

    // Low-bandwidth optimizer
    let last = { v: 0, a: 0, t: Date.now() }, bad = 0, lowSince = 0, saved = 0;
    const timer = setInterval(async () => {
      const pc = pcRef.current; if (!pc) return;
      const now = Date.now(), dt = now - last.t; last.t = now;
      let vb = last.v, ab = last.a, loss = 0;
      (await pc.getStats()).forEach((r) => {
        if (r.type !== 'inbound-rtp') return;
        if (r.kind === 'video') { vb = r.bytesReceived; loss = r.packetsLost / Math.max(1, r.packetsReceived + r.packetsLost); }
        if (r.kind === 'audio') ab = r.bytesReceived;
      });
      const vk = Math.max(0, ((vb - last.v) * 8) / dt), ak = Math.max(0, ((ab - last.a) * 8) / dt); last.v = vb; last.a = ab;
      if (!lowRef.current && vk > 0) vidK.current = vidK.current ? (vidK.current + vk) / 2 : vk;
      if (lowRef.current) saved += (vidK.current * dt) / 8000;
      setNet({ v: Math.round(vidK.current), a: Math.round(ak), saved: Math.round(saved) });
      if (forceLow.current) return;
      if (lowRef.current) { if (now - lowSince > 20000) { applyMode(false); bad = 0; } return; } // retry video after 20s
      const poor = loss > 0.08 || (vk < 60 && vb > 0);
      bad = poor ? bad + 1 : 0;
      if (bad >= 3) { applyMode(true); lowSince = now; }
    }, 2000);
    return () => { clearInterval(timer); s.disconnect(); pcRef.current?.close(); Object.values(mine.current).forEach((t) => t?.stop()); };
  }, [room]);

  const toggle = async (kind) => {
    const key = kind === 'mic' ? 'audio' : 'video', sender = snd.current[key];
    if (!sender) return setErr('Wait until the teacher is connected.');
    try {
      if (state.current[kind]) { mine.current[key]?.stop(); mine.current[key] = null; await sender.replaceTrack(null); state.current[kind] = false; }
      else {
        const st = await navigator.mediaDevices.getUserMedia(kind === 'mic' ? { audio: true } : { video: { width: 320, height: 240, frameRate: 15 } });
        const t = st.getTracks()[0]; mine.current[key] = t; await sender.replaceTrack(t); state.current[kind] = true;
      }
      kind === 'mic' ? setMic(state.current.mic) : setCam(state.current.cam);
      sock.current.emit('media', { ...state.current }); setErr('');
    } catch { setErr('Could not access your ' + (kind === 'mic' ? 'microphone' : 'camera') + '. Check browser permission.'); }
  };
  const toggleForce = () => { forceLow.current = !forceLow.current; applyMode(forceLow.current); };
  const label = status === 'Live' || status.startsWith('Class ended') || status.startsWith('You are') ? status : tLive ? 'Teacher is live. Connecting video...' : 'The teacher has not started the class yet';
  const pct = net.v > 0 ? Math.max(0, Math.round(100 - ((net.a || 24) / net.v) * 100)) : 0;
  const w = (n, max) => Math.min(100, (n / Math.max(max, 1)) * 100) + '%';

  return (
    <div className="wrap">
      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <span className={'badge' + (lowBw ? ' low' : '')}>{lowBw ? 'Low data: audio only' : label}</span>
          {!tState.mic && <span className="badge low">Teacher mic is off</span>}
        </div>
        <div className="vbox">
          <video ref={videoRef} autoPlay playsInline style={{ opacity: lowBw ? 0.15 : 1 }} />
          {!tState.cam && status === 'Live' && <div className="vcover">Teacher camera is off</div>}
        </div>
        <div className="ctrlbar">
          <button className={'cbtn' + (mic ? '' : ' off')} onClick={() => toggle('mic')}>{mic ? 'Mic on' : 'Mic off'}</button>
          <button className={'cbtn' + (cam ? '' : ' off')} onClick={() => toggle('cam')}>{cam ? 'Camera on' : 'Camera off'}</button>
          <button className="alt" onClick={toggleForce}>{forceLow.current ? 'Turn video on' : 'Force low data'}</button>
        </div>
        {err && <div className="pill">{err}</div>}
        {lowBw && (
          <div className="meter">
            <div className="saveBig">{pct}% data saved, {net.saved} KB so far</div>
            <div>Video: {net.v} kbps</div><div className="bar"><i style={{ width: w(net.v, net.v), background: '#d93025' }} /></div>
            <div>Audio only: {net.a} kbps</div><div className="bar"><i style={{ width: w(net.a, net.v), background: '#188038' }} /></div>
          </div>
        )}
      </div>
    </div>
  );
}
