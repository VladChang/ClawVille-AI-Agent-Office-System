type OperatorRole = 'viewer' | 'operator' | 'admin';

function parseRole(value: string | undefined): OperatorRole | null {
  if (value === 'viewer' || value === 'operator' || value === 'admin') return value;
  return null;
}

export interface OperatorIdentity {
  id: string;
  role: OperatorRole;
}

export function getOperatorIdentity(): OperatorIdentity {
  return {
    id: process.env.NEXT_PUBLIC_OPERATOR_ID?.trim() || 'demo-operator',
    role: parseRole(process.env.NEXT_PUBLIC_OPERATOR_ROLE) ?? 'operator'
  };
}

export function getOperatorHeaders(): Record<string, string> {
  const identity = getOperatorIdentity();
  return {
    'x-operator-id': identity.id,
    'x-operator-role': identity.role
  };
}
