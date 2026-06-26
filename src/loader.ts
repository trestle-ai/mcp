/**
 * MCP Server Loader
 *
 * Loads MCP servers from various sources: URLs, config files, directories
 */

import { MCPServer, MCPConfig } from './types.js';

export class MCPLoader {
  private servers: Map<string, MCPServer> = new Map();

  /**
   * Load MCP server from URL
   */
  async loadFromURL(url: string, name?: string): Promise<MCPServer> {
    try {
      // Fetch manifest from MCP server
      const response = await fetch(`${url}/mcp/manifest`, {
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch manifest: ${response.statusText}`);
      }

      const manifest = await response.json() as { name?: string; tools?: any[] };

      const server: MCPServer = {
        id: this.generateId(url),
        name: name || manifest.name || url,
        url,
        tools: manifest.tools || [],
        status: 'active',
        lastHealthCheck: new Date(),
      };

      this.servers.set(server.id, server);
      return server;
    } catch (error) {
      throw new Error(`Failed to load MCP server from ${url}: ${(error as Error).message}`);
    }
  }

  /**
   * Load MCP servers from config object
   */
  async loadFromConfig(config: MCPConfig): Promise<MCPServer[]> {
    const servers: MCPServer[] = [];

    for (const [name, serverConfig] of Object.entries(config.servers)) {
      if (serverConfig.enabled === false) continue;

      if (serverConfig.url) {
        const server = await this.loadFromURL(serverConfig.url, name);
        servers.push(server);
      }
    }

    return servers;
  }

  /**
   * Get server by ID
   */
  getServer(id: string): MCPServer | undefined {
    return this.servers.get(id);
  }

  /**
   * Get all loaded servers
   */
  getAllServers(): MCPServer[] {
    return Array.from(this.servers.values());
  }

  /**
   * Health check for server
   */
  async healthCheck(serverId: string): Promise<boolean> {
    const server = this.servers.get(serverId);
    if (!server) return false;

    try {
      if (server.url) {
        const response = await fetch(`${server.url}/health`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });

        const isHealthy = response.ok;
        server.status = isHealthy ? 'active' : 'error';
        server.lastHealthCheck = new Date();

        return isHealthy;
      }
      return true;
    } catch {
      server.status = 'error';
      return false;
    }
  }

  private generateId(source: string): string {
    return Buffer.from(source).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
  }
}
