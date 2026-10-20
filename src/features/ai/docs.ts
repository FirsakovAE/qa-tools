/**
 * Vue Inspector documentation for the assistant. The pages themselves load on the first
 * read_docs call so opening the AI tab does not keep every markdown file in memory.
 */

let catalog: Promise<typeof import('./docsCatalog')> | null = null

function load() {
  return catalog ??= import('./docsCatalog')
}

export async function readDocs(pages: unknown, section?: string): Promise<string> {
  return (await load()).readDocs(pages, section)
}
