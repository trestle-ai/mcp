/**
 * MCP Type Definitions
 */

export interface MCPServer {
  id: string;
  name: string;
  url?: string;
  configPath?: string;
  tools: MCPTool[];
  status: 'active' | 'inactive' | 'error';
  lastHealthCheck?: Date;
  metadata?: Record<string, any>;
}

export interface MCPTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, MCPParameter>;
    required?: string[];
  };
}

export interface MCPParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  enum?: any[];
  default?: any;
}

export interface MCPConfig {
  servers: {
    [key: string]: {
      url?: string;
      path?: string;
      credentials?: Record<string, string>;
      enabled?: boolean;
    };
  };
}

export interface MCPExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  executionTimeMs: number;
  toolName: string;
  serverId: string;
}

export interface MCPExecutionContext {
  workflowName: string;
  stepName: string;
  runId: string;
  input: Record<string, any>;
  previousSteps: Record<string, any>;
}
