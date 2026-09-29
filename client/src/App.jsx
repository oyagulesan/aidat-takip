import { useEffect, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import Payments from './pages/Payments.jsx';
import PaymentForm from './pages/PaymentForm.jsx';
import Members from './pages/Members.jsx';
import Deliveries from './pages/Deliveries.jsx';
import NewDelivery from './pages/NewDelivery.jsx';
import MemberPayments from './pages/MemberPayments.jsx';
import ChangePassword from './pages/ChangePassword.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
  const { user, loading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  // Close the mobile menu after navigating or on Escape.
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  if (loading) return <div className="center muted">Yükleniyor…</div>;
  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  const isAdmin = user.role === 'admin';

  return (
    <div className="app">
      <header className={`topbar ${menuOpen ? 'menu-open' : ''}`}>
        <div className="brand">Aidat Takip</div>
        <button
          className="menu-toggle"
          aria-label={menuOpen ? 'Menüyü kapat' : 'Menüyü aç'}
          aria-expanded={menuOpen}
          aria-controls="main-menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>
        <div className="menu" id="main-menu">
          <nav>
            <NavLink to="/" end>{isAdmin ? 'Ana sayfa' : 'Ödemelerim'}</NavLink>
            {isAdmin && (
              <>
                <NavLink to="/odemeler">Ödemeler</NavLink>
                <NavLink to="/odeme/yeni">Ödeme Girişi</NavLink>
                <NavLink to="/uye">Kullanıcı Ödemeleri</NavLink>
                <NavLink to="/teslimatlar">Teslimatlar</NavLink>
                <NavLink to="/uyeler">Kullanıcılar</NavLink>
                <NavLink to="/ayarlar">Ayarlar</NavLink>
              </>
            )}
          </nav>
          <div className="user">
            <span>{user.name}</span>
            <NavLink to="/sifre" className="btn btn-small">Şifre değiştir</NavLink>
            <button className="btn btn-small" onClick={logout}>Çıkış</button>
          </div>
        </div>
      </header>
      {menuOpen && <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />}
      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/sifre" element={<ChangePassword />} />
          {isAdmin && (
            <>
              <Route path="/odemeler" element={<Payments />} />
              <Route path="/odeme/yeni" element={<PaymentForm />} />
              <Route path="/odeme/:id" element={<PaymentForm />} />
              <Route path="/teslimatlar" element={<Deliveries />} />
              <Route path="/teslimatlar/yeni" element={<NewDelivery />} />
              <Route path="/uyeler" element={<Members />} />
              <Route path="/uye" element={<MemberPayments />} />
              <Route path="/uye/:id" element={<MemberPayments />} />
              <Route path="/ayarlar" element={<Settings />} />
            </>
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
