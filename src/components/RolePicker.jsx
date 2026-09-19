import React from 'react';

export default function RolePicker({ onChoose }) {
  return (
    <>
      <div className="topbar">
        <div className="brand"><div className="ball" /><h1>Torneio de Maluco</h1></div>
        <div className="sub">Como você quer entrar?</div>
      </div>
      <div className="content" style={{ paddingTop: 30 }}>
        <div className="role-card" onClick={() => onChoose('viewer')}>
          <div className="big">👀</div>
          <h3>Só quero acompanhar</h3>
          <div className="muted">Ver a classificação e os resultados dos torneios</div>
        </div>
        <div className="role-card" onClick={() => onChoose('admin')}>
          <div className="big">🏐</div>
          <h3>Sou organizador(a)</h3>
          <div className="muted">Cadastrar times, marcar pontos e ver estatísticas</div>
        </div>
      </div>
    </>
  );
}
