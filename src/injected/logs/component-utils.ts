export type VueVersion = 2 | 3

export function componentName(instance: any, version: VueVersion): string {
  if (version === 3) {
    const type = instance?.type ?? {}
    const file: string | undefined = type.__file
    const fromFile = file ? file.split(/[\\/]/).pop()?.replace(/\.vue$/, '') : undefined
    return type.name || type.__name || fromFile || 'Anonymous'
  }
  const opts = instance?.$options ?? {}
  return opts.name || opts._componentTag || 'Anonymous'
}

// Strings from the injected bundle must stay ASCII: the page may decode the script as Latin-1
export function parentChain(instance: any, version: VueVersion): string {
  const names: string[] = []
  let p = version === 3 ? instance?.parent : instance?.$parent
  while (p && names.length < 3) {
    names.unshift(componentName(p, version))
    p = version === 3 ? p.parent : p.$parent
  }
  return names.join(' > ')
}

export function componentUid(instance: any, version: VueVersion): number | undefined {
  return version === 3 ? instance?.uid : instance?._uid
}
