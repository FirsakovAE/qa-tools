// Vue Inspector Logs report loader. Reads the data block (plain JSON, or gzip + base64 when
// the report was exported compressed) and starts the renderer `runLogsReport(payload, text)`.
// Plain browser JS, embedded verbatim into the report after the renderer.
(function () {
  'use strict'

  var el = document.getElementById('qa-logs-data')
  var main = document.getElementById('main')

  function fail(message) {
    if (main) main.textContent = message
    console.error('[logs report] ' + message)
  }

  function start(text) {
    var payload = null
    try {
      payload = JSON.parse(text || '{}')
    } catch (e) {
      console.error('[logs report] data block is not valid JSON', e)
    }
    runLogsReport(payload, text || '')
  }

  if (!el || el.getAttribute('data-encoding') !== 'gzip-base64') {
    start(el ? el.textContent : '')
    return
  }
  if (typeof DecompressionStream !== 'function' || typeof Response !== 'function') {
    fail('This report is compressed and this browser cannot unpack it. Open it in Chrome / Edge 80+, Firefox 113+ or Safari 16.4+.')
    return
  }
  if (main) main.textContent = 'Unpacking report data...'
  var bytes
  try {
    var bin = atob((el.textContent || '').replace(/\s+/g, ''))
    bytes = new Uint8Array(bin.length)
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  } catch (e) {
    fail('Report data is damaged: ' + e.message)
    return
  }
  new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')))
    .text()
    .then(start, function (e) { fail('Report data cannot be unpacked: ' + (e && e.message)) })
})()
