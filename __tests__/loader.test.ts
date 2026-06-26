import { afterEach, describe, expect, it, vi } from 'vitest';

import { MCPLoader } from '../src/loader.js';

describe('MCPLoader', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads a server manifest from URL and registers it by id', async () => {
    const loader = new MCPLoader();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          name: 'example-mcp',
          tools: [{ name: 'search', description: 'Search', parameters: { type: 'object', properties: {} } }],
        }),
      }),
    );

    const server = await loader.loadFromURL('https://mcp.example.com', 'custom-name');

    expect(server.name).toBe('custom-name');
    expect(server.url).toBe('https://mcp.example.com');
    expect(server.tools).toHaveLength(1);
    expect(loader.getServer(server.id)).toBe(server);
    expect(loader.getAllServers()).toEqual([server]);
  });

  it('skips disabled servers when loading from config', async () => {
    const loader = new MCPLoader();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ name: 'enabled-server', tools: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const servers = await loader.loadFromConfig({
      servers: {
        disabled: { url: 'https://disabled.example.com', enabled: false },
        enabled: { url: 'https://enabled.example.com' },
      },
    });

    expect(servers).toHaveLength(1);
    expect(servers[0]?.url).toBe('https://enabled.example.com');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
