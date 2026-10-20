import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderApp } from '@/test/renderApp';

describe('language', () => {
  it('defaults to Simplified Chinese on first use', async () => {
    renderApp({ route: '/', language: 'zh-CN' });
    expect(await screen.findByRole('heading', { name: '登录 OceanLink' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('zh-CN');
  });

  it('switches to English and back without losing the login form', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/', language: 'zh-CN' });

    await screen.findByRole('heading', { name: '登录 OceanLink' });
    await user.type(screen.getByLabelText(/邮箱/), 'admin@example.com');

    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(
      await screen.findByRole('heading', { name: 'Sign in to OceanLink' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toHaveValue('admin@example.com');
    expect(window.localStorage.getItem('oceanlink.language')).toBe('en');

    await user.click(screen.getByRole('button', { name: '中文' }));
    expect(await screen.findByRole('heading', { name: '登录 OceanLink' })).toBeInTheDocument();
    expect(screen.getByLabelText(/邮箱/)).toHaveValue('admin@example.com');
  });

  it('shows translated validation messages', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/', language: 'zh-CN' });

    await screen.findByRole('heading', { name: '登录 OceanLink' });
    await user.click(screen.getByRole('button', { name: '登录' }));

    expect((await screen.findAllByText('请填写此项。')).length).toBeGreaterThan(0);
  });
});
