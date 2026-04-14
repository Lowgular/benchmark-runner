import type { AgentMiddleware } from 'langchain';

const formatToolArgs = (args: unknown): string => {
  if (args == null) return '{}';
  if (typeof args === 'string') return args;
  try {
    return JSON.stringify(args);
  } catch {
    return '[unserializable args]';
  }
};

export const createToolTraceMiddleware = (): AgentMiddleware => ({
  name: 'ToolTraceMiddleware',
  wrapModelCall: async (request, handler) => {
    const response = await handler(request);
    if (Array.isArray(response.tool_calls) && response.tool_calls.length > 0) {
      const toolCalls = response.tool_calls
        .map((tc) => `${tc.name}`)
        .join(', ');
      console.log(`[agent] model requested tool call(s): ${toolCalls}`);
    } else {
      console.log('[agent] model produced response (no tool call)');
    }
    return response;
  },
  wrapToolCall: async (request, handler) => {
    const toolName = request.toolCall?.name ?? 'unknown';
    const toolArgs = formatToolArgs(request.toolCall?.args);
    console.log(`[agent] executing tool: ${toolName}(${toolArgs})`);
    const result = await handler(request);
    console.log(`[agent] tool responded: ${toolName}`);
    return result;
  },
});
