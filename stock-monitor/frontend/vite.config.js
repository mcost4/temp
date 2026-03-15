import { defineConfig } from 'vite';

const isCodespaces = Boolean(process.env.CODESPACE_NAME && process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN);

const codespacesHmr = isCodespaces
    ? {
          protocol: 'wss',
          host: `${process.env.CODESPACE_NAME}-3000.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`,
          clientPort: 443
      }
    : undefined;

export default defineConfig({
    server: {
        host: '0.0.0.0',
        port: 3000,
        strictPort: true,
        watch: {
            // Polling improves reliability for file change detection in containers.
            usePolling: true,
            interval: 200
        },
        hmr: codespacesHmr
    }
});
