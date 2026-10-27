export type AccessRole = 'citizen' | 'manager' | 'collaborator';
export type AccessArea = AccessRole;
export type AccessProfile = { role: AccessRole; accountStatus: 'active' | 'suspended'; active?: boolean } | null;

export const areaRole: Record<AccessArea, AccessRole> = {
  citizen: 'citizen',
  manager: 'manager',
  collaborator: 'collaborator',
};

export function profileAccessIssue(profile: AccessProfile) {
  if (!profile) return 'Não encontramos um perfil de acesso para esta conta.';
  if (profile.accountStatus !== 'active') return 'Esta conta está suspensa. Fale com a administração para recuperar o acesso.';
  if (profile.role === 'collaborator' && profile.active === false) return 'Este colaborador está inativo. Fale com a gestão para reativar o acesso.';
  return '';
}

export function canAccessProfile(profile: AccessProfile) { return !profileAccessIssue(profile); }
export function hasAreaAccess(profile: AccessProfile, area: AccessArea) { return canAccessProfile(profile) && profile?.role === areaRole[area]; }

export function roleHome(role: AccessRole) { return role === 'manager' ? '/gestor' : role === 'collaborator' ? '/colaborador' : '/meus-relatos'; }
export function allowedDestination(role: AccessRole, requested: string) {
  const route = requested.split('?')[0];
  if (role === 'citizen') return route === '/relatar' || route === '/meus-relatos';
  if (role === 'manager') return route === '/gestor' || route.startsWith('/gestor/');
  return route === '/colaborador';
}
export function safeDestination(profile: AccessProfile, requested: string) {
  if (!profile) return '/meus-relatos';
  return requested && allowedDestination(profile.role, requested) ? requested : roleHome(profile.role);
}
