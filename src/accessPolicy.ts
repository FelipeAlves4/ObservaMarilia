export type AccessRole = 'admin' | 'citizen' | 'manager' | 'collaborator';
export type AccessArea = AccessRole;
export type AccessProfile = { role: AccessRole; accountStatus: 'active' | 'suspended'; active?: boolean } | null;

export const areaRole: Record<AccessArea, AccessRole> = {
  admin: 'admin',
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
export function canOpenProtectedRoute(profile: AccessProfile, route: string) {
  const role = profile?.role;
  if (route === '/cidadao' || route.startsWith('/cidadao/')) return canAccessProfile(profile) && role === 'admin';
  if (route === '/relatar' || route === '/meus-relatos') return canAccessProfile(profile) && role === 'citizen';
  if (route.startsWith('/gestor')) return canAccessProfile(profile) && (role === 'manager' || role === 'admin');
  if (route === '/colaborador') return canAccessProfile(profile) && (role === 'collaborator' || role === 'admin');
  if (route.startsWith('/admin')) return canAccessProfile(profile) && role === 'admin';
  return true;
}

export function roleHome(role: AccessRole) { return role === 'admin' ? '/admin/secretarias' : role === 'manager' ? '/gestor' : role === 'collaborator' ? '/colaborador' : '/meus-relatos'; }
export function allowedDestination(role: AccessRole, requested: string) {
  const route = requested.split('?')[0];
  if (role === 'admin') return route === '/admin/secretarias' || route === '/admin/gestores' || route === '/cidadao' || route.startsWith('/cidadao/');
  if (role === 'citizen') return route === '/relatar' || route === '/meus-relatos';
  if (role === 'manager') return route === '/gestor' || route.startsWith('/gestor/');
  return route === '/colaborador';
}
export function safeDestination(profile: AccessProfile, requested: string) {
  if (!profile) return '/meus-relatos';
  return requested && allowedDestination(profile.role, requested) ? requested : roleHome(profile.role);
}
