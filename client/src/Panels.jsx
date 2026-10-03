import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { API, post, get, token } from './api.js';

const when = (at) => new Date(at).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
const EMPTY = { announcements: [], assignments: [], submissions: [], attendance: {}, quiz: null, scores: {}, questions: [], notes: null };

export function useRoomState(room) {
  const [st, setSt] = useState(EMPTY);
  useEffect(() => {
    const s = io(API, { auth: { token: token() } });
    s.on('state', (d) => setSt({ ...EMPTY, ...d }));
    s.on('class-deleted', () => location.reload());
    s.emit('join', { room, role: 'viewer' }); // student join = auto attendance (server side)
    get(`/api/state/${room}`).then((d) => d && !d.error && setSt({ ...EMPTY, ...d })).catch(() => {});
    return () => s.disconnect();
  }, [room]);
  return st;
}

const COLORS = ['#1a73e8', '#188038', '#e37400', '#a142f4', '#d93025', '#12a4af'];
export const Av = ({ n, c }) => <div className="av" style={{ background: c || COLORS[(n || '?').charCodeAt(0) % COLORS.length] }}>{(n || '?')[0].toUpperCase()}</div>;

export function Stream({ st, room, teacher, notes }) {
  const [open, setOpen] = useState(false); const [text, setText] = useState('');
  const send = async () => { if (text.trim()) { await post('/api/announce', { room, text }); setText(''); setOpen(false); } };
  const remove = (kind, id) => confirm('Delete this post?') && post('/api/delete', { room, kind, id });
  const feed = [...st.announcements.map((a) => ({ ...a, k: 'a' })), ...st.assignments.map((a) => ({ at: a.id, text: a.title, k: 'w' }))].sort((x, y) => y.at - x.at);
  return (
    <div className="wrap">
      <div className="banner"><h2>{st.title || room}</h2><p>Surya Engineering College</p>
        <div className="chips"><span>AI Notes</span><span>AI Grading</span><span>AI Quiz</span><span>Doubt Bot</span><span>Low Data Mode</span></div>
      </div>
      <div className="stream">
        <aside><ClassInfo st={st} room={room} teacher={teacher} />
          <div className="card"><b>Upcoming</b>
            {st.assignments.length ? st.assignments.slice(-3).map((a) => <div key={a.id}><small>{a.title}</small></div>) : <div><small>No work due</small></div>}
          </div>
        </aside>
        <main style={{ display: 'grid', gap: 14, minWidth: 0 }}>
          {teacher && (open
            ? <div className="card"><textarea rows={3} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Announce something to your class" />
                <div className="row" style={{ marginTop: 8, justifyContent: 'flex-end' }}><button className="alt" onClick={() => setOpen(false)}>Cancel</button><button onClick={send}>Post</button></div></div>
            : <div className="card ann" onClick={() => setOpen(true)}><Av n="T" c="#1d4e89" /><span>Announce something to your class</span></div>)}
          {notes}
          {!feed.length && <div className="card">No posts yet.</div>}
          {feed.map((a, i) => (
            <div className="card post" key={i}>
              <div className="row"><Av n={a.k === 'w' ? '\u270E' : 'T'} c={a.k === 'w' ? '#1a73e8' : '#1d4e89'} /><div><b>Teacher</b><br /><small>{when(a.at)}</small></div></div>
              <pre style={{ marginTop: 10 }}>{a.k === 'w' ? 'New assignment: ' + a.text : a.text}</pre>
              {teacher && <button className="alt" style={{ marginTop: 8 }} onClick={() => remove(a.k === 'w' ? 'assignment' : 'announcement', a.at)}>Delete</button>}
            </div>))}
        </main>
      </div>
    </div>
  );
}

export function Classwork(props) {
  return (
    <div className="wrap">
      <h2 className="sec">Assignments <span className="chip">AI grading</span></h2><Assignments {...props} />
      <h2 className="sec">Quiz <span className="chip">AI generated</span></h2><Quiz {...props} />
    </div>
  );
}

function Assignments({ st, room, name, teacher }) {
  const [title, setTitle] = useState(''); const [question, setQ] = useState(''); const [ans, setAns] = useState({}); const [busy, setBusy] = useState(null);
  const create = async () => { if (title && question) { await post('/api/assign', { room, title, question }); setTitle(''); setQ(''); } };
  const submit = async (a) => { setBusy(a.id); const d = await post('/api/submit', { room, assignmentId: a.id, answer: ans[a.id] || '' }); setBusy(null); if (d.error) alert(d.error); };
  return (
    <div className="wrap">
      {teacher && (
        <div className="card"><h3>New assignment</h3>
          <input style={{ width: '100%', marginBottom: 8 }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          <textarea rows={3} value={question} onChange={(e) => setQ(e.target.value)} placeholder="Question" />
          <div style={{ marginTop: 8 }}><button onClick={create}>Create</button></div>
        </div>)}
      {!st.assignments.length && <div className="card">No assignments yet.</div>}
      {st.assignments.map((a) => {
        const subs = st.submissions.filter((x) => x.assignmentId === a.id), mine = subs.find((x) => x.name === name);
        return (
          <div className="card work" key={a.id}><h3>{a.title}</h3><pre>{a.question}</pre>
            {teacher ? subs.map((x, i) => <div className="pill" key={i}><b>{x.name}</b>: {x.score}/10. {x.feedback}</div>)
              : <>
                <textarea rows={3} style={{ marginTop: 8 }} value={ans[a.id] || ''} onChange={(e) => setAns({ ...ans, [a.id]: e.target.value })} placeholder="Write your answer here" />
                <div style={{ marginTop: 8 }}><button onClick={() => submit(a)} disabled={busy === a.id}>{busy === a.id ? 'AI is checking...' : 'Submit'}</button></div>
                {mine && <div className="pill"><b>{mine.score}/10</b> {mine.feedback}</div>}
              </>}
          </div>);
      })}
    </div>
  );
}

function Quiz({ st, room, teacher }) {
  const qz = st.quiz; const [pick, setPick] = useState({}); const [res, setRes] = useState(null); const [busy, setBusy] = useState(false);
  useEffect(() => { setPick({}); setRes(null); }, [qz?.id]);
  const gen = async () => { setBusy(true); const d = await post('/api/quiz', { room }); setBusy(false); if (d.error) alert(d.error); };
  const finish = async () => { const d = await post('/api/score', { room, picks: qz.items.map((_, i) => pick[i] ?? -1) }); d.error ? alert(d.error) : setRes(d); };
  return (
    <div className="wrap">
      {teacher && <div className="card row"><button onClick={gen} disabled={busy}>{busy ? 'Generating quiz...' : 'Generate AI quiz from class notes'}</button></div>}
      {!qz && <div className="card">No quiz yet. The teacher generates it after class.</div>}
      {qz && qz.items.map((x, i) => (
        <div className="card" key={qz.id + i}><b>{i + 1}. {x.q}</b>
          {x.options.map((o, j) => {
            const cls = res ? (j === res.review[i].answer ? 'right' : pick[i] === j ? 'wrong' : '') : pick[i] === j ? 'sel' : '';
            return <button key={j} className={'opt ' + cls} disabled={teacher || !!res} onClick={() => setPick({ ...pick, [i]: j })}>{o}</button>;
          })}
          {res && <div className="pill">{res.review[i].why}</div>}
        </div>))}
      {qz && !teacher && !res && <button onClick={finish}>Submit quiz</button>}
      {res && <div className="card saveBig">Your score: {res.score} / {qz.items.length}</div>}
    </div>
  );
}

export function People({ st }) {
  const att = Object.entries(st.attendance);
  return (
    <div className="wrap"><div className="people">
      <h2 className="sec">Teachers</h2>
      <div className="prow"><Av n="T" c="#1d4e89" /><span>Class teacher</span></div>
      <h2 className="sec">Students <small>{att.length} present</small></h2>
      {!att.length && <div className="prow"><small>No students have joined yet.</small></div>}
      {att.map(([n, at]) => (
        <div className="prow" key={n}><Av n={n} /><span>{n}</span><span className="chip ok">Present</span><small>{when(at)}</small>
          {st.scores[n] !== undefined && <span className="chip">Quiz {st.scores[n]}</span>}</div>))}
    </div></div>
  );
}

export function Comments({ st, room, teacher }) {
  const [text, setText] = useState(''); const [rep, setRep] = useState({}); const [open, setOpen] = useState(null);
  const list = [...(st.questions || [])].reverse();
  const ask = async () => { if (!text.trim()) return; const d = await post('/api/question', { room, text }); d.error ? alert(d.error) : setText(''); };
  const reply = async (id) => {
    const t = (rep[id] || '').trim(); if (!t) return;
    const d = await post('/api/reply', { room, id, text: t }); if (d.error) return alert(d.error); setRep({ ...rep, [id]: '' }); setOpen(null);
  };
  const remove = (id) => confirm('Delete this comment?') && post('/api/delete', { room, kind: 'question', id });
  return (
    <div className="wrap"><div className="card"><h3>Class comments</h3>
      {!teacher && <div className="row" style={{ marginBottom: 10 }}>
        <input style={{ flex: 1, minWidth: 0 }} maxLength={300} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} placeholder="Ask the teacher a question..." />
        <button onClick={ask}>Post</button></div>}
      {!list.length && <small>No questions yet.</small>}
      {list.map((q) => (
        <div className="cmt" key={q.id}>
          <div className="row"><Av n={q.name} />
            <div style={{ flex: 1, minWidth: 0 }}><b>{q.name}</b> <small>{when(q.at)}</small><div className="wrapword">{q.text}</div></div>
            {teacher && <><button className="alt" onClick={() => setOpen(open === q.id ? null : q.id)}>Reply</button><button className="alt" onClick={() => remove(q.id)}>Delete</button></>}
          </div>
          {q.reply && <div className="reply"><b>Teacher</b> <small>{when(q.reply.at)}</small><div className="wrapword">{q.reply.text}</div></div>}
          {teacher && open === q.id && (
            <div className="row" style={{ marginTop: 8 }}>
              <input style={{ flex: 1, minWidth: 0 }} autoFocus value={rep[q.id] || ''} onChange={(e) => setRep({ ...rep, [q.id]: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && reply(q.id)} placeholder="Write a reply..." />
              <button onClick={() => reply(q.id)}>Send</button></div>)}
        </div>))}
    </div></div>
  );
}

export function DoubtBot({ room }) {
  const [open, setOpen] = useState(false); const [q, setQ] = useState(''); const [chat, setChat] = useState([]);
  const [voice, setVoice] = useState(true); const [busy, setBusy] = useState(false);
  const speak = (t) => {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t.replace(/[*#_`]/g, ''));
    u.lang = /[\u0B80-\u0BFF]/.test(t) ? 'ta-IN' : 'en-IN'; u.rate = 0.95; speechSynthesis.speak(u);
  };
  const ask = async () => {
    if (!q.trim() || busy) return; const question = q; setQ(''); setBusy(true);
    setChat((c) => [...c, { who: 'You', t: question }]);
    const d = await post('/api/ask', { room, question }); const ans = d.answer || d.error;
    setChat((c) => [...c, { who: 'AI Teacher', t: ans, ai: true }]); setBusy(false);
    if (voice && d.answer) speak(ans);
  };
  return (
    <>
      <button className="fab" onClick={() => setOpen(!open)}>{open ? 'Close' : 'Ask AI'}</button>
      {open && (
        <div className="botpanel chat">
          <div className="bothead">Doubt bot (Tamil or English)</div>
          <div className="botmsgs">
            {!chat.length && <small>Ask about today's class in Tamil or English.</small>}
            {chat.map((m, i) => <p key={i} className={m.ai ? 'ai' : ''}><b>{m.who}:</b> {m.t}</p>)}
            {busy && <small>AI is thinking...</small>}
          </div>
          <div className="row"><input style={{ flex: 1, minWidth: 0 }} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} placeholder="Your doubt..." /><button onClick={ask}>Ask</button></div>
          <label className="row"><input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} /> Read the answer aloud</label>
        </div>)}
    </>
  );
}

function ClassInfo({ st, room, teacher }) {
  const [at, setAt] = useState(''); const [note, setNote] = useState(''); const [copied, setCopied] = useState(false);
  const link = `${location.origin}/?join=${room}`;
  const copy = () => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const setTime = (clear) => post('/api/schedule', { room, at: !clear && at ? new Date(at).getTime() : null, note });
  const del = (kind, label) => confirm(`Delete ${label}?`) && post('/api/delete', { room, kind });
  const delClass = async () => { if (confirm('Delete this whole class and all its data? This cannot be undone.')) { await post('/api/classes/delete', { room }); location.reload(); } };
  const sc = st.schedule, diff = sc ? sc.at - Date.now() : 0;
  const left = !sc ? '' : diff <= 0 ? 'Class time has started' : diff < 36e5 ? `in ${Math.ceil(diff / 6e4)} min` : `in ${Math.floor(diff / 36e5)} hr ${Math.round((diff % 36e5) / 6e4)} min`;
  return (
    <>
      <div className="card"><b>Class code</b><div className="code">{room}</div>
        <button className="alt" style={{ marginTop: 8 }} onClick={copy}>{copied ? 'Copied!' : 'Copy invite link'}</button></div>
      <div className="card"><b>Class time</b>
        {sc ? <div><div className="code" style={{ fontSize: 16 }}>{when(sc.at)}</div><small>{left}{sc.note ? ', ' + sc.note : ''}</small></div> : <div><small>Not scheduled</small></div>}
        {teacher && <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
          <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" />
          <div className="row"><button onClick={() => setTime(false)}>Set</button><button className="alt" onClick={() => setTime(true)}>Clear</button></div></div>}
      </div>
      {teacher && <div className="card"><b>Manage data</b>
        <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
          <button className="alt" onClick={() => del('notes', 'notes and transcript')}>Clear notes</button>
          <button className="alt" onClick={() => del('quiz', 'the quiz')}>Clear quiz</button>
          <button className="alt" onClick={() => del('questions', 'all comments')}>Clear comments</button>
          <button className="alt" onClick={() => del('attendance', 'attendance')}>Clear attendance</button>
          <button className="alt" style={{ color: '#d93025' }} onClick={delClass}>Delete class</button></div></div>}
    </>
  );
}
