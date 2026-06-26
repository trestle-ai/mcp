/**
 * MCP Tool Executor
 *
 * Executes MCP tools with context interpolation and retry logic
 */

import { MCPServer, MCPTool, MCPExecutionResult, MCPExecutionContext } from './types.js';

export interface MCPRetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableErrors: string[];
}

const DEFAULT_RETRY_CONFIG: MCPRetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'fetch failed',
    '429', // Rate limit
    '500', // Internal server error
    '502', // Bad gateway
    '503', // Service unavailable
    '504', // Gateway timeout
  ],
};

export class MCPExecutor {
  private retryConfig: MCPRetryConfig;

  constructor(retryConfig?: Partial<MCPRetryConfig>) {
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  /**
   * Execute an MCP tool with retry logic
   */
  async execute(
    server: MCPServer,
    toolName: string,
    params: Record<string, any>,
    context: MCPExecutionContext
  ): Promise<MCPExecutionResult> {
    const startTime = Date.now();

    try {
      // Find the tool
      const tool = server.tools.find(t => t.name === toolName);
      if (!tool) {
        throw new Error(`Tool ${toolName} not found on server ${server.name}`);
      }

      // Interpolate context variables in params
      const interpolatedParams = this.interpolateParams(params, context);

      // Validate parameters
      this.validateParams(interpolatedParams, tool);

      // Call the MCP server with retry
      if (!server.url) {
        throw new Error(`Server ${server.name} has no URL configured`);
      }

      const result = await this.executeWithRetry(
        server.url,
        toolName,
        interpolatedParams
      );

      const executionTimeMs = Date.now() - startTime;

      return {
        success: true,
        output: result.output || result,
        executionTimeMs,
        toolName,
        serverId: server.id
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      return {
        success: false,
        error: (error as Error).message,
        executionTimeMs,
        toolName,
        serverId: server.id
      };
    }
  }

  /**
   * Execute HTTP request with exponential backoff retry
   */
  private async executeWithRetry(
    serverUrl: string,
    toolName: string,
    params: Record<string, any>
  ): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const response = await fetch(`${serverUrl}/mcp/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            tool: toolName,
            parameters: params
          })
        });

        if (!response.ok) {
          const statusError = `HTTP ${response.status}: ${response.statusText}`;
          if (this.isRetryable(statusError) && attempt < this.retryConfig.maxRetries) {
            lastError = new Error(statusError);
            await this.delay(attempt);
            continue;
          }
          throw new Error(`Tool execution failed: ${statusError}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error as Error;

        if (this.isRetryable(lastError.message) && attempt < this.retryConfig.maxRetries) {
          await this.delay(attempt);
          continue;
        }

        throw error;
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Check if error is retryable
   */
  private isRetryable(errorMessage: string): boolean {
    return this.retryConfig.retryableErrors.some(
      pattern => errorMessage.includes(pattern)
    );
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private async delay(attempt: number): Promise<void> {
    const exponentialDelay = this.retryConfig.baseDelayMs * Math.pow(2, attempt);
    const jitter = Math.random() * 0.3 * exponentialDelay; // 30% jitter
    const delay = Math.min(exponentialDelay + jitter, this.retryConfig.maxDelayMs);

    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Interpolate context variables in parameters
   * Supports {{step.output}}, {{input.field}}, etc.
   */
  private interpolateParams(
    params: Record<string, any>,
    context: MCPExecutionContext
  ): Record<string, any> {
    const interpolated: Record<string, any> = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        interpolated[key] = this.interpolateString(value, context);
      } else if (typeof value === 'object' && value !== null) {
        interpolated[key] = this.interpolateParams(value, context);
      } else {
        interpolated[key] = value;
      }
    }

    return interpolated;
  }

  private interpolateString(str: string, context: MCPExecutionContext): any {
    const regex = /\{\{([^}]+)\}\}/g;

    // If entire string is a template, return the value directly
    const fullMatch = str.match(/^\{\{([^}]+)\}\}$/);
    if (fullMatch) {
      return this.getNestedValue(context, fullMatch[1].trim());
    }

    // Replace templates in string
    return str.replace(regex, (_, path) => {
      const value = this.getNestedValue(context, path.trim());
      return value !== undefined ? String(value) : '';
    });
  }

  private getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;

    // First try direct access
    for (const part of parts) {
      if (current === null || current === undefined) {
        break;
      }
      current = current[part];
    }

    // If not found and first part might be a step name, try in previousSteps
    if (current === undefined && obj.previousSteps && parts.length > 0) {
      const stepName = parts[0];
      if (obj.previousSteps[stepName]) {
        current = obj.previousSteps;
        for (const part of parts) {
          if (current === null || current === undefined) {
            return undefined;
          }
          current = current[part];
        }
      }
    }

    return current;
  }

  private validateParams(params: Record<string, any>, tool: MCPTool): void {
    const required = tool.parameters.required || [];

    for (const param of required) {
      if (!(param in params)) {
        throw new Error(`Missing required parameter: ${param}`);
      }
    }
  }
}
