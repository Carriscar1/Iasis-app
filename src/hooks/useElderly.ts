// Modo fácil: ativo para o perfil paciente (idoso) OU quando a pessoa liga
// a preferência de acessibilidade. Use em vez de checar o papel direto.
import { useStore } from '../store';

export const useElderlyMode = (): boolean => {
  const role      = useStore((s) => s.user?.role);
  const largeText = useStore((s) => s.largeText);
  return role === 'patient' || largeText;
};
