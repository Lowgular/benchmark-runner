import type { AgentMiddleware } from 'langchain';

/**
 * Removes the built-in planning tool (`write_todos`) from available tools.
 * Useful for short, single-task runs where planning loops add latency.
 */
export function createNoPlanningMiddleware(): AgentMiddleware {
  return {
    name: 'NoPlanningMiddleware',
    wrapModelCall: async (request, handler) => {
      const toolsWithoutPlanning =
        request.tools?.filter((tool) => tool.name !== 'write_todos') ??
        request.tools;
      return handler({ ...request, tools: toolsWithoutPlanning });
    },
  };
}

