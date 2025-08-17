import React, { useEffect, useMemo, useState } from "react";

// ================================================
// KOPRASI PRODUSEN BOGOR CASSAVA INDUSTRI
// Single-file React template suitable for GitHub Pages (hash-based routing)
// - Member & Admin portals
// - Registration, Loan Apply, Approvals, Payments
// - LocalStorage as mock database
// - TailwindCSS styling (no setup needed in Canvas preview)
// How to use in GitHub Pages:
// 1) Use this as App.jsx (or index.jsx) in a Vite React project
// 2) Ensure you serve with hash routing (this template uses window.location.hash)
// 3) Deploy build output to 1rumah.github.io/koperasibci.com
// ================================================

// ---------- Utilities ----------
const LS_KEYS = {
  members: "bci_members",
  loans: "bci_loans",
  payments: "bci_payments",
  user: "bci_session_user",
  admin: "bci_session_admin",
};

const load = (k, fallback) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; }
};
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const fmt = (n) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(n||0));
const today = () => new Date().toISOString().slice(0,10);

function useHashRoute() {
  const [route, setRoute] = useState(() => window.location.hash.replace('#','') || "/");
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash.replace('#','') || "/");
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return [route, (r) => { window.location.hash = r; } ];
}

function NavLink({ to, children }) {
  const active = (window.location.hash.replace('#','') || "/") === to;
  return (
    <a href={`#${to}`} className={`px-3 py-2 rounded-xl hover:bg-gray-100 ${active? 'font-semibold bg-gray-100' : ''}`}>{children}</a>
  );
}

// ---------- Seed Admin (first load) ----------
(function seedAdmin(){
  const admin = load(LS_KEYS.admin, null);
  if(!admin){ save(LS_KEYS.admin, { username: 'admin@koperasibci', name: 'Admin Koperasi', loggedIn: false }); }
})();

// ---------- Layout ----------
function Shell({ children }){
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 text-gray-800">
      <header className="sticky top-0 z-20 backdrop-blur bg-white/70 border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-black">BCI</div>
            <div>
              <div className="text-lg font-bold">KOPRASI PRODUSEN BOGOR CASSAVA INDUSTRI</div>
              <div className="text-xs text-gray-500">Platform Koperasi Digital • Simpan Pinjam & Produksi</div>
            </div>
          </div>
          <nav className="text-sm hidden md:flex items-center gap-1">
            <NavLink to="/">Beranda</NavLink>
            <NavLink to="/member">Anggota</NavLink>
            <NavLink to="/admin">Admin</NavLink>
            <a className="px-3 py-2 rounded-xl hover:bg-gray-100" href="#/tentang">Tentang</a>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
      <footer className="border-t mt-10 py-6 text-sm text-gray-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-2">
          <div>© {new Date().getFullYear()} Koperasi Produsen BCI. All rights reserved.</div>
          <div className="flex gap-3">
            <a href="#/kebijakan" className="hover:text-gray-700">Kebijakan Privasi</a>
            <a href="#/syarat" className="hover:text-gray-700">Syarat & Ketentuan</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ---------- Member Auth & State ----------
function useMembers(){
  const [members, setMembers] = useState(() => load(LS_KEYS.members, []));
  const persist = (next) => { setMembers(next); save(LS_KEYS.members, next); };
  return { members, setMembers: persist };
}
function useLoans(){
  const [loans, setLoans] = useState(() => load(LS_KEYS.loans, []));
  const persist = (next) => { setLoans(next); save(LS_KEYS.loans, next); };
  return { loans, setLoans: persist };
}
function usePayments(){
  const [payments, setPayments] = useState(() => load(LS_KEYS.payments, []));
  const persist = (next) => { setPayments(next); save(LS_KEYS.payments, next); };
  return { payments, setPayments: persist };
}

function MemberPortal(){
  const { members, setMembers } = useMembers();
  const { loans, setLoans } = useLoans();
  const { payments, setPayments } = usePayments();
  const [session, setSession] = useState(() => load(LS_KEYS.user, null));
  useEffect(()=> save(LS_KEYS.user, session), [session]);

  const member = useMemo(()=> members.find(m => m.id === session?.memberId), [members, session]);

  if(!session?.loggedIn){
    return <MemberAuth onLogin={(m)=> setSession({ loggedIn:true, memberId:m.id })} onRegister={(m)=>{ setMembers([...members, m]); setSession({loggedIn:true, memberId:m.id}); }} members={members} />
  }

  const memberLoans = loans.filter(l => l.memberId === member.id);
  const memberPayments = payments.filter(p => p.memberId === member.id);

  const applyLoan = (data) => {
    const rec = {
      id: uid(), memberId: member.id, createdAt: today(), status: 'PENDING',
      amount: Number(data.amount), tenor: Number(data.tenor), purpose: data.purpose,
      collateral: data.collateral, rate: null, adminFee: 0, approvedAt: null, monthly: null, outstanding: Number(data.amount)
    };
    setLoans([rec, ...loans]);
  };

  const makePayment = (loanId, amount) => {
    amount = Number(amount);
    const loan = loans.find(l => l.id === loanId);
    if(!loan || loan.status === 'CLOSED') return;
    const payRec = { id: uid(), memberId: member.id, loanId, amount, paidAt: today(), channel: 'QRIS' };
    const nextPayments = [payRec, ...payments];
    let remaining = Math.max(0, (loan.outstanding ?? loan.amount) - amount);
    const nextLoans = loans.map(l => l.id !== loanId ? l : { ...l, outstanding: remaining, status: remaining === 0 ? 'CLOSED' : l.status });
    setPayments(nextPayments); setLoans(nextLoans);
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Dashboard Anggota</h2>
          <button className="text-sm px-3 py-1 rounded-lg bg-gray-100" onClick={()=>{ setSession(null); }}>Keluar</button>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <StatCard title="Nomor Anggota" value={member.memberNo} />
          <StatCard title="Pinjaman Aktif" value={fmt(memberLoans.filter(l=>l.status!=='CLOSED').reduce((a,b)=>a+(b.outstanding ?? b.amount),0))} />
          <StatCard title="Total Dibayar" value={fmt(memberPayments.reduce((a,b)=>a+b.amount,0))} />
        </div>

        <section className="mt-6">
          <h3 className="font-semibold mb-2">Ajukan Pinjaman</h3>
          <LoanApply onSubmit={applyLoan} />
        </section>

        <section className="mt-6">
          <h3 className="font-semibold mb-2">Pinjaman Saya</h3>
          <div className="space-y-3">
            {memberLoans.length===0 && <Empty text="Belum ada pinjaman."/>}
            {memberLoans.map(l => (
              <div key={l.id} className="p-4 rounded-2xl border bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold">{fmt(l.amount)} • {l.tenor} bulan</div>
                    <div className="text-xs text-gray-500">Status: {l.status} · Pengajuan: {l.createdAt} {l.approvedAt? `· Disetujui: ${l.approvedAt}`:''}</div>
                    {l.rate!=null && <div className="text-xs text-gray-500">Bunga {l.rate}% flat · Admin Fee {fmt(l.adminFee)} · Angsuran/bln {fmt(l.monthly)}</div>}
                  </div>
                  <div className="text-right">
                    <div className="text-sm">Sisa: <span className="font-semibold">{fmt(l.outstanding ?? l.amount)}</span></div>
                    {l.status==='APPROVED' && (
                      <div className="mt-2 flex gap-2">
                        <PayWidget onPay={(amt)=> makePayment(l.id, amt)} defaultAmount={l.monthly || Math.ceil((l.amount + (l.amount * (l.rate||0)/100)) / (l.tenor||1))} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div>
        <ProfileCard member={member} onUpdate={(partial)=>{
          const next = members.map(m => m.id===member.id? { ...m, ...partial }: m);
          setMembers(next);
        }} />
        <section className="mt-6 p-4 rounded-2xl border bg-white">
          <h3 className="font-semibold mb-2">Riwayat Pembayaran</h3>
          <div className="space-y-3 max-h-80 overflow-auto">
            {memberPayments.length===0 && <Empty text="Belum ada pembayaran."/>}
            {memberPayments.map(p => (
              <div key={p.id} className="text-sm flex items-center justify-between">
                <div>
                  <div className="font-medium">{fmt(p.amount)}</div>
                  <div className="text-xs text-gray-500">{p.paidAt} • {p.channel}</div>
                </div>
                <div className="text-xs">Loan: {p.loanId.slice(-6)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function MemberAuth({ onLogin, onRegister, members }){
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ nik:'', name:'', phone:'', address:'', password:'', collateral:'' });
  const [login, setLogin] = useState({ memberNo:'', password:'' });

  const handleRegister = (e) => {
    e.preventDefault();
    const exists = members.some(m => m.nik === form.nik);
    if(exists){ alert('NIK sudah terdaftar'); return; }
    const id = uid();
    const member = {
      id,
      memberNo: 'BCI-' + new Date().getFullYear() + '-' + id.slice(0,5).toUpperCase(),
      nik: form.nik, name: form.name, phone: form.phone, address: form.address,
      password: form.password, collateral: form.collateral, joinedAt: today(),
      savings: { pokok: 100000, wajib: 50000, sukarela: 0 },
    };
    onRegister(member);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const m = members.find(mm => (mm.memberNo===login.memberNo || mm.nik===login.memberNo) && mm.password===login.password);
    if(!m){ alert('Nomor anggota/NIK atau password salah'); return; }
    onLogin(m);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="text-2xl font-bold">Portal Anggota</div>
        <div className="text-sm text-gray-500">Masuk atau daftar menjadi anggota KOPRASI PRODUSEN BCI</div>
      </div>

      <div className="flex gap-2 mb-4">
        <button className={`px-4 py-2 rounded-xl border ${tab==='login'?'bg-gray-900 text-white':'bg-white'}`} onClick={()=>setTab('login')}>Masuk</button>
        <button className={`px-4 py-2 rounded-xl border ${tab==='daftar'?'bg-gray-900 text-white':'bg-white'}`} onClick={()=>setTab('daftar')}>Daftar</button>
      </div>

      {tab==='login' ? (
        <form onSubmit={handleLogin} className="grid gap-3 bg-white p-5 rounded-2xl border">
          <L label="Nomor Anggota atau NIK"><I value={login.memberNo} onChange={e=>setLogin({...login, memberNo:e.target.value})} placeholder="BCI-2025-ABCDE atau NIK"/></L>
          <L label="Password"><I type="password" value={login.password} onChange={e=>setLogin({...login, password:e.target.value})} placeholder="••••••"/></L>
          <div className="flex gap-3">
            <button className="px-4 py-2 rounded-xl bg-emerald-600 text-white">Masuk</button>
            <a className="text-sm underline" href="#/">Kembali ke Beranda</a>
          </div>
        </form>
      ) : (
        <form onSubmit={handleRegister} className="grid md:grid-cols-2 gap-3 bg-white p-5 rounded-2xl border">
          <L label="NIK"><I value={form.nik} onChange={e=>setForm({...form, nik:e.target.value})} required /></L>
          <L label="Nama Lengkap"><I value={form.name} onChange={e=>setForm({...form, name:e.target.value})} required /></L>
          <L label="No. HP/WA"><I value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} required /></L>
          <L label="Alamat"><I value={form.address} onChange={e=>setForm({...form, address:e.target.value})} required /></L>
          <L label="Password"><I type="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} required /></L>
          <L label="Jaminan (opsional)"><I value={form.collateral} onChange={e=>setForm({...form, collateral:e.target.value})} placeholder="Sertifikat rumah/kebun"/></L>
          <div className="md:col-span-2 flex gap-3 mt-2">
            <button className="px-4 py-2 rounded-xl bg-emerald-600 text-white">Daftarkan</button>
            <a className="text-sm underline" href="#/">Kembali ke Beranda</a>
          </div>
        </form>
      )}
    </div>
  );
}

function ProfileCard({ member, onUpdate }){
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState(member);
  useEffect(()=> setForm(member), [member]);
  return (
    <section className="p-4 rounded-2xl border bg-white">
      <h3 className="font-semibold mb-2">Profil Anggota</h3>
      {!edit ? (
        <div className="text-sm">
          <div className="font-medium">{member.name}</div>
          <div className="text-gray-500">{member.memberNo} • NIK {member.nik}</div>
          <div className="mt-2">HP/WA: {member.phone}</div>
          <div>Alamat: {member.address}</div>
          <div className="mt-2 text-xs text-gray-500">Bergabung: {member.joinedAt}</div>
          <button className="mt-3 text-sm px-3 py-1 rounded-lg bg-gray-100" onClick={()=>setEdit(true)}>Ubah</button>
        </div>
      ) : (
        <div className="grid gap-2 text-sm">
          <L label="Nama"><I value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/></L>
          <L label="HP/WA"><I value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})}/></L>
          <L label="Alamat"><I value={form.address} onChange={e=>setForm({...form, address:e.target.value})}/></L>
          <div className="flex gap-2 mt-1">
            <button className="px-3 py-1 rounded-lg bg-emerald-600 text-white" onClick={()=>{ onUpdate({ name:form.name, phone:form.phone, address:form.address }); setEdit(false); }}>Simpan</button>
            <button className="px-3 py-1 rounded-lg bg-gray-100" onClick={()=>setEdit(false)}>Batal</button>
          </div>
        </div>
      )}
    </section>
  );
}

function LoanApply({ onSubmit }){
  const [f, setF] = useState({ amount:'3000000', tenor:'6', purpose:'Modal kerja', collateral:'' });
  const estMonthly = useMemo(()=> Math.ceil((Number(f.amount||0) * 1.02) / (Number(f.tenor||1))), [f]);
  return (
    <form onSubmit={(e)=>{ e.preventDefault(); onSubmit(f); setF({...f, amount:'', purpose:''}); }} className="grid md:grid-cols-4 gap-3 p-4 rounded-2xl border bg-white">
      <L label="Nominal (IDR)"><I type="number" min="100000" value={f.amount} onChange={e=>setF({...f, amount:e.target.value})} required/></L>
      <L label="Tenor (bulan)"><select className="w-full border rounded-xl px-3 py-2" value={f.tenor} onChange={e=>setF({...f, tenor:e.target.value})}>
        {[3,6,9,12,18,24].map(n=>(<option key={n} value={n}>{n}</option>))}
      </select></L>
      <L label="Tujuan"><I value={f.purpose} onChange={e=>setF({...f, purpose:e.target.value})} required/></L>
      <L label="Jaminan (opsional)"><I value={f.collateral} onChange={e=>setF({...f, collateral:e.target.value})} placeholder="Sertifikat rumah/kebun"/></L>
      <div className="md:col-span-4 flex items-center justify-between text-sm mt-1">
        <div className="text-gray-500">Estimasi angsuran/bln (bunga simulasi 2%): <span className="font-medium">{fmt(estMonthly)}</span></div>
        <button className="px-4 py-2 rounded-xl bg-emerald-600 text-white">Ajukan</button>
      </div>
    </form>
  );
}

function PayWidget({ onPay, defaultAmount }){
  const [amt, setAmt] = useState(defaultAmount || 0);
  return (
    <div className="flex items-center gap-2">
      <input type="number" value={amt} onChange={e=>setAmt(e.target.value)} className="w-32 border rounded-xl px-3 py-2"/>
      <button onClick={()=> onPay(amt)} className="px-3 py-2 rounded-xl bg-emerald-600 text-white">Bayar</button>
    </div>
  );
}

function StatCard({ title, value }){
  return (
    <div className="p-4 rounded-2xl bg-white border">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function Empty({ text }){
  return <div className="text-sm text-gray-500 px-3 py-2 bg-gray-50 rounded-xl border">{text}</div>;
}

// ---------- Admin Portal ----------
function AdminPortal(){
  const { members, setMembers } = useMembers();
  const { loans, setLoans } = useLoans();
  const { payments } = usePayments();
  const [admin, setAdmin] = useState(() => load(LS_KEYS.admin, null));
  useEffect(()=> save(LS_KEYS.admin, admin), [admin]);

  if(!admin?.loggedIn){
    return <AdminLogin onLogin={(name)=> setAdmin({ ...admin, name, loggedIn:true })} />
  }

  const pending = loans.filter(l => l.status==='PENDING');
  const active = loans.filter(l => l.status==='APPROVED');
  const closed = loans.filter(l => l.status==='CLOSED');

  const approve = (id, rate=2, adminFee=0) => {
    const next = loans.map(l => {
      if(l.id!==id) return l;
      const total = l.amount + (l.amount * rate/100);
      const monthly = Math.ceil(total / l.tenor);
      return { ...l, status:'APPROVED', rate, adminFee, approvedAt: today(), monthly };
    });
    setLoans(next);
  };
  const reject = (id) => {
    setLoans(loans.map(l => l.id===id? { ...l, status:'REJECTED' } : l));
  };

  const exportCSV = () => {
    const headers = ["loanId","memberNo","name","amount","tenor","status","createdAt","approvedAt","rate","monthly","outstanding"];
    const rows = loans.map(l => {
      const m = members.find(mm=>mm.id===l.memberId);
      return [l.id, m?.memberNo, m?.name, l.amount, l.tenor, l.status, l.createdAt, l.approvedAt||'', l.rate||'', l.monthly||'', l.outstanding??l.amount];
    });
    const csv = [headers.join(','), ...rows.map(r=> r.join(','))].join('\n');
    const blob = new Blob([csv], { type:'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `bci_loans_${today()}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Dashboard Admin</h2>
          <div className="text-xs text-gray-500">Halo, {admin?.name}</div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="px-3 py-2 rounded-xl bg-gray-900 text-white">Export CSV</button>
          <button onClick={()=> setAdmin({ username: admin.username, name: admin.name, loggedIn:false })} className="px-3 py-2 rounded-xl bg-gray-100">Keluar</button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <StatCard title="Anggota" value={members.length} />
        <StatCard title="Pinjaman Aktif" value={active.length} />
        <StatCard title="Total Pembayaran" value={fmt(payments.reduce((a,b)=>a+b.amount,0))} />
      </div>

      <section className="mt-6 grid md:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl border bg-white">
          <h3 className="font-semibold mb-3">Pengajuan Menunggu</h3>
          {pending.length===0 && <Empty text="Tidak ada pengajuan menunggu."/>}
          <div className="space-y-3">
            {pending.map(l => {
              const m = members.find(mm=>mm.id===l.memberId);
              return (
                <div key={l.id} className="p-3 border rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{m?.name} · {m?.memberNo}</div>
                      <div className="text-xs text-gray-500">{fmt(l.amount)} · {l.tenor} bln · Tujuan: {l.purpose}</div>
                    </div>
                    <div className="text-xs text-gray-500">{l.createdAt}</div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2 items-end">
                    <L label="Bunga %"><I type="number" defaultValue={2} id={`rate-${l.id}`} className="w-24"/></L>
                    <L label="Admin Fee"><I type="number" defaultValue={0} id={`fee-${l.id}`} className="w-32"/></L>
                    <button className="px-3 py-2 rounded-xl bg-emerald-600 text-white" onClick={()=>{
                      const rate = Number(document.getElementById(`rate-${l.id}`).value||2);
                      const fee = Number(document.getElementById(`fee-${l.id}`).value||0);
                      approve(l.id, rate, fee);
                    }}>Setujui</button>
                    <button className="px-3 py-2 rounded-xl bg-red-50 text-red-600" onClick={()=>reject(l.id)}>Tolak</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 rounded-2xl border bg-white">
          <h3 className="font-semibold mb-3">Pinjaman Aktif</h3>
          {active.length===0 && <Empty text="Belum ada pinjaman aktif."/>}
          <div className="space-y-3 max-h-96 overflow-auto pr-1">
            {active.map(l => {
              const m = members.find(mm=>mm.id===l.memberId);
              return (
                <div key={l.id} className="p-3 border rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{m?.name} · {m?.memberNo}</div>
                      <div className="text-xs text-gray-500">Angsuran/bln {fmt(l.monthly)} · Sisa {fmt(l.outstanding ?? l.amount)}</div>
                    </div>
                    <div className="text-xs text-gray-500">Bunga {l.rate}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-6 p-4 rounded-2xl border bg-white">
        <h3 className="font-semibold mb-3">Arsip Pinjaman Selesai</h3>
        {closed.length===0 && <Empty text="Belum ada pinjaman selesai."/>}
        <div className="grid md:grid-cols-3 gap-3">
          {closed.map(l => {
            const m = members.find(mm=>mm.id===l.memberId);
            return (
              <div key={l.id} className="p-3 border rounded-xl bg-gray-50">
                <div className="text-sm font-medium">{m?.name}</div>
                <div className="text-xs text-gray-500">{fmt(l.amount)} · {l.tenor} bln · Bunga {l.rate}%</div>
                <div className="text-xs">Disetujui: {l.approvedAt}</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function AdminLogin({ onLogin }){
  const [f, setF] = useState({ username:'admin@koperasibci', password:'admin' });
  return (
    <div className="max-w-md mx-auto">
      <div className="mb-6">
        <div className="text-2xl font-bold">Masuk Admin</div>
        <div className="text-sm text-gray-500">Gunakan username default: admin@koperasibci (password bebas untuk demo)</div>
      </div>
      <form onSubmit={(e)=>{ e.preventDefault(); onLogin('Admin Koperasi'); }} className="grid gap-3 p-5 rounded-2xl border bg-white">
        <L label="Username"><I value={f.username} onChange={e=>setF({...f, username:e.target.value})}/></L>
        <L label="Password"><I type="password" value={f.password} onChange={e=>setF({...f, password:e.target.value})}/></L>
        <button className="px-4 py-2 rounded-xl bg-gray-900 text-white">Masuk</button>
      </form>
    </div>
  );
}

// ---------- Static Pages ----------
function Home(){
  return (
    <div>
      <div className="grid md:grid-cols-2 gap-8 items-center">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold leading-tight">Koperasi Digital untuk Produsen Singkong Bogor</h1>
          <p className="mt-3 text-gray-600">Sederhanakan simpan pinjam, percepat perputaran modal, dan tingkatkan kesejahteraan anggota dengan platform koperasi terintegrasi ala aplikasi pinjaman modern.</p>
          <div className="mt-5 flex gap-3">
            <a href="#/member" className="px-5 py-3 rounded-2xl bg-emerald-600 text-white">Masuk Anggota</a>
            <a href="#/admin" className="px-5 py-3 rounded-2xl bg-gray-900 text-white">Masuk Admin</a>
          </div>
          <ul className="mt-6 text-sm text-gray-600 list-disc pl-5 space-y-1">
            <li>Registrasi & verifikasi anggota</li>
            <li>Pengajuan pinjaman, persetujuan admin, dan simulasi angsuran</li>
            <li>Riwayat pembayaran & ekspor data CSV</li>
            <li>Privasi & transparansi ala koperasi</li>
          </ul>
        </div>
        <div className="p-6 rounded-3xl border bg-white shadow-sm">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-4 rounded-2xl bg-gray-50 border">
              <div className="text-xs text-gray-500">Total Anggota</div>
              <div className="text-2xl font-bold">{(load(LS_KEYS.members, [])).length}</div>
            </div>
            <div className="p-4 rounded-2xl bg-gray-50 border">
              <div className="text-xs text-gray-500">Pinjaman Berjalan</div>
              <div className="text-2xl font-bold">{(load(LS_KEYS.loans, [])).filter(l=>l.status==='APPROVED').length}</div>
            </div>
            <div className="p-4 rounded-2xl bg-gray-50 border">
              <div className="text-xs text-gray-500">Pembayaran Tercatat</div>
              <div className="text-2xl font-bold">{(load(LS_KEYS.payments, [])).length}</div>
            </div>
            <div className="p-4 rounded-2xl bg-gray-50 border">
              <div className="text-xs text-gray-500">Sejak</div>
              <div className="text-2xl font-bold">2025</div>
            </div>
          </div>
        </div>
      </div>

      <section className="mt-12 grid md:grid-cols-3 gap-6">
        {[
          { t:"Transparan", d:"Semua status pinjaman & pembayaran tercatat dan dapat diakses anggota."},
          { t:"Cepat", d:"Proses persetujuan sederhana dengan parameter bunga & biaya admin yang jelas."},
          { t:"Aman", d:"Data disimpan terenkripsi di server (demo: localStorage)."},
        ].map((x,i)=>(
          <div key={i} className="p-6 rounded-2xl bg-white border">
            <div className="text-lg font-semibold">{x.t}</div>
            <div className="text-gray-600 mt-1 text-sm">{x.d}</div>
          </div>
        ))}
      </section>
    </div>
  );
}

function StaticPage({ title, children }){
  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold mb-2">{title}</h2>
      <div className="prose prose-sm max-w-none">{children}</div>
    </div>
  );
}

// ---------- UI Primitives ----------
function L({ label, children }){
  return (
    <label className="text-sm grid gap-1">
      <span className="text-xs text-gray-500">{label}</span>
      {children}
    </label>
  );
}
function I(props){
  const cls = `w-full border rounded-xl px-3 py-2 ${props.className||''}`;
  return <input {...props} className={cls}/>;
}

// ---------- Main App (Hash Router) ----------
export default function App(){
  const [route] = useHashRoute();
  return (
    <Shell>
      {route === '/' && <Home/>}
      {route === '/member' && <MemberPortal/>}
      {route === '/admin' && <AdminPortal/>}
      {route === '/tentang' && (
        <StaticPage title="Tentang Koperasi">
          <p>KOPRASI PRODUSEN BOGOR CASSAVA INDUSTRI adalah koperasi produsen yang menghimpun anggota petani dan pelaku industri singkong di wilayah Bogor dan sekitarnya. Platform ini memfasilitasi layanan simpan pinjam dan pencatatan transaksi secara digital.</p>
        </StaticPage>
      )}
      {route === '/kebijakan' && (
        <StaticPage title="Kebijakan Privasi">
          <p>Demo ini menyimpan data di browser (localStorage). Pada produksi, gunakan server dan database aman (mis. PostgreSQL), enkripsi data sensitif, serta autentikasi OTP/MFA.</p>
        </StaticPage>
      )}
      {route === '/syarat' && (
        <StaticPage title="Syarat & Ketentuan">
          <ul>
            <li>Akses khusus anggota koperasi yang sah.</li>
            <li>Keputusan pinjaman mengikuti kebijakan pengurus dan AD/ART.</li>
            <li>Segala bentuk penyalahgunaan akun menjadi tanggung jawab pemilik akun.</li>
          </ul>
        </StaticPage>
      )}
      {!["/","/member","/admin","/tentang","/kebijakan","/syarat"].includes(route) && (
        <StaticPage title="Halaman Tidak Ditemukan">Halaman tidak tersedia.</StaticPage>
      )}
    </Shell>
  );
}
