import { describe, expect, it } from 'vitest';
import { templates } from './index';

describe('plantilla password-reset', () => {
  const render = (data: { link: string; expiresMinutes: number }) =>
    templates['password-reset'].render(data);

  it('incluye el link y el vencimiento en HTML y texto', () => {
    const { subject, html, text } = render({
      link: 'https://saborllanero.online/cuenta/restablecer/#token=abc_123',
      expiresMinutes: 30,
    });

    expect(subject).toBe('Recuperar tu contraseña');
    expect(html).toContain('https://saborllanero.online/cuenta/restablecer/#token=abc_123');
    expect(html).toContain('30 minutos');
    expect(text).toContain('https://saborllanero.online/cuenta/restablecer/#token=abc_123');
    expect(text).toContain('30 minutos');
  });

  it('escapa el link dentro del HTML', () => {
    const { html } = render({
      link: 'https://saborllanero.online/x?a=1&b="><script>alert(1)</script>',
      expiresMinutes: 30,
    });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&amp;b=');
    expect(html).toContain('&quot;');
  });

  it('declara `link` como campo de link a validar', () => {
    expect(templates['password-reset'].linkFields).toEqual(['link']);
  });

  describe('isAllowedLink', () => {
    const TOKEN = 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v';
    const allowed = (link: string) => templates['password-reset'].isAllowedLink(new URL(link));

    it.each([
      `https://saborllanero.online/cuenta/restablecer/#token=${TOKEN}`,
      `https://cms.saborllanero.online/reset-password#token=${TOKEN}`,
    ])('acepta %s', (link) => {
      expect(allowed(link)).toBe(true);
    });

    it.each([
      `https://saborllanero.online/cuenta/login/#token=${TOKEN}`,
      `https://saborllanero.online/cuenta/restablecer/?a=1#token=${TOKEN}`,
      'https://saborllanero.online/cuenta/restablecer/#token=demasiado-corto',
      `https://saborllanero.online/cuenta/restablecer/#otro=${TOKEN}`,
      `https://saborllanero.online/cuenta/restablecer/#token=${TOKEN}&x=1`,
      `https://saborllanero.online/cuenta/restablecer/`,
    ])('rechaza %s', (link) => {
      expect(allowed(link)).toBe(false);
    });
  });
});
