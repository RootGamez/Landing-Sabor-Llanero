import { describe, expect, it } from 'vitest';
import { EMAIL_MAX_SKEW_SECONDS, signEmailBody, verifyEmailSignature } from '@sabor/shared';

const SECRET = 'secret';
const BODY = '{"hello":"world"}';
const NOW_MS = 1_800_000_000_000;
const NOW_S = String(NOW_MS / 1000);

async function verify(overrides: Partial<Parameters<typeof verifyEmailSignature>[0]> = {}) {
  return verifyEmailSignature({
    secret: SECRET,
    timestamp: NOW_S,
    signature: await signEmailBody(SECRET, NOW_S, BODY),
    body: BODY,
    nowMs: NOW_MS,
    ...overrides,
  });
}

describe('firma HMAC del contrato de email', () => {
  it('acepta una firma válida', async () => {
    expect(await verify()).toBe(true);
  });

  it('rechaza un secret distinto', async () => {
    const signature = await signEmailBody('otro-secret', NOW_S, BODY);

    expect(await verify({ signature })).toBe(false);
  });

  it('rechaza un body alterado', async () => {
    expect(await verify({ body: '{"hello":"mundo"}' })).toBe(false);
  });

  it('rechaza un timestamp alterado aunque la firma sea de otro momento', async () => {
    const signature = await signEmailBody(SECRET, NOW_S, BODY);
    const otherTimestamp = String(Number(NOW_S) + 1);

    expect(await verify({ timestamp: otherTimestamp, signature })).toBe(false);
  });

  it('rechaza firmas fuera de la ventana, pasadas o futuras', async () => {
    const past = String(Number(NOW_S) - EMAIL_MAX_SKEW_SECONDS - 1);
    const future = String(Number(NOW_S) + EMAIL_MAX_SKEW_SECONDS + 1);

    expect(await verify({ timestamp: past, signature: await signEmailBody(SECRET, past, BODY) })).toBe(false);
    expect(await verify({ timestamp: future, signature: await signEmailBody(SECRET, future, BODY) })).toBe(false);
  });

  it.each([
    ['vacía', ''],
    ['no hexadecimal', 'zz'.repeat(32)],
    ['de largo impar', 'abc'],
  ])('rechaza una firma %s', async (_label, signature) => {
    expect(await verify({ signature })).toBe(false);
  });

  it.each([
    ['ausente', undefined],
    ['no numérico', 'abc'],
    ['decimal', '1800000000.5'],
  ])('rechaza un timestamp %s', async (_label, timestamp) => {
    expect(await verify({ timestamp })).toBe(false);
  });
});
