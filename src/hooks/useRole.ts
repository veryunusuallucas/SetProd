import { useState, useEffect } from 'react';

export type Role = 'producao' | 'ac' | 'fotografia' | 'root';

export function useRole() {
  const [role, setRole] = useState<Role>(() => {
    return (localStorage.getItem('mock_papel') as Role) || 'root';
  });
  const [perfilId, setPerfilId] = useState<string>(() => {
    return localStorage.getItem('mock_perfil_id') || '';
  });

  useEffect(() => {
    const onStorage = () => {
      setRole((localStorage.getItem('mock_papel') as Role) || 'root');
      setPerfilId(localStorage.getItem('mock_perfil_id') || '');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const canEditProducao = role === 'producao' || role === 'ac' || role === 'root';
  const canEditEquipamentos = role === 'fotografia' || role === 'root';
  const canEditFinanceiro = role === 'producao' || role === 'root';

  return { role, perfilId, canEditProducao, canEditEquipamentos, canEditFinanceiro };
}
