import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Can from '../components/auth/Can';
import * as AuthContextModule from '../context/AuthContext';

describe('<Can> component', () => {
  it('renders children when user has the required permission', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { role: { name: 'reviewer', permissions: ['case.read', 'case.update'] } },
      hasPermission: (perm) => ['case.read', 'case.update'].includes(perm),
      hasRole: (role) => role === 'reviewer',
    });

    render(
      <Can permission="case.create" fallback={<div>Access Restricted</div>}>
        <div>Case Create Action Allowed</div>
      </Can>,
    );

    // Permission denied: should show fallback
    expect(screen.getByText('Access Restricted')).toBeDefined();
    expect(screen.queryByText('Case Create Action Allowed')).toBeNull();
  });

  it('renders children when user is admin or has role', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { role: { name: 'admin', permissions: ['*'] } },
      hasPermission: () => true,
      hasRole: () => true,
    });

    render(
      <Can role="admin" fallback={<div>Not Admin</div>}>
        <div>Admin Controls Panel</div>
      </Can>,
    );

    expect(screen.getByText('Admin Controls Panel')).toBeDefined();
    expect(screen.queryByText('Not Admin')).toBeNull();
  });
});
