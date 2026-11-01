/**
 * VitePress compares a page path from fs.realpathSync with the Rollup module id.
 * On Windows the JS realpath lowercases the drive letter (c:) while Rollup keeps
 * the canonical one (C:), so the page chunk is not found. The native realpath
 * keeps that canonical casing.
 */
const fs = require('fs')

if (process.platform === 'win32' && typeof fs.realpathSync.native === 'function') {
  const native = fs.realpathSync.native
  fs.realpathSync = Object.assign((path, options) => native(path, options), { native })
}
