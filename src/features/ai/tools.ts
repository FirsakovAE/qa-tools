import type { AiStep, ToolDefinition } from './types'
import type { AiAccess, AiToolGroup } from './credentials'
import { getEvents, searchLogs } from './logsContext'
import { listSources, readSource, searchSource } from './sources'
import { readDocs } from './docs'

export const AI_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'read_docs',
      description: 'Vue Inspector user documentation: what its tabs, buttons, menus and options do and how to use them. Call without pages for the list of page ids and their sections, then pass up to 3 page ids (optionally a section heading).',
      parameters: {
        type: 'object',
        properties: {
          pages: { type: 'array', items: { type: 'string' }, description: 'Page ids from the list, up to 3' },
          section: { type: 'string', description: 'Optional heading text: return only this section of each page' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_events',
      description: 'Full data of logged events by id (#N from the digest): bodies, headers, store state, props, payloads, stacks. An error also names Page (last navigation), Data later (when store data arrived) and nearby events. Stack frames include page code when source maps exist. Pass every id in one call.',
      parameters: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'integer' }, description: 'Event ids without "#", up to 6' },
        },
        required: ['ids'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_logs',
      description: 'Find logged events by text and / or by property. Searches whole request and response bodies, headers, URL params, WebSocket messages, store state, props and payloads. `key` and `value` match single values (key alone: events that have the property; value alone: any property with that value). Every match lists `path = value`, so one call shows which requests carry a value. Many matches are grouped by endpoint; page with offset. Search before saying a value is not in the logs.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Case-insensitive text in titles, URLs, property names or values' },
          key: { type: 'string', description: 'Property, header or param name, exact and case-insensitive (dealId); a path ending (data.items.id); or ~text for names containing the text' },
          value: { type: 'string', description: 'Text the value contains (case-insensitive); with exact: true the whole value' },
          exact: { type: 'boolean', description: 'value must equal the whole value' },
          kind: { type: 'string', description: 'Optional event kind: request, response, ws, ws-sent, ws-received, ws-closed, props, emit, store, action, navigation, error' },
          limit: { type: 'integer', description: 'Max results, default 20, up to 40' },
          offset: { type: 'integer', description: 'Skip this many results (next page)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_sources',
      description: 'Scripts loaded by the inspected page and the original files from their source maps (Vue components, stores, services). Use before reading code.',
      parameters: {
        type: 'object',
        properties: {
          filter: { type: 'string', description: 'Optional substring of a URL or file path' },
          include_libraries: { type: 'boolean', description: 'Also list node_modules files' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_source',
      description: 'Read page code. `path` is a script URL or an original file path. For a stack frame or a search_source match pass the script URL with line and column: the position is mapped to the original file when a source map exists. Minified scripts can only be read at a line and column.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          line: { type: 'integer', description: '1-based line to center on' },
          column: { type: 'integer', description: '1-based column (stack frames)' },
          context: { type: 'integer', description: 'Lines around `line`, default 20' },
          start_line: { type: 'integer', description: 'Range start when no line is given' },
          end_line: { type: 'integer', description: 'Range end when no line is given' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_source',
      description: 'Search page code (original files when source maps exist, otherwise the scripts) for a text or a regular expression. Returns file:line matches; in minified lines file:line:column with the code around the match, often enough without read_source.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          regex: { type: 'boolean', description: 'Treat query as a JavaScript regular expression' },
          path: { type: 'string', description: 'Optional substring of the file path or URL to search in' },
          include_libraries: { type: 'boolean', description: 'Also search node_modules files' },
        },
        required: ['query'],
      },
    },
  },
]

/** Access group of a tool; documentation is always available */
export const TOOL_GROUPS: Record<string, AiToolGroup | undefined> = {
  get_events: 'logs',
  search_logs: 'logs',
  list_sources: 'sources',
  read_source: 'sources',
  search_source: 'sources',
}

/** Tools the user did not turn off */
export function allowedTools(access: AiAccess): ToolDefinition[] {
  return AI_TOOLS.filter(t => {
    const group = TOOL_GROUPS[t.function.name]
    return !group || access.tools[group] !== 'deny'
  })
}

function short(value: unknown, max = 60): string {
  const text = String(value ?? '')
  return text.length > max ? `${text.slice(0, max)}...` : text
}

export function describeToolCall(name: string, args: Record<string, any>): AiStep {
  switch (name) {
    case 'read_docs':
      return { tool: 'Docs', summary: Array.isArray(args.pages) && args.pages.length ? `Read ${args.pages.map(p => short(p)).join(', ')}${args.section ? ` § ${short(args.section)}` : ''}` : 'List pages' }
    case 'get_events':
      return { tool: 'Logs', summary: `Event details ${(Array.isArray(args.ids) ? args.ids : [args.ids]).map((id: unknown) => `#${id}`).join(', ')}` }
    case 'search_logs': {
      const parts = [
        args.query && `"${short(args.query)}"`,
        args.key && `key ${short(args.key)}`,
        args.value && `value ${args.exact ? '=' : '~'} "${short(args.value)}"`,
      ].filter(Boolean)
      return { tool: 'Logs', summary: `Search ${parts.join(', ') || '(empty)'}${args.kind ? ` in ${args.kind}` : ''}${Number(args.offset) > 0 ? `, from ${args.offset}` : ''}` }
    }
    case 'list_sources':
      return { tool: 'Sources', summary: `List files${args.filter ? ` matching "${short(args.filter)}"` : ''}` }
    case 'read_source':
      return { tool: 'Sources', summary: `Read ${short(args.path, 90)}${args.line ? `:${args.line}${args.column ? `:${args.column}` : ''}` : ''}` }
    case 'search_source':
      return { tool: 'Sources', summary: `Search code "${short(args.query)}"${args.path ? ` in ${short(args.path)}` : ''}` }
    default:
      return { tool: name, summary: '' }
  }
}

export async function runTool(name: string, args: Record<string, any>): Promise<string> {
  try {
    switch (name) {
      case 'read_docs':
        return await readDocs(args.pages ?? args.page, args.section)
      case 'get_events':
        return await getEvents(args.ids)
      case 'search_logs':
        return searchLogs(args)
      case 'list_sources':
        return await listSources(args.filter, args.include_libraries)
      case 'read_source':
        return await readSource(args)
      case 'search_source':
        return await searchSource(args)
      default:
        return `Unknown tool "${name}".`
    }
  } catch (e) {
    return `Tool failed: ${String((e as Error)?.message || e)}`
  }
}
