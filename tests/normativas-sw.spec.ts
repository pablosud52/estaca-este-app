import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';

const PDF_PATHS = [
  '/docs/normativas/uso-apropiado-fondos-2026.pdf',
  '/docs/normativas/cierre-anual.pdf',
  '/docs/normativas/excepcion-de-dinero-2024.pdf',
];

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('No se pudo obtener un puerto libre')));
        return;
      }
      const { port } = address;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

function waitForPreviewServer(url: string, proc: ChildProcess, getStderr: () => string, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    proc.once('exit', (code, signal) => {
      const details = getStderr().trim();
      fail(new Error(`vite preview terminó antes de responder (code=${code}, signal=${signal})${details ? `: ${details}` : ''}`));
    });
    const check = () => {
      if (settled) return;
      http
        .get(url, (res) => {
          res.resume();
          if (!settled) {
            settled = true;
            resolve();
          }
        })
        .on('error', (err) => {
          if (Date.now() - start > timeoutMs) fail(err);
          else setTimeout(check, 200);
        });
    };
    check();
  });
}

test.describe('Regresión SW Producción — PDFs de Normativas no deben caer en index.html', () => {
  let previewProc: ChildProcess | null = null;
  let baseUrl = '';

  test.beforeAll(async () => {
    const swPath = path.resolve('dist/sw.js');
    if (!fs.existsSync(swPath)) {
      throw new Error('Falta dist/sw.js. Ejecuta "npm run build" o "npm run test:e2e" antes de correr esta prueba.');
    }

    const port = await getFreePort();
    baseUrl = `http://127.0.0.1:${port}`;
    let stderr = '';
    previewProc = spawn(
      process.execPath,
      ['./node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
      { stdio: ['ignore', 'ignore', 'pipe'] }
    );
    previewProc.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    await waitForPreviewServer(`${baseUrl}/`, previewProc, () => stderr);
  });

  test.afterAll(() => {
    if (previewProc && !previewProc.killed) {
      previewProc.kill();
    }
  });

  test('Con el Service Worker activo, los 3 PDFs de Normativas responden application/pdf y no index.html (nueva pestaña)', async ({
    page,
  }) => {
    await page.goto(`${baseUrl}/`);

    const swReady = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return Boolean(reg.active);
    });
    expect(swReady).toBe(true);

    // Recargar para quedar bajo control del Service Worker (como ocurre en Vercel)
    await page.reload();
    const isControlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
    expect(isControlled).toBe(true);

    for (const pdfPath of PDF_PATHS) {
      const responsePromise = page.waitForResponse((res) => res.url().endsWith(pdfPath));
      // En Chromium headless, navegar a application/pdf puede disparar descarga ('Download is starting')
      const navResult = await page.goto(`${baseUrl}${pdfPath}`).catch((err: Error) => {
        if (err.message.includes('Download is starting')) return null;
        throw err;
      });
      const response = navResult ?? (await responsePromise);
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('application/pdf');
      if (navResult !== null) {
        expect(await page.locator('#root').count()).toBe(0);
      }
    }
  });

  test('Con el Service Worker activo, un iframe como el de PdfViewerModal carga el PDF y no index.html', async ({
    page,
  }) => {
    await page.goto(`${baseUrl}/`);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();

    const isControlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
    expect(isControlled).toBe(true);

    for (const pdfPath of PDF_PATHS) {
      const responsePromise = page.waitForResponse((res) => res.url().includes(pdfPath));

      await page.evaluate((src) => {
        const existing = document.getElementById('test-pdf-iframe');
        if (existing) existing.remove();
        const iframe = document.createElement('iframe');
        iframe.id = 'test-pdf-iframe';
        iframe.src = `${src}#toolbar=1&view=FitH`;
        document.body.appendChild(iframe);
      }, pdfPath);

      const response = await responsePromise;
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('application/pdf');

      const iframeElement = page.locator('#test-pdf-iframe');
      const frame = await (await iframeElement.elementHandle())?.contentFrame();
      if (frame) {
        expect(await frame.locator('#root').count()).toBe(0);
      }
    }
  });
});
