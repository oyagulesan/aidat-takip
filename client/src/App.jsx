import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Login from './pages/Login.jsx';
import Payments from './pages/Payments.jsx';
import PaymentForm from './pages/PaymentForm.jsx';
import Members from './pages/Members.jsx';
import Deliveries from './pages/Deliveries.jsx';
import NewDelivery from './pages/NewDelivery.jsx';
import MemberPayments from './pages/MemberPayments.jsx';
import ChangePassword from './pages/ChangePassword.jsx';

export default function App() {
  const { user, loading, logout } = useAuth();

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
      <header className="topbar">
        <div className="brand">Aidat Takip</div>
        <nav>
          <NavLink to="/" end>{isAdmin ? 'Ödemeler' : 'Ödemelerim'}</NavLink>
          {isAdmin && (
            <>
              <NavLink to="/odeme/yeni">Ödeme Girişi</NavLink>
              <NavLink to="/uye">Kullanıcı Ödemeleri</NavLink>
              <NavLink to="/teslimatlar">Teslimatlar</NavLink>
              <NavLink to="/uyeler">Kullanıcılar</NavLink>
            </>
          )}
        </nav>
        <div className="user">
          <span>{user.name}</span>
          <NavLink to="/sifre" className="btn btn-small">Şifre değiştir</NavLink>
          <button className="btn btn-small" onClick={logout}>Çıkış</button>
        </div>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<Payments isAdmin={isAdmin} />} />
          <Route path="/sifre" element={<ChangePassword />} />
          {isAdmin && (
            <>
              <Route path="/odeme/yeni" element={<PaymentForm />} />
              <Route path="/odeme/:id" element={<PaymentForm />} />
              <Route path="/teslimatlar" element={<Deliveries />} />
              <Route path="/teslimatlar/yeni" element={<NewDelivery />} />
              <Route path="/uyeler" element={<Members />} />
              <Route path="/uye" element={<MemberPayments />} />
              <Route path="/uye/:id" element={<MemberPayments />} />
            </>
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
