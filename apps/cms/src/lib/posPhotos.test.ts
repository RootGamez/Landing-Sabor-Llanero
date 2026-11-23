import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PHOTO_WIDTHS,
  SHOW_PHOTOS_STORAGE_KEY,
  canResizePhotos,
  isSlowConnection,
  photoSrc,
  photoSrcSet,
  readShowPhotos,
  writeShowPhotos,
  type PhotoEnv,
} from './posPhotos';

const PROD: PhotoEnv = { apiBaseUrl: 'https://api.saborllanero.online', pageHostname: 'cms.saborllanero.online' };
const LOCAL: PhotoEnv = { apiBaseUrl: 'http://localhost:8787', pageHostname: 'localhost' };
const KEY = 'items/1/foto.jpg';

describe('fotos del POS: URLs', () => {
  it('redimensiona solo cuando CMS y API comparten zona https', () => {
    assert.equal(canResizePhotos(PROD), true);
    assert.equal(canResizePhotos(LOCAL), false);
    assert.equal(canResizePhotos({ ...PROD, pageHostname: 'sabor-llanero-cms.workers.dev' }), false);
    assert.equal(
      canResizePhotos({ apiBaseUrl: 'http://api.saborllanero.online', pageHostname: 'cms.saborllanero.online' }),
      false,
    );
  });

  it('arma la ruta /cdn-cgi/image con recorte cuadrado y fallback al origen', () => {
    const src = photoSrc(KEY, 160, PROD);
    assert.ok(src.startsWith('/cdn-cgi/image/width=160,height=160,fit=cover,'));
    assert.ok(src.includes('onerror=redirect'));
    assert.ok(src.endsWith('/https://api.saborllanero.online/api/media/items/1/foto.jpg'));
  });

  it('devuelve la URL original (y sin srcset) fuera de la zona', () => {
    assert.equal(photoSrc(KEY, 160, LOCAL), 'http://localhost:8787/api/media/items/1/foto.jpg');
    assert.equal(photoSrcSet(KEY, LOCAL), undefined);
  });

  it('genera un srcset por cada ancho', () => {
    const srcSet = photoSrcSet(KEY, PROD) ?? '';
    for (const width of PHOTO_WIDTHS) assert.ok(srcSet.includes(` ${width}w`));
  });
});

describe('fotos del POS: preferencia', () => {
  const store = (value: string | null) => ({ getItem: () => value });

  it('respeta lo guardado por el dueño, incluso en conexión lenta', () => {
    assert.equal(readShowPhotos(store('0')), false);
    assert.equal(readShowPhotos(store('1'), { saveData: true }), true);
  });

  it('sin valor guardado: encendidas, salvo ahorro de datos o 2G', () => {
    assert.equal(readShowPhotos(store(null)), true);
    assert.equal(readShowPhotos(store(null), { effectiveType: '4g' }), true);
    assert.equal(readShowPhotos(store(null), { saveData: true }), false);
    assert.equal(readShowPhotos(store(null), { effectiveType: '2g' }), false);
    assert.equal(isSlowConnection(undefined), false);
  });

  it('un almacenamiento que lanza error no rompe nada', () => {
    const broken = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    };
    assert.equal(readShowPhotos(broken), true);
    assert.doesNotThrow(() => writeShowPhotos(broken, false));
  });

  it('guarda 1/0', () => {
    const saved: Record<string, string> = {};
    writeShowPhotos({ setItem: (key, value) => void (saved[key] = value) }, false);
    assert.equal(saved[SHOW_PHOTOS_STORAGE_KEY], '0');
  });
});
