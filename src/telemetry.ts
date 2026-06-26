/**
 * MCP Telemetry
 *
 * Tracks MCP tool executions for monitoring and debugging
 */

import { MCPExecutionResult } from './types.js';

export interface MCPTelemetryEvent {
  timestamp: Date;
  serverId: string;
  serverName: string;
  toolName: string;
  success: boolean;
  executionTimeMs: number;
  error?: string;
  workflowName?: string;
  runId?: string;
}

export class MCPTelemetry {
  private events: MCPTelemetryEvent[] = [];
  private maxEvents: number = 1000;

  /**
   * Record an MCP execution
   */
  recordExecution(
    result: MCPExecutionResult,
    serverName: string,
    workflowName?: string,
    runId?: string
  ): void {
    const event: MCPTelemetryEvent = {
      timestamp: new Date(),
      serverId: result.serverId,
      serverName,
      toolName: result.toolName,
      success: result.success,
      executionTimeMs: result.executionTimeMs,
      error: result.error,
      workflowName,
      runId
    };

    this.events.push(event);

    // Keep only last N events
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Log for monitoring
    if (result.success) {
      console.log(`[MCP] ${result.toolName} executed in ${result.executionTimeMs}ms`);
    } else {
      console.error(`[MCP] ${result.toolName} failed: ${result.error}`);
    }
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit: number = 100): MCPTelemetryEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalExecutions: number;
    successCount: number;
    failureCount: number;
    averageExecutionTime: number;
  } {
    const totalExecutions = this.events.length;
    const successCount = this.events.filter(e => e.success).length;
    const failureCount = totalExecutions - successCount;
    const averageExecutionTime = totalExecutions > 0
      ? this.events.reduce((sum, e) => sum + e.executionTimeMs, 0) / totalExecutions
      : 0;

    return {
      totalExecutions,
      successCount,
      failureCount,
      averageExecutionTime
    };
  }
}
