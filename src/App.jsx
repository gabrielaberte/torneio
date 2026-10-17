import { useEffect, useState } from 'react';
import { getRole, setRole, clearRole, clearLegacyJsonbinKey } from './lib/storage';
import RolePicker from './components/RolePicker';
import AdminRoot from './components/AdminRoot';
import React from 'react';
import PublicViewer from './components/public/PublicViewer';

export default function App() {
  const [role, setRoleState] = useState(getRole());
  useEffect(() => { clearLegacyJsonbinKey(); }, []);

  function chooseRole(r) {
    setRole(r);
    setRoleState(r);
  }
  function switchRole() {
    clearRole();
    setRoleState(null);
  }

  if (!role) return <RolePicker onChoose={chooseRole} />;
  if (role === 'admin') return <AdminRoot onSwitchRole={switchRole} />;
  return <PublicViewer onSwitchRole={switchRole} />;
}
