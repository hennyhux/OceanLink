import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/mocks/server';
import { renderApp } from '@/test/renderApp';

const BASE = '/api/v1';

const adminSession = {
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'admin@example.com',
    name: 'Ada Admin',
    role: 'admin',
    is_active: true,
    preferred_language: 'en',
    must_change_password: false,
  },
  session: {
    idle_expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
    absolute_expires_at: new Date(Date.now() + 8 * 3_600_000).toISOString(),
  },
};

const operatorSession = {
  ...adminSession,
  user: {
    ...adminSession.user,
    id: '22222222-2222-4222-8222-222222222222',
    email: 'operator@example.com',
    name: 'Oscar Operator',
    role: 'operator',
  },
};

function signedInAs(session: typeof adminSession) {
  server.use(http.get(`${BASE}/auth/session`, () => HttpResponse.json(session)));
}

describe('authentication', () => {
  it('redirects a signed-out user to the login page', async () => {
    renderApp({ route: '/customers' });
    expect(
      await screen.findByRole('heading', { name: 'Sign in to OceanLink' }),
    ).toBeInTheDocument();
  });

  it('signs in with valid credentials and shows the overview', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/' });

    await screen.findByRole('heading', { name: 'Sign in to OceanLink' });
    await user.type(screen.getByLabelText(/Email/), 'admin@example.com');
    await user.type(screen.getByLabelText(/Password/), 'admin-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByText(/Signed in as/)).toBeInTheDocument();
  });

  it('stays on the login page with a clear error for wrong credentials', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/' });

    await screen.findByRole('heading', { name: 'Sign in to OceanLink' });
    await user.type(screen.getByLabelText(/Email/), 'admin@example.com');
    await user.type(screen.getByLabelText(/Password/), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The email or password is incorrect',
    );
    expect(screen.getByRole('heading', { name: 'Sign in to OceanLink' })).toBeInTheDocument();
    // Email is kept so the user does not retype it.
    expect(screen.getByLabelText(/Email/)).toHaveValue('admin@example.com');
  });

  it('shows a network error and keeps entered values when the server is unreachable', async () => {
    server.use(http.post(`${BASE}/auth/login`, () => HttpResponse.error()));
    const user = userEvent.setup();
    renderApp({ route: '/' });

    await screen.findByRole('heading', { name: 'Sign in to OceanLink' });
    await user.type(screen.getByLabelText(/Email/), 'admin@example.com');
    await user.type(screen.getByLabelText(/Password/), 'admin-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t reach the server');
    expect(screen.getByLabelText(/Email/)).toHaveValue('admin@example.com');
    expect(screen.getByLabelText(/Password/)).toHaveValue('admin-password');
  });

  it('signs out, clears cached data, and returns to the login page', async () => {
    signedInAs(adminSession);
    const user = userEvent.setup();
    const { queryClient } = renderApp({ route: '/' });

    await screen.findByRole('heading', { name: 'Overview' });
    queryClient.setQueryData(['customers', 'list'], [{ id: 'c1' }]);

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(
      await screen.findByRole('heading', { name: 'Sign in to OceanLink' }),
    ).toBeInTheDocument();
    expect(queryClient.getQueryData(['customers', 'list'])).toBeUndefined();
  });

  it('blocks an operator from the admin-only settings route and hides its nav item', async () => {
    signedInAs(operatorSession);
    renderApp({ route: '/settings' });

    expect(
      await screen.findByRole('heading', { name: 'You don’t have access to this page' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
  });

  it('lets an admin open settings and see the nav item', async () => {
    signedInAs(adminSession);
    renderApp({ route: '/settings' });

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
  });

  it('shows a retry state, not the login page, when the session check fails on the network', async () => {
    server.use(http.get(`${BASE}/auth/session`, () => HttpResponse.error()));
    const user = userEvent.setup();
    renderApp({ route: '/' });

    expect(
      await screen.findByRole('heading', { name: 'Couldn’t check your sign-in' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sign in to OceanLink' })).not.toBeInTheDocument();

    // Server comes back: retry should now succeed.
    signedInAs(adminSession);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
  });

  it('sends the user back to login with a message when a protected request returns 401', async () => {
    signedInAs(adminSession);
    renderApp({ route: '/' });
    await screen.findByRole('heading', { name: 'Overview' });

    // Simulate the backend ending the session during a later request.
    const { http: httpClient } = await import('@/lib/api/http');
    server.use(
      http.get(`${BASE}/customers`, () =>
        HttpResponse.json({ code: 'SESSION_EXPIRED', message: 'expired' }, { status: 401 }),
      ),
    );
    await expect(httpClient.get('/customers')).rejects.toMatchObject({ status: 401 });

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Sign in to OceanLink' })).toBeInTheDocument(),
    );
    expect(screen.getByText('You have been signed out')).toBeInTheDocument();
  });
});
