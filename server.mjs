import { createServer } from 'vite';

const port = 8095;

try {
  const server = await createServer({
    configFile: './vite.config.ts',
    server: {
      host: '0.0.0.0',
      port,
      strictPort: true,
    },
  });

  await server.listen();
  console.log(`[OK] Servidor Vite iniciado en http://localhost:${port}/`);
} catch (err) {
  console.error('[ERROR] Error al iniciar el servidor:', err);
  process.exit(1);
}
