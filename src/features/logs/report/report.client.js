// Vue Inspector Logs report renderer. Plain browser JS, embedded verbatim into the report.
// Runs as the body of `runLogsReport(QA_PAYLOAD, QA_PAYLOAD_TEXT)`, called by the loader
// (report.boot.js) with the data block, and renders the Logs view. Events are stored
// compactly; `LogsRuntime` (embedded before this script) restores titles, store states and
// network entries the same way the Logs tab does.
// Page data is only ever inserted with textContent (JSON highlighting escapes first).
// Keep it free of multi-line template literals and of the closing script tag sequence.
(function () {
  'use strict'

  var APP_URL = 'https://firsakovae.github.io/qa-tools/'
  var BOOSTY_URL = 'https://boosty.to/adambarmy'
  var USDT_ADDRESS = 'TPStwFujav3ZZATYb43iwHrrpMCZaoud84'
  var USDT_QR_SIZE = 29
  var USDT_QR = '1111111001101111000110111111110000010010111111110001000001101110101011110100100010111011011101011111011010100101110110111010110110011000101011101100000101010100001101010000011111111010101010101010111111100000000100110101011100000000101111100101100001001011111001101110010111111000110011100110101011001101110010111000000111100010010010110100110010010011011010101011100100011111001000000110010000111110111000011101111011100100001101011000001100101000011000100001101001101110100010001000100100010111010000111011000110000110001000011011100111011000000010010011000110001011000110111010101110111010101100001111111000000000011000000110110001100011111110000110011111101011000100000101100101110101000110111011101010011001110011111011010111010110010101010100100111101110101000111110100001101101000001000100110100011111101011111110111100000101000010100'
  var PAGE_SIZE = 300
  // Above this, skip JSON.parse/pretty-print and mount only the visible rows.
  // A multi-megabyte body in one <pre> blocks the page for seconds.
  var LARGE_TEXT = 200 * 1024
  var VROW_H = 18
  var VOVERSCAN = 8
  var GROUPS = [
    { title: 'Network', kinds: ['request', 'response'] },
    { title: 'WebSocket', kinds: ['ws', 'ws-sent', 'ws-received', 'ws-closed'] },
    { title: 'Components', kinds: ['props', 'emit'] },
    { title: 'Pinia', kinds: ['store', 'action'] },
    { title: 'Page', kinds: ['navigation', 'error'] },
  ]
  var KNOWN = ['request', 'response', 'ws', 'ws-sent', 'ws-received', 'ws-closed', 'props', 'emit', 'store', 'action', 'navigation', 'error']

  var doc = document
  // Parsed (and unpacked) by the loader; QA_PAYLOAD_TEXT is the same data as JSON text
  var payload = QA_PAYLOAD && typeof QA_PAYLOAD === 'object' ? QA_PAYLOAD : { info: {}, events: [] }
  var info = payload.info || {}
  var kindsMeta = info.kinds || {}
  var kindLabels = {}
  Object.keys(kindsMeta).forEach(function (k) { if (kindsMeta[k] && kindsMeta[k].label) kindLabels[k] = kindsMeta[k].label })

  var RT = LogsRuntime
  if (payload.snapshots && typeof payload.snapshots === 'object') RT.loadSnapshots(payload.snapshots)
  var hasOwn = function (obj, key) { return !!obj && Object.prototype.hasOwnProperty.call(obj, key) }
  var network = payload.network && typeof payload.network === 'object' ? payload.network : {}
  var entryCache = {}
  function getEntry(id) {
    if (id == null || !hasOwn(network.entries, id)) return undefined
    if (!hasOwn(entryCache, id)) {
      var stored = network.entries[id]
      entryCache[id] = stored && typeof stored === 'object'
        ? RT.resolveEntry(Object.assign({ id: id }, stored), function (ref) { return hasOwn(network.bodies, ref) ? network.bodies[ref] : undefined })
        : undefined
    }
    return entryCache[id]
  }

  var rawEvents = (Array.isArray(payload.events) ? payload.events : []).filter(function (raw) { return raw && typeof raw === 'object' })
  rawEvents.forEach(function (raw) {
    var resolved = raw.data && typeof raw.data === 'object' ? RT.resolveValue(raw.data) : {}
    raw.data = resolved && typeof resolved === 'object' ? resolved : {}
    if (typeof raw.key !== 'string') raw.key = String(raw.key || '')
  })
  var ctx = { stores: RT.indexStores(rawEvents), getEntry: getEntry }

  var events = rawEvents.map(function (raw, index) {
    var ts = typeof raw.timestamp === 'number' ? raw.timestamp : Date.parse(raw.time)
    var described = { title: raw.key }
    try { described = RT.describe(raw, ctx) } catch (err) { /* keep the key */ }
    return {
      index: index,
      raw: raw,
      kind: String(raw.kind || 'other'),
      label: RT.eventLabel(raw, kindLabels),
      ts: isFinite(ts) ? ts : 0,
      level: raw.level || 'info',
      title: String(described.title || '(untitled)'),
      subtitle: described.subtitle == null ? '' : String(described.subtitle),
      key: raw.key,
      data: raw.data,
    }
  })
  // Newest first, as in the Logs tab
  var ordered = events.slice().sort(function (a, b) { return b.ts - a.ts || b.index - a.index })

  function isWsKind(kind) {
    return kind === 'ws' || kind === 'ws-sent' || kind === 'ws-received' || kind === 'ws-closed'
  }

  function isNetwork(e) { return e.kind === 'request' || e.kind === 'response' || isWsKind(e.kind) }

  function sectionId(e) {
    if (e.data && e.data.ws) return e.kind === 'response' ? 'ws-closed' : 'ws'
    return e.kind
  }

  function sectionLabel(id) {
    if (id === 'ws') return 'WebSocket open'
    if (id === 'ws-closed') return 'WebSocket closed'
    return label(id)
  }

  function sectionColor(id) {
    if (id === 'ws') return 'request'
    if (id === 'ws-closed') return 'response'
    return id
  }
  function entryOf(e) { return isNetwork(e) ? getEntry(e.data.entryId) : undefined }

  // Request and response events of one network entry: "<kind>:<entryId>" -> event
  var networkPairs = {}
  events.forEach(function (e) {
    if (isNetwork(e) && e.data.entryId != null) networkPairs[e.kind + ':' + e.data.entryId] = e
  })
  function pairedEvent(e) {
    if (!e.data || e.data.entryId == null) return null
    if (e.kind === 'ws' || e.kind === 'ws-sent' || e.kind === 'ws-received') return networkPairs['ws-closed:' + e.data.entryId] || null
    if (e.kind === 'ws-closed') return networkPairs['ws:' + e.data.entryId] || null
    if (e.kind !== 'request' && e.kind !== 'response') return null
    return networkPairs[(e.kind === 'request' ? 'response:' : 'request:') + e.data.entryId] || null
  }

  function isCleanClose(code) {
    return code == null || code === 1000 || code === 1001 || code === 1005
  }

  function isFailed(e) {
    var en = (e.kind === 'response' || e.kind === 'ws-closed') && entryOf(e)
    if (!en) return false
    if (en.websocket) return !!en.error || en.websocket.reconnect === false || !isCleanClose(en.websocket.closeCode)
    return !!en.error || Number(en.status) >= 400
  }

  // Full views (restored states, change values, entry halves); a few recent ones are kept
  var views = []
  function viewOf(e) {
    for (var i = 0; i < views.length; i++) if (views[i].e === e) return views[i].v
    var v = RT.hydrate(e.raw, ctx, kindLabels)
    views.unshift({ e: e, v: v })
    if (views.length > 8) views.pop()
    return v
  }

  // Overview cards open "All events" narrowed by one of these (hash "#all:<filter>")
  var FILTERS = {
    errors: { label: 'Errors', test: function (e) { return e.level === 'error' } },
    failed: { label: 'Failed requests / WS', test: isFailed },
  }

  var state = { section: 'overview', filter: '', selected: -1, tab: '', query: '', inData: false, limit: PAGE_SIZE, typeOpen: false }
  // On a narrow screen Locate hides the details overlay so the list stays visible
  var listFocus = false
  var visible = []
  var rendered = { section: null, filter: null, query: null, inData: null, types: null }

  // Kinds present in this file, in Logs-tab order. All are on until the All events filter changes them.
  var typeSeen = {}
  events.forEach(function (e) { typeSeen[e.kind] = true })
  var typeOptions = KNOWN.filter(function (k) { return typeSeen[k] })
  Object.keys(typeSeen).forEach(function (k) { if (typeOptions.indexOf(k) === -1) typeOptions.push(k) })
  var enabledTypes = {}
  typeOptions.forEach(function (k) { enabledTypes[k] = true })

  function allTypesOn() {
    for (var i = 0; i < typeOptions.length; i++) if (!enabledTypes[typeOptions[i]]) return false
    return typeOptions.length > 0
  }

  function anyTypeOn() {
    for (var i = 0; i < typeOptions.length; i++) if (enabledTypes[typeOptions[i]]) return true
    return false
  }

  function typesKey() {
    var s = ''
    for (var i = 0; i < typeOptions.length; i++) s += enabledTypes[typeOptions[i]] ? '1' : '0'
    return s
  }
  var searchText = new WeakMap()

  // ---------------------------------------------------------------- helpers

  function h(tag, attrs, children) {
    var el = doc.createElement(tag)
    if (attrs) {
      for (var k in attrs) {
        var v = attrs[k]
        if (v == null || v === false) continue
        if (k === 'class') el.className = v
        else if (k === 'text') el.textContent = v
        else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v)
        else el.setAttribute(k, v === true ? '' : v)
      }
    }
    add(el, children)
    return el
  }

  function add(el, c) {
    if (c == null || c === false) return
    if (Array.isArray(c)) c.forEach(function (x) { add(el, x) })
    else el.appendChild(typeof c === 'object' ? c : doc.createTextNode(String(c)))
  }

  function $(id) { return doc.getElementById(id) }

  function pad(n, w) { n = String(n); while (n.length < (w || 2)) n = '0' + n; return n }

  function fmtTime(ts) {
    var d = new Date(ts)
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + '.' + pad(d.getMilliseconds(), 3)
  }

  function fmtDateTime(ts) { return new Date(ts).toLocaleDateString() + ' ' + fmtTime(ts) }

  function fmtBytes(b) {
    b = Number(b) || 0
    if (b < 1024) return b + ' B'
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
    return (b / 1048576).toFixed(1) + ' MB'
  }

  function fmtDuration(ms) {
    ms = Number(ms) || 0
    return ms < 1000 ? ms.toFixed(2) + ' ms' : (ms / 1000).toFixed(2) + ' s'
  }

  function fmtDurationMs(ms) {
    ms = Number(ms)
    return (isFinite(ms) ? ms : 0).toFixed(2) + ' ms'
  }

  function label(kind) {
    var m = kindsMeta[kind]
    return (m && m.label) || kind
  }

  function kindClass(kind) { return 'k-' + (KNOWN.indexOf(kind) === -1 ? 'other' : kind) }

  function pretty(value) {
    if (value === undefined) return ''
    try {
      var compact = JSON.stringify(value)
      if (compact == null) return ''
      if (compact.length > LARGE_TEXT) return compact
      return JSON.stringify(value, null, 2)
    } catch (e) { return String(value) }
  }

  function preview(value, max) {
    var text
    if (value === undefined) return 'undefined'
    try { text = JSON.stringify(value) } catch (e) { text = String(value) }
    if (text === undefined) text = String(value)
    max = max || 300
    return text.length > max ? text.slice(0, max) + '...' : text
  }

  function isOmitted(v) { return !!v && typeof v === 'object' && v.__omitted === true }

  // Older exports flagged complete non-ASCII bodies as truncated (characters compared with
  // Content-Length bytes); such a body is exactly originalSize bytes long in UTF-8.
  function isCutBody(body) {
    if (!body.truncated || typeof body.text !== 'string') return false
    try { return new TextEncoder().encode(body.text).length !== body.originalSize } catch (e) { return true }
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  var TOKEN_CLASS = ['', 'j-key', 'j-str', 'j-lit', 'j-num']

  /**
   * Token ranges over the whole text ([start, end) and a TOKEN_CLASS index).
   * Rows and search marks slice these ranges, so a value split by wrapping keeps its color.
   * Self-contained: also runs inside the formatting worker.
   */
  function tokenizeJson(text) {
    var re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g
    var starts = []
    var ends = []
    var kinds = []
    var m
    while ((m = re.exec(text)) !== null) {
      if (!m[0]) { re.lastIndex++; continue }
      starts.push(m.index)
      ends.push(m.index + (m[1] ? m[1].length : m[0].length))
      kinds.push(m[1] ? (m[2] ? 1 : 2) : m[3] ? 3 : 4)
    }
    return { starts: starts, ends: ends, kinds: kinds }
  }

  /** First index with arr[i] >= value (arr ascending). */
  function lowerBound(arr, value) {
    var lo = 0
    var hi = arr.length
    while (lo < hi) {
      var mid = (lo + hi) >> 1
      if (arr[mid] < value) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  /** HTML for text[a, b) with token colors and search marks. */
  function renderRange(text, a, b, tokens, marks, markLen, active) {
    var n = b - a
    if (n <= 0) return ''
    var cls = new Uint8Array(n)
    if (tokens) {
      for (var ti = lowerBound(tokens.ends, a + 1); ti < tokens.starts.length && tokens.starts[ti] < b; ti++) {
        var ts = Math.max(tokens.starts[ti], a) - a
        var te = Math.min(tokens.ends[ti], b) - a
        for (var k = ts; k < te; k++) cls[k] = tokens.kinds[ti]
      }
    }
    var hit = null
    if (marks && marks.length && markLen) {
      hit = new Uint8Array(n)
      for (var mi = lowerBound(marks, a - markLen + 1); mi < marks.length && marks[mi] < b; mi++) {
        var ms = Math.max(marks[mi], a) - a
        var me = Math.min(marks[mi] + markLen, b) - a
        for (var q = ms; q < me; q++) hit[q] = mi === active ? 2 : 1
      }
    }
    var html = ''
    var i = 0
    while (i < n) {
      var c = cls[i]
      var hv = hit ? hit[i] : 0
      var j = i + 1
      while (j < n && cls[j] === c && (hit ? hit[j] : 0) === hv) j++
      var piece = escapeHtml(text.slice(a + i, a + j))
      if (c) piece = '<span class="' + TOKEN_CLASS[c] + '">' + piece + '</span>'
      if (hv) piece = '<mark class="code-hit' + (hv === 2 ? ' code-hit-on' : '') + '">' + piece + '</mark>'
      html += piece
      i = j
    }
    return html
  }

  function copyButton(text) {
    var btn = h('button', { class: 'code-btn copy', type: 'button', text: 'Copy' })
    btn.addEventListener('click', function () {
      var done = function () { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = 'Copy' }, 1200) }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () {})
    })
    return btn
  }

  /**
   * Indent JSON without JSON.parse, so a truncated body still wraps.
   * Self-contained: also runs inside the formatting worker.
   */
  function formatLooseJson(text) {
    var out = []
    var indent = 0
    var inStr = false
    var esc = false
    var n = text.length
    function gap(k) {
      while (k < n) {
        var code = text.charCodeAt(k)
        if (code !== 32 && code !== 10 && code !== 13 && code !== 9) return text.charAt(k)
        k++
      }
      return ''
    }
    function nl() {
      var pad = indent > 32 ? 32 : indent
      var s = '\n'
      for (var p = 0; p < pad; p++) s += '  '
      return s
    }
    for (var i = 0; i < n; i++) {
      var c = text.charAt(i)
      if (inStr) {
        out.push(c)
        if (esc) esc = false
        else if (c === '\\') esc = true
        else if (c === '"') inStr = false
        continue
      }
      if (c === ' ' || c === '\n' || c === '\r' || c === '\t') continue
      if (c === '"') { inStr = true; out.push(c); continue }
      if (c === '{' || c === '[') {
        var close = c === '{' ? '}' : ']'
        if (gap(i + 1) === close) { out.push(c); out.push(close); while (i + 1 < n && text.charAt(i + 1) !== close) i++; i++; continue }
        out.push(c)
        indent++
        out.push(nl())
        continue
      }
      if (c === '}' || c === ']') {
        indent = indent > 0 ? indent - 1 : 0
        out.push(nl())
        out.push(c)
        continue
      }
      if (c === ',') { out.push(c); out.push(nl()); continue }
      if (c === ':') { out.push(': '); continue }
      out.push(c)
    }
    return out.join('')
  }

  /** Formats and tokenizes a large JSON text off the main thread. */
  function formatJsonAsync(text, done) {
    var src = formatLooseJson.toString() + '\n' + tokenizeJson.toString() + '\n'
      + 'self.onmessage=function(e){var t=formatLooseJson(String(e.data));var k=tokenizeJson(t);'
      + 'var s=new Int32Array(k.starts),en=new Int32Array(k.ends),kd=new Uint8Array(k.kinds);'
      + 'self.postMessage({text:t,starts:s,ends:en,kinds:kd},[s.buffer,en.buffer,kd.buffer])}'
    function inline() {
      setTimeout(function () {
        var t = formatLooseJson(text)
        var k = tokenizeJson(t)
        done({ text: t, starts: k.starts, ends: k.ends, kinds: k.kinds })
      }, 0)
    }
    var url
    var worker
    try {
      url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))
      worker = new Worker(url)
    } catch (err) {
      inline()
      return
    }
    worker.onmessage = function (ev) {
      worker.terminate()
      URL.revokeObjectURL(url)
      if (ev.data && typeof ev.data.text === 'string') done(ev.data)
      else inline()
    }
    worker.onerror = function () {
      worker.terminate()
      URL.revokeObjectURL(url)
      inline()
    }
    worker.postMessage(text)
  }

  /** Start offset of each fixed-height row. Long lines wrap to the pane width. */
  function rowStarts(text, cols) {
    var starts = [0]
    var i = 0
    var n = text.length
    var width = cols > 8 ? cols : 8
    while (i < n) {
      var limit = i + width
      if (limit > n) limit = n
      var breakAt = limit
      for (var j = i; j < limit; j++) {
        if (text.charCodeAt(j) === 10) { breakAt = j + 1; break }
      }
      i = breakAt
      if (i < n) starts.push(i)
    }
    return starts
  }

  function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

  var MATCH_CAP = 5000

  /**
   * Find field, previous / next arrows and the match count, driven by a search target:
   * one code block, or several blocks searched as one (WebSocket frames).
   */
  function findControls(target) {
    var find = h('input', { class: 'code-find', type: 'search', placeholder: 'Find', spellcheck: 'false', 'aria-label': 'Find' })
    var count = h('span', { class: 'code-count' })
    var prevBtn = h('button', { class: 'code-btn code-step', type: 'button', title: 'Previous match (Shift+Enter)', text: '\u2191' })
    var nextBtn = h('button', { class: 'code-btn code-step', type: 'button', title: 'Next match (Enter)', text: '\u2193' })
    var query = ''
    var total = 0
    var active = -1
    function setCount() {
      count.textContent = !query ? '' : total ? (active + 1) + ' / ' + total : 'No matches'
    }
    function run() {
      query = find.value
      total = target.setQuery(query)
      active = total ? 0 : -1
      setCount()
      target.setActive(active)
    }
    function step(dir) {
      if (query !== find.value) return run()
      if (!total) return
      active = (active + dir + total) % total
      setCount()
      target.setActive(active)
    }
    target.onUpdate = function () { if (query) run() }
    find.addEventListener('input', run)
    find.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault()
        step(ev.shiftKey ? -1 : 1)
      } else if (ev.key === 'Escape' && find.value) {
        ev.stopPropagation()
        find.value = ''
        run()
      }
    })
    prevBtn.addEventListener('click', function () { step(-1) })
    nextBtn.addEventListener('click', function () { step(1) })
    return [find, prevBtn, nextBtn, count]
  }

  /** Several code blocks searched as one: match i is counted across the blocks in order. */
  function groupFind(targets) {
    var counts = []
    var group = {
      onUpdate: null,
      setQuery: function (q) {
        var total = 0
        counts = targets.map(function (t) { var n = t.setQuery(q); total += n; return n })
        return total
      },
      setActive: function (index) {
        var base = 0
        targets.forEach(function (t, k) {
          var n = counts[k] || 0
          t.setActive(index >= base && index < base + n ? index - base : -1)
          base += n
        })
      },
    }
    targets.forEach(function (t) { t.onUpdate = function () { if (group.onUpdate) group.onUpdate() } })
    return group
  }

  /**
   * One code block for every size. Small text is a full <pre>, so the browser find works on it.
   * Text above LARGE_TEXT keeps only the visible rows in the page; Ctrl+F moves to its Find field.
   * `shared`: the Find bar is outside (one search for several blocks); the block keeps Copy.
   * The search target is exposed as box.findTarget.
   */
  function code(text, json, shared) {
    var large = text.length > LARGE_TEXT
    var shown = large && json ? '' : text
    var tokens = !large && json ? tokenizeJson(text) : null
    var ready = !(large && json)
    var query = ''
    var matches = []
    var active = -1

    var pre = null
    var view = null
    var spacer = null
    var win = null
    var rows = [0]
    var cols = 0
    var from = -1
    var to = -1

    function paintAll() {
      if (!pre) return
      if (!tokens && !matches.length) pre.textContent = shown
      else pre.innerHTML = renderRange(shown, 0, shown.length, tokens, matches, query.length, active)
    }

    function columnCount() {
      var probe = view.querySelector('.code-probe')
      if (!probe) {
        probe = h('span', { class: 'code-probe', text: '00000000000000000000' })
        view.appendChild(probe)
      }
      var charWidth = probe.getBoundingClientRect().width / 20 || 7.2
      var c = Math.floor((view.clientWidth - 28) / charWidth)
      return c > 16 ? c : 16
    }

    function paintRows(force) {
      if (!view || !ready || !view.clientHeight) return
      var nextCols = columnCount()
      if (nextCols !== cols) {
        cols = nextCols
        rows = rowStarts(shown, cols)
        spacer.style.height = (rows.length * VROW_H + 20) + 'px'
        force = true
      }
      var height = view.clientHeight
      var top = Math.max(0, view.scrollTop - 10)
      var nextFrom = Math.max(0, Math.floor(top / VROW_H) - VOVERSCAN)
      var nextTo = Math.min(rows.length, Math.ceil((top + height) / VROW_H) + VOVERSCAN)
      if (!force && nextFrom === from && nextTo === to) return
      from = nextFrom
      to = nextTo
      win.style.transform = 'translateY(' + (from * VROW_H + 10) + 'px)'
      var html = ''
      for (var r = from; r < to; r++) {
        var a = rows[r]
        var b = r + 1 < rows.length ? rows[r + 1] : shown.length
        if (b > a && shown.charCodeAt(b - 1) === 10) b--
        html += '<div class="code-row">' + (b > a ? renderRange(shown, a, b, tokens, matches, query.length, active) : ' ') + '</div>'
      }
      win.innerHTML = html
    }

    function repaint() {
      if (large) paintRows(true)
      else paintAll()
    }

    function collect() {
      matches = []
      if (!ready || !query) return
      var re = new RegExp(escapeRegExp(query), 'gi')
      var m
      while (matches.length < MATCH_CAP && (m = re.exec(shown)) !== null) {
        matches.push(m.index)
        if (!m[0]) re.lastIndex++
      }
    }

    function reveal() {
      repaint()
      if (active < 0) return
      if (large) {
        var row = Math.max(0, lowerBound(rows, matches[active] + 1) - 1)
        view.scrollTop = Math.max(0, row * VROW_H + 10 - Math.floor(view.clientHeight / 2))
        paintRows(true)
      } else {
        var hit = pre.querySelector('.code-hit-on')
        if (hit && hit.scrollIntoView) hit.scrollIntoView({ block: 'center', inline: 'nearest' })
      }
    }

    var target = {
      onUpdate: null,
      setQuery: function (q) {
        query = q
        active = -1
        collect()
        return matches.length
      },
      setActive: function (index) {
        active = index >= 0 && index < matches.length ? index : -1
        reveal()
      },
    }

    var tools = h('div', { class: 'code-tools' }, (shared ? [] : findControls(target)).concat([copyButton(text)]))
    var box = h('div', { class: 'code-box' + (large ? ' code-large' : '') }, [tools])
    box.findTarget = target

    if (!large) {
      pre = h('pre', { class: 'code-pre' })
      box.appendChild(pre)
      paintAll()
      return box
    }

    view = h('div', { class: 'code-view' })
    spacer = h('div', { class: 'code-spacer' })
    win = h('div', { class: 'code-win' })
    view.appendChild(spacer)
    view.appendChild(win)
    box.appendChild(view)
    view.addEventListener('scroll', function () { paintRows(false) }, { passive: true })
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(function () { paintRows(false) }).observe(view)
    }
    requestAnimationFrame(function () { paintRows(false) })
    if (json) {
      formatJsonAsync(text, function (result) {
        shown = result.text
        tokens = { starts: result.starts, ends: result.ends, kinds: result.kinds }
        ready = true
        cols = 0
        active = -1
        collect()
        repaint()
        if (target.onUpdate) target.onUpdate()
      })
    }
    return box
  }

  function jsonBlock(value) {
    if (value === undefined) return h('div', { class: 'muted', text: 'No data' })
    return code(pretty(value), true)
  }

  function kv(rows, keys) {
    var dl = h('dl', { class: keys ? 'kv keys' : 'kv' })
    rows.forEach(function (r) {
      add(dl, [h('dt', { text: r[0] }), h('dd', { text: r[1] == null ? '' : String(r[1]) })])
    })
    return dl
  }

  function statusClass(entry) {
    if (entry.error) return 's-fail'
    var s = Number(entry.status) || 0
    if (s >= 200 && s < 300) return 's-ok'
    if (s >= 300 && s < 400) return 's-redirect'
    if (s >= 400 && s < 500) return 's-client'
    return 's-fail'
  }

  function sectionHref(section, index, filter) {
    return '#' + section + (filter ? ':' + filter : '') + (index >= 0 ? '/' + index : '')
  }

  /** Link within the current section and filter */
  function hereHref(index) { return sectionHref(state.section, index, state.filter) }

  // ---------------------------------------------------------------- filtering

  function textOf(e) {
    var t = searchText.get(e)
    if (t === undefined) {
      var en = entryOf(e)
      t = (e.title + '\n' + e.subtitle + '\n' + e.key + '\n' + e.label + (en ? '\n' + en.url : '')).toLowerCase()
      searchText.set(e, t)
    }
    return t
  }

  var dataText = new WeakMap()
  function dataOf(e) {
    var t = dataText.get(e)
    if (t === undefined) {
      var en = entryOf(e)
      try { t = JSON.stringify(en ? RT.entryPart(en, e.kind) : e.data).toLowerCase() } catch (err) { t = '' }
      dataText.set(e, t)
    }
    return t
  }

  function filterEvents() {
    var q = state.query.trim().toLowerCase()
    var section = state.section
    var filter = FILTERS[state.filter]
    return ordered.filter(function (e) {
      if (section !== 'all' && section !== 'overview' && sectionId(e) !== section) return false
      if ((section === 'all' || section === 'overview') && typeOptions.length && !enabledTypes[e.kind]) return false
      if (filter && !filter.test(e)) return false
      if (!q) return true
      return textOf(e).indexOf(q) !== -1 || (state.inData && dataOf(e).indexOf(q) !== -1)
    })
  }

  // ---------------------------------------------------------------- sidebar

  function counts() {
    var c = {}
    events.forEach(function (e) {
      var id = sectionId(e)
      c[id] = (c[id] || 0) + 1
    })
    return c
  }

  function renderSidebar() {
    var c = counts()
    var nav = $('sidebar')
    nav.textContent = ''
    var link = function (section, text, count, kind) {
      return h('a', { class: 'link' + (state.section === section ? ' active' : ''), href: sectionHref(section, -1) }, [
        kind ? h('span', { class: 'dot ' + kindClass(kind) }) : null,
        h('span', { text: text }),
        count != null ? h('span', { class: 'count', text: count }) : null,
      ])
    }
    add(nav, h('div', { class: 'group' }, [
      h('p', { class: 'group-title', text: 'Report' }),
      link('overview', 'Overview'),
      link('all', 'All events', events.length),
    ]))
    var listed = []
    GROUPS.forEach(function (g) {
      var present = g.kinds.filter(function (k) { return c[k] })
      if (!present.length) return
      listed = listed.concat(present)
      add(nav, h('div', { class: 'group' }, [h('p', { class: 'group-title', text: g.title })].concat(
        present.map(function (k) { return link(k, sectionLabel(k), c[k], sectionColor(k)) }),
      )))
    })
    var other = Object.keys(c).filter(function (k) { return listed.indexOf(k) === -1 })
    if (other.length) {
      add(nav, h('div', { class: 'group' }, [h('p', { class: 'group-title', text: 'Other' })].concat(
        other.map(function (k) { return link(k, label(k), c[k], k) }),
      )))
    }
    add(nav, h('div', { class: 'side-foot' }, [
      supportBlock(),
      h('a', { class: 'promo', href: APP_URL, target: '_blank', rel: 'noopener noreferrer' }, [
        h('span', { class: 'promo-title' }, [h('img', { class: 'brand-mark', src: ($('brand-icon') || {}).src, alt: '' }), 'Download Vue Inspector']),
        h('span', { class: 'promo-url', text: APP_URL.replace(/^https?:\/\//, '').replace(/\/$/, '') }),
      ]),
    ]))
  }

  function svgEl(name) { return doc.createElementNS('http://www.w3.org/2000/svg', name) }

  function externalIcon() {
    var svg = svgEl('svg')
    svg.setAttribute('class', 'ext-icon')
    svg.setAttribute('viewBox', '0 0 12 12')
    svg.setAttribute('aria-hidden', 'true')
    var path = svgEl('path')
    path.setAttribute('d', 'M4 2H2.5v7.5H10V8M6.5 2H10v3.5M10 2L5.5 6.5')
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', 'currentColor')
    path.setAttribute('stroke-width', '1.2')
    path.setAttribute('stroke-linecap', 'round')
    path.setAttribute('stroke-linejoin', 'round')
    svg.appendChild(path)
    return svg
  }

  function chevronLeft() {
    var svg = svgEl('svg')
    svg.setAttribute('class', 'back-icon')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('width', '16')
    svg.setAttribute('height', '16')
    svg.setAttribute('aria-hidden', 'true')
    var shaft = svgEl('path')
    var head = svgEl('path')
    shaft.setAttribute('d', 'M19 12H5')
    head.setAttribute('d', 'M12 19l-7-7 7-7')
    ;[shaft, head].forEach(function (path) {
      path.setAttribute('fill', 'none')
      path.setAttribute('stroke', 'currentColor')
      path.setAttribute('stroke-width', '2')
      path.setAttribute('stroke-linecap', 'round')
      path.setAttribute('stroke-linejoin', 'round')
      svg.appendChild(path)
    })
    return svg
  }

  function supportBlock() {
    var monthly = h('a', {
      class: 'support-card',
      href: BOOSTY_URL,
      target: '_blank',
      rel: 'noopener noreferrer',
    }, [
      h('span', { class: 'support-card-title' }, ['Monthly support', externalIcon()]),
      h('span', { class: 'support-card-desc', text: 'Boosty support levels.' }),
    ])
    var usdt = h('button', { class: 'support-card', type: 'button', onclick: openDonate }, [
      h('span', { class: 'support-card-title', text: 'Donate with USDT' }),
      h('span', { class: 'support-card-desc', text: 'One-time, direct to the author.' }),
    ])
    return h('div', { class: 'support' }, [
      h('p', { class: 'support-title', text: 'Support Vue Inspector' }),
      h('p', { class: 'support-desc', text: 'Fund features and experiments.' }),
      monthly,
      usdt,
    ])
  }

  var donateLayer = null
  var donateCopyBtn = null
  var donateTimer = 0

  function usdtQr() {
    var quiet = 4
    var n = USDT_QR_SIZE
    var full = n + quiet * 2
    var svg = svgEl('svg')
    svg.setAttribute('class', 'donate-qr')
    svg.setAttribute('viewBox', '0 0 ' + full + ' ' + full)
    svg.setAttribute('role', 'img')
    svg.setAttribute('aria-label', 'USDT TRC-20 QR code')
    var bg = svgEl('rect')
    bg.setAttribute('width', String(full))
    bg.setAttribute('height', String(full))
    bg.setAttribute('fill', '#fff')
    svg.appendChild(bg)
    var y, x, cell
    for (y = 0; y < n; y++) {
      for (x = 0; x < n; x++) {
        if (USDT_QR.charAt(y * n + x) !== '1') continue
        cell = svgEl('rect')
        cell.setAttribute('x', String(x + quiet))
        cell.setAttribute('y', String(y + quiet))
        cell.setAttribute('width', '1')
        cell.setAttribute('height', '1')
        svg.appendChild(cell)
      }
    }
    return svg
  }

  function markDonateCopied() {
    if (!donateCopyBtn) return
    donateCopyBtn.textContent = 'Copied'
    clearTimeout(donateTimer)
    donateTimer = setTimeout(function () {
      if (donateCopyBtn) donateCopyBtn.textContent = 'Copy address'
    }, 2000)
  }

  function copyUsdtAddress() {
    var finish = function () { markDonateCopied() }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(USDT_ADDRESS).then(finish, function () {
        selectUsdtAddress()
        finish()
      })
      return
    }
    selectUsdtAddress()
    finish()
  }

  function selectUsdtAddress() {
    var el = doc.querySelector('.donate-addr')
    if (!el) return
    var range = doc.createRange()
    range.selectNodeContents(el)
    var sel = window.getSelection()
    if (!sel) return
    sel.removeAllRanges()
    sel.addRange(range)
    try { doc.execCommand('copy') } catch (err) { /* selection stays for a manual copy */ }
  }

  function closeDonate() {
    if (donateLayer) donateLayer.hidden = true
  }

  function openDonate() {
    if (!donateLayer) {
      donateCopyBtn = h('button', { type: 'button', text: 'Copy address', onclick: copyUsdtAddress })
      var card = h('div', { class: 'donate-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Donate with USDT' }, [
        h('h2', { class: 'donate-title', text: 'Donate with USDT' }),
        h('p', { class: 'donate-desc', text: 'A one-time transfer directly to the author. USDT on Tron (TRC-20).' }),
        usdtQr(),
        h('p', { class: 'donate-addr', text: USDT_ADDRESS }),
        h('div', { class: 'donate-actions' }, [
          donateCopyBtn,
          h('button', { type: 'button', text: 'Close', onclick: closeDonate }),
        ]),
      ])
      card.addEventListener('click', function (ev) { ev.stopPropagation() })
      donateLayer = h('div', { class: 'donate', hidden: true, onclick: closeDonate }, [card])
      doc.body.appendChild(donateLayer)
    }
    donateLayer.hidden = false
  }

  // ---------------------------------------------------------------- main

  function renderOverview(main) {
    var c = counts()
    var first = events.length ? Math.min.apply(null, events.map(function (e) { return e.ts })) : 0
    var last = events.length ? Math.max.apply(null, events.map(function (e) { return e.ts })) : 0
    var errors = events.filter(FILTERS.errors.test).length
    var failed = events.filter(FILTERS.failed.test).length
    var card = function (lbl, value, small, href) {
      var children = [h('div', { class: 'card-label', text: lbl }), h('div', { class: 'card-value' + (small ? ' small' : ''), text: value })]
      if (href) children.push(h('div', { class: 'card-hint', text: 'Show events \u2192' }))
      return h(href ? 'a' : 'div', { class: href ? 'card card-link' : 'card', href: href }, children)
    }
    add(main, [
      h('h1', { class: 'page-title', text: 'Overview' }),
      h('p', { class: 'page-desc', text: 'Summary of the exported events. Pick a section in the sidebar to browse them.' }),
      h('div', { class: 'cards' }, [
        card('Events', events.length, false, sectionHref('all', -1)),
        card('Errors', errors, false, sectionHref('all', -1, 'errors')),
        card(FILTERS.failed.label, failed, false, sectionHref('all', -1, 'failed')),
        card('First event', events.length ? fmtDateTime(first) : '-', true),
        card('Last event', events.length ? fmtDateTime(last) : '-', true),
        card('Time span', events.length ? fmtDuration(last - first) : '-', true),
      ]),
      h('h2', { class: 'h2', text: 'Event types' }),
      h('div', { class: 'kind-grid' }, Object.keys(c).map(function (k) {
        return h('a', { class: 'kind-card ' + kindClass(k), href: sectionHref(k, -1) }, [
          h('span', { class: 'badge', text: label(k) }),
          h('span', { class: 'count', text: c[k] }),
        ])
      })),
      h('h2', { class: 'h2', text: 'Report' }),
      kv([
        ['Exported', info.exportedAt ? fmtDateTime(Date.parse(info.exportedAt)) : '-'],
        ['Generator', info.generator || info.name || 'Vue Inspector Logs'],
        ['Format version', payload.version || 1],
        ['Events in file', events.length],
      ]),
    ])
  }

  function row(e) {
    return h('a', {
      class: 'row ' + kindClass(e.kind) + ' lvl-' + e.level + (e.index === state.selected ? ' active' : ''),
      href: hereHref(e.index),
      'data-index': e.index,
    }, [
      h('span', { class: 'time', text: fmtTime(e.ts) }),
      h('span', { class: 'badge ' + kindClass(e.kind), text: e.label }),
      h('span', { class: 'ev' }, [
        h('div', { class: 'ev-title', text: e.title, title: e.title }),
        e.subtitle ? h('div', { class: 'ev-sub', text: e.subtitle, title: e.subtitle }) : null,
      ]),
    ])
  }

  function renderRows(list, from) {
    var slice = visible.slice(from, state.limit)
    slice.forEach(function (e) { list.appendChild(row(e)) })
  }

  function setTypeOpen(open) {
    state.typeOpen = open
    var root = doc.querySelector('.type-filter')
    if (!root) return
    var menu = root.querySelector('.type-menu')
    var btn = root.querySelector('.type-btn')
    if (menu) menu.hidden = !open
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false')
  }

  function applyTypes(on) {
    typeOptions.forEach(function (k) { enabledTypes[k] = on })
    state.typeOpen = true
    render()
  }

  function typeFilter() {
    if (!typeOptions.length) return null
    var badges = []
    if (allTypesOn()) {
      badges.push(h('span', { class: 'type-sep' }))
      badges.push(h('span', { class: 'type-count', text: 'All' }))
    } else {
      var picked = []
      typeOptions.forEach(function (k) { if (enabledTypes[k]) picked.push(label(k)) })
      if (picked.length) {
        badges.push(h('span', { class: 'type-sep' }))
        badges.push(h('span', { class: 'type-count', text: picked[0] }))
        if (picked.length > 1) badges.push(h('span', { class: 'type-count', text: '+' + (picked.length - 1) }))
      }
    }
    var btn = h('button', {
      class: 'type-btn',
      type: 'button',
      'aria-haspopup': 'listbox',
      'aria-expanded': state.typeOpen ? 'true' : 'false',
    }, [h('span', { text: 'Type' })].concat(badges))
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation()
      setTypeOpen(!state.typeOpen)
    })
    var options = typeOptions.map(function (k) {
      var input = h('input', { type: 'checkbox' })
      input.checked = !!enabledTypes[k]
      input.addEventListener('change', function () {
        enabledTypes[k] = input.checked
        state.typeOpen = true
        render()
      })
      return h('label', { class: 'type-option' }, [
        input,
        h('span', { class: 'dot ' + kindClass(k) }),
        h('span', { text: label(k) }),
      ])
    })
    var allBtn = h('button', { type: 'button', text: 'Select all' })
    var clearBtn = h('button', { type: 'button', text: 'Clear' })
    allBtn.disabled = allTypesOn()
    clearBtn.disabled = !anyTypeOn()
    allBtn.addEventListener('click', function (ev) { ev.stopPropagation(); applyTypes(true) })
    clearBtn.addEventListener('click', function (ev) { ev.stopPropagation(); applyTypes(false) })
    var menu = h('div', { class: 'type-menu', role: 'group', 'aria-label': 'Event types' }, [
      h('div', { class: 'type-options' }, options),
      h('div', { class: 'type-actions' }, [allBtn, clearBtn]),
    ])
    if (!state.typeOpen) menu.hidden = true
    return h('div', { class: 'type-filter' }, [btn, menu])
  }

  function renderMain() {
    var main = $('main')
    main.textContent = ''
    main.scrollTop = 0
    if (state.section === 'overview' && !state.query.trim()) {
      visible = []
      renderOverview(main)
      return
    }
    visible = filterEvents()
    var title = state.section === 'all' || state.section === 'overview' ? 'All events' : sectionLabel(state.section)
    var total = state.section === 'all' || state.section === 'overview'
      ? events.length
      : events.filter(function (e) { return sectionId(e) === state.section }).length
    var filter = FILTERS[state.filter]
    var typeNarrowed = state.section === 'all' && typeOptions.length && !allTypesOn()
    var reasons = []
    if (filter) reasons.push('the filter')
    if (typeNarrowed) reasons.push('the type filter')
    if (state.query.trim()) reasons.push('the search')
    var desc = reasons.length
      ? visible.length + ' of ' + total + ' events match ' + reasons.join(' and ')
      : total + ' events'
    add(main, [
      h('div', { class: 'page-head' }, [
        h('h1', { class: 'page-title', text: title }),
        state.section === 'all' ? typeFilter() : null,
        filter ? h('a', { class: 'chip', href: sectionHref(state.section, -1), title: 'Remove filter' }, [
          h('span', { text: 'Filter: ' + filter.label }),
          h('span', { class: 'chip-x', text: '\u00d7' }),
        ]) : null,
      ]),
      h('p', { class: 'page-desc', text: desc }),
    ])
    if (!visible.length) {
      var emptyText = 'No events'
      if (state.section === 'all' && typeOptions.length && !anyTypeOn()) emptyText = 'No event types selected \u2014 enable them in the Type filter'
      else if (reasons.length) emptyText = 'No events match the filters'
      add(main, h('div', { class: 'list' }, h('div', { class: 'empty', text: emptyText })))
      return
    }
    var list = h('div', { class: 'list', id: 'list' }, h('div', { class: 'list-head' }, [h('span', { text: 'Time' }), h('span', { text: 'Type' }), h('span', { text: 'Event' })]))
    renderRows(list, 0)
    add(main, list)
    if (visible.length > state.limit) {
      var more = h('button', { class: 'more', type: 'button', text: 'Show more (' + (visible.length - state.limit) + ' left)' })
      more.addEventListener('click', function () {
        var from = state.limit
        state.limit += PAGE_SIZE
        renderRows(list, from)
        if (visible.length > state.limit) more.textContent = 'Show more (' + (visible.length - state.limit) + ' left)'
        else more.remove()
      })
      add(main, more)
    }
  }

  // ---------------------------------------------------------------- details

  function isStoreBase(e, d) { return e.kind === 'store' && d.op && d.op !== 'change' }

  function sectionsFor(e, d) {
    var en = d.entry || {}
    var list = []
    if (isNetwork(e) && !d.entry) {
      list.push(['overview', 'Overview'])
    } else if (isStoreBase(e, d)) {
      list.push(['overview', 'Overview'])
      list.push(['state', 'State'])
    } else if (en.method === 'WS' || en.initiator === 'websocket') {
      list.push(['overview', 'Overview'])
      var responseHeaders = e.kind === 'response' || e.kind === 'ws-received' || e.kind === 'ws-closed'
      list.push([responseHeaders ? 'responseHeaders' : 'requestHeaders', 'Headers'])
      var ownFrame = e.kind === 'ws-sent' || e.kind === 'ws-received'
      var count = en.websocket && en.websocket.frames ? en.websocket.frames.length : 0
      list.push(['messages', ownFrame ? 'Message' : (count ? 'Messages (' + count + ')' : 'Messages')])
    } else if (e.kind === 'request') {
      list.push(['overview', 'Overview'])
      if (en.params && en.params.length) list.push(['params', 'Params (' + en.params.length + ')'])
      list.push(['requestHeaders', 'Headers'])
      if (en.requestBody) list.push(['requestBody', 'Body'])
    } else if (e.kind === 'response') {
      list.push(['overview', 'Overview'])
      list.push(['responseHeaders', 'Headers'])
      list.push(['responseBody', 'Body'])
    } else if (e.kind === 'store' || e.kind === 'props') {
      var n = Array.isArray(d.changes) ? d.changes.length : 0
      list.push(['changes', 'Changes (' + n + (d.changesTruncated ? '+' : '') + ')'])
      list.push(['before', 'Before'])
      list.push(['after', 'After'])
    } else if (e.kind === 'action') {
      list.push(['overview', 'Overview'])
      list.push(['args', 'Arguments'])
      list.push(['result', d.status === 'error' ? 'Error' : 'Result'])
    } else if (e.kind === 'emit') {
      list.push(['args', 'Arguments (' + (Array.isArray(d.args) ? d.args.length : 0) + ')'])
      list.push(['overview', 'Overview'])
    } else {
      list.push(['overview', 'Overview'])
      if (e.kind === 'error' && d.stack) list.push(['stack', 'Stack'])
    }
    list.push(['raw', 'Raw'])
    return list
  }

  function stackTruncatedLabel(info) {
    if (info.head && info.tail) {
      return 'Truncated: first ' + info.head + ' and last ' + info.tail + ' of ' + info.frames + ' frames kept'
    }
    return 'Truncated: top ' + info.kept + ' of ' + info.frames + ' frames kept'
  }

  function overviewRows(e, d) {
    var rows = [['Time', fmtDateTime(e.ts)]]
    var en = d.entry
    if (isNetwork(e) && !en) {
      rows.push(['Request', e.key], ['Network entry', 'not included in this report'])
      return rows
    }
    if (e.kind === 'store') {
      rows.push(['Store', d.storeId])
      if (d.op === 'init') rows.push(['Recorded', 'Store created while logging (initial state)'])
      else if (d.op === 'snapshot') rows.push(['Recorded', 'Logging started on an existing store (current state)'])
      else if (d.op === 'checkpoint') rows.push(['Recorded', 'State after ' + d.compacted + ' older changes compacted by the limits'])
      return rows
    }
    if (en) {
      rows.push(['URL', en.url], ['Method', en.method])
      if (en.method === 'WS' || en.initiator === 'websocket') {
        var socket = en.websocket || {}
        if (e.kind === 'ws-sent' || e.kind === 'ws-received') rows.push(['Direction', e.kind === 'ws-sent' ? 'Sent' : 'Received'])
        if (e.kind === 'ws-closed' || e.kind === 'response' || ((e.kind !== 'ws-sent' && e.kind !== 'ws-received') && socket.state === 'closed')) {
          var status = socket.closeCode ? ('Closed ' + socket.closeCode) : (en.statusText || 'Closed')
          rows.push(['Status', status])
          if (socket.closeReason) rows.push(['Reason', socket.closeReason])
          if (socket.reconnect === false) rows.push(['Reconnect', 'No automatic reconnect'])
        } else {
          rows.push(['Status', 'Open'])
        }
        rows.push(['Messages', String((socket.frames && socket.frames.length) || 0)])
        rows.push(['Duration', fmtDuration(en.duration)], ['Size', fmtBytes(en.size)])
        return rows
      }
      if (e.kind === 'response') {
        rows.push(['Status', en.error ? 'Failed: ' + en.error : (en.status + ' ' + (en.statusText || '')).trim()])
        rows.push(['Duration', fmtDuration(en.duration)], ['Size', fmtBytes(en.size)])
      } else {
        rows.push(['Initiator', en.initiator])
        if (en.authorization && en.authorization.type !== 'None') rows.push(['Authorization', en.authorization.type])
      }
      return rows
    }
    if (e.kind === 'action') rows.push(['Store', d.storeId], ['Action', d.action], ['Status', d.status], ['Duration', fmtDurationMs(d.duration)])
    else if (e.kind === 'emit') {
      rows.push(['Component', d.component], ['Event', d.event], ['Listener', d.once ? 'once' : 'regular'])
      if (d.uid !== undefined) rows.push(['uid', d.uid])
      if (d.parents) rows.push(['Parents', d.parents])
    } else if (e.kind === 'navigation') rows.push(['Type', d.navType], ['From', d.from || '-'], ['To', d.to])
    else if (e.kind === 'error') {
      rows.push(['Source', d.source])
      if (d.name) rows.push(['Name', d.name])
      rows.push(['Message', d.message])
      if (d.filename) rows.push(['Location', d.filename + ':' + (d.lineno || 0) + ':' + (d.colno || 0)])
      if (d.stackTruncated) rows.push(['Stack', stackTruncatedLabel(d.stackTruncated)])
      if (d.suppressedBefore) rows.push(['Suppressed', d.suppressedBefore + ' earlier console errors (more than 50 per second)'])
    } else {
      Object.keys(d).forEach(function (k) {
        var v = d[k]
        if (v === null || typeof v !== 'object') rows.push([k, v])
      })
    }
    return rows
  }

  function contextLine(e, d) {
    if (e.kind === 'store' && !isStoreBase(e, d)) {
      var parts = ['Mutation: ' + (d.mutationType || 'direct')]
      if (Array.isArray(d.actions) && d.actions.length) parts.push('Action: ' + d.actions.join(', '))
      return parts.join(' / ')
    }
    if (e.kind === 'props' || e.kind === 'emit') return 'uid ' + d.uid + (d.parents ? ' / Parents: ' + d.parents : '')
    return ''
  }

  function omittedNotice(e, part) {
    if (part.reason === 'unavailable') return h('div', { class: 'muted', text: 'The state was not saved (it could not be restored when older changes were compacted).' })
    var lim = e.data.__sizeLimited && e.data.__sizeLimited.limit
    return h('div', { class: 'muted', text: 'This part (' + fmtBytes(part.size) + ') was not saved: it exceeded the per-event limit' + (lim ? ' of ' + fmtBytes(lim) : '') + ' when the logs were captured.' })
  }

  function mediaSummary(body) {
    return h('div', { class: 'media-card' }, [
      h('p', { class: 'notice', text: 'Binary response received. Body not included in report.' }),
      h('div', { class: 'media-bar' }, [
        h('span', { class: 'media-type', text: body.contentType || 'application/octet-stream' }),
        h('span', { class: 'media-size', text: '(' + fmtBytes(body.originalSize) + ')' }),
        h('span', { class: 'badge', text: 'Binary' }),
      ]),
    ])
  }

  function bodyView(body) {
    if (!body) return h('div', { class: 'muted', text: 'No body' })
    if (body.isBinary || body.media) return mediaSummary(body)
    var nodes = []
    if (isCutBody(body)) nodes.push(h('p', { class: 'notice', text: 'Body truncated (' + fmtBytes(body.originalSize) + ' originally).' }))
    if (body.formData && body.formData.length) {
      nodes.push(jsonBlock(body.formData))
      return nodes
    }
    var text = String(body.text || '')
    var json = false
    var trimmed = text.trim()
    var looksJson = /json/i.test(body.contentType || '') || trimmed[0] === '{' || trimmed[0] === '['
    if (looksJson && text.length <= LARGE_TEXT) {
      try { text = JSON.stringify(JSON.parse(trimmed), null, 2) } catch (err) { text = formatLooseJson(trimmed) }
      json = true
    } else if (looksJson) {
      json = true
    }
    nodes.push(text ? code(text, json) : h('div', { class: 'muted', text: 'Empty body' }))
    return nodes
  }

  function changeValue(c, field) {
    return hasOwn(c, field) ? preview(c[field]) : 'not available'
  }

  function changesView(d) {
    var changes = Array.isArray(d.changes) ? d.changes : []
    if (!changes.length) return h('div', { class: 'muted', text: 'No changes' })
    var nodes = changes.map(function (c) {
      var cls = c.type === 'added' ? 'c-added' : c.type === 'removed' ? 'c-removed' : 'c-changed'
      return h('div', { class: 'change' }, [
        h('div', { class: 'change-path' }, [h('span', { class: 'badge tiny ' + cls, text: c.type }), h('span', { text: c.path })]),
        c.type !== 'added' ? h('div', { class: 'minus', text: '- ' + changeValue(c, 'before') }) : null,
        c.type !== 'removed' ? h('div', { class: 'plus', text: '+ ' + changeValue(c, 'after') }) : null,
      ])
    })
    if (d.changesTruncated) nodes.push(h('div', { class: 'muted', text: 'Too many changes - list is truncated. See Before / After for full state.' }))
    return nodes
  }

  var STATE_MISSING = 'cannot be restored: earlier events of this store are not in the report or are incomplete. The changed values are shown in Changes.'

  function prettyJsonValue(text) {
    var jsonLike = (text.charAt(0) === '{' && text.charAt(text.length - 1) === '}')
      || (text.charAt(0) === '[' && text.charAt(text.length - 1) === ']')
    if (!jsonLike) return null
    try { return JSON.stringify(JSON.parse(text), null, 2) } catch (err) { return null }
  }

  function frameBody(frame) {
    var text = String(frame.data || '')
    if (frame.kind === 'binary' || text.length > 65536) return { text: text, json: false }
    var trimmed = text.trim()
    if (!trimmed) return { text: text, json: false }
    var one = prettyJsonValue(trimmed)
    if (one != null) return { text: one, json: true }
    var lines = trimmed.split(/\r?\n/).map(function (line) { return line.trim() }).filter(Boolean)
    if (lines.length < 2) return { text: text, json: false }
    var parts = []
    for (var i = 0; i < lines.length; i++) {
      var formatted = prettyJsonValue(lines[i])
      if (formatted == null) return { text: text, json: false }
      parts.push(formatted)
    }
    return { text: parts.join('\n\n'), json: true }
  }

  function messagesView(en, e) {
    var frames = (en.websocket && en.websocket.frames) || []
    if (e && e.data && e.data.frameId != null) {
      frames = frames.filter(function (frame) { return frame.id === e.data.frameId })
      if (!frames.length) return h('div', { class: 'muted', text: 'This message is no longer in the connection log.' })
    }
    if (!frames.length) return h('div', { class: 'muted', text: 'No messages' })
    var shared = frames.length > 1
    var targets = []
    var nodes = frames.map(function (frame) {
      var body = frameBody(frame)
      var block = null
      if (body.text) {
        block = code(body.text, body.json, shared)
        targets.push(block.findTarget)
      }
      return h('div', { class: 'ws-frame' }, [
        h('div', { class: 'media-bar' }, [
          h('span', { class: 'media-type', text: frame.direction === 'sent' ? 'Sent' : 'Received' }),
          h('span', { class: 'media-size', text: '(' + fmtBytes(frame.size) + ')' }),
        ]),
        block || h('div', { class: 'muted', text: 'Empty message' }),
      ])
    })
    if (!shared || !targets.length) return nodes
    var bar = h('div', { class: 'code-box code-shared' }, [
      h('div', { class: 'code-tools' }, findControls(groupFind(targets))),
    ])
    return [bar].concat(nodes)
  }

  function tabContent(e, tab, v) {
    var d = v.event.data
    var missing = v.missing || {}
    var en = d.entry || {}
    if (tab === 'before' && missing.before) return h('div', { class: 'muted', text: 'The state before this change ' + STATE_MISSING })
    if (tab === 'after' && missing.after) return h('div', { class: 'muted', text: 'The state after this change ' + STATE_MISSING })
    var part = tab === 'before' ? d.before : tab === 'after' ? d.after : tab === 'state' ? d.state : tab === 'args' ? d.args
      : tab === 'result' ? (d.status === 'error' ? d.error : d.result) : tab === 'changes' ? d.changes : undefined
    if (isOmitted(part)) return omittedNotice(e, part)
    switch (tab) {
      case 'state': return jsonBlock(d.state)
      case 'overview': return kv(overviewRows(e, d))
      case 'params': return kv((en.params || []).map(function (p) { return [p.key, p.value] }), true)
      case 'requestHeaders':
      case 'responseHeaders': {
        var hs = (tab === 'requestHeaders' ? en.requestHeaders : en.responseHeaders) || []
        return hs.length ? kv(hs.map(function (x) { return [x.name, x.value] }), true) : h('div', { class: 'muted', text: 'No headers' })
      }
      case 'requestBody': return bodyView(en.requestBody)
      case 'responseBody': return bodyView(en.responseBody)
      case 'messages': return messagesView(en, e)
      case 'changes': return changesView(d)
      case 'before': return jsonBlock(d.before)
      case 'after': return jsonBlock(d.after)
      case 'args': return jsonBlock(d.args || [])
      case 'result': return jsonBlock(d.status === 'error' ? d.error : d.result === undefined ? null : d.result)
      case 'stack': return code(String(d.stack || ''), false)
      default: return jsonBlock(v.event)
    }
  }

  function renderDetails() {
    var box = $('details')
    box.textContent = ''
    var e = events[state.selected]
    doc.body.classList.toggle('has-selection', !!e)
    if (!e) {
      add(box, h('div', { class: 'placeholder', text: 'Select an event to see details' }))
      return
    }
    var v
    try {
      v = viewOf(e)
    } catch (err) {
      v = { event: Object.assign({}, e.raw, { title: e.title, subtitle: e.subtitle, label: e.label }), missing: {} }
    }
    var d = v.event.data || {}
    var sections = sectionsFor(e, d)
    var ids = sections.map(function (s) { return s[0] })
    if (ids.indexOf(state.tab) === -1) state.tab = ids[0]

    var pair = pairedEvent(e)
    var pairLink = null
    if (pair) {
      // Stay in the current list when the pair is listed there, otherwise open its own section
      var listed = state.section === 'all' && !!enabledTypes[pair.kind] && (!FILTERS[state.filter] || FILTERS[state.filter].test(pair))
      pairLink = h('a', {
        class: 'pair-btn',
        href: listed ? hereHref(pair.index) : sectionHref(pair.kind, pair.index),
        title: pair.kind === 'ws-closed' ? 'Open the close event of this connection'
          : pair.kind === 'ws' ? 'Open the connection event'
          : pair.kind === 'response' ? 'Open the response of this request' : 'Open the request of this response',
        text: pair.kind === 'ws-closed' ? 'Closed'
          : pair.kind === 'ws' ? 'Opened'
          : pair.kind === 'response' ? 'Response' : 'Request',
      })
    }
    var allHref = sectionHref('all', e.index)
    var allLink = h('a', {
      class: 'pair-btn',
      href: allHref,
      title: 'Show this event in All events',
      text: 'Locate',
      onclick: function (ev) {
        if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return
        listFocus = window.matchMedia('(max-width: 1200px)').matches
        enabledTypes[e.kind] = true
        var q = state.query.trim().toLowerCase()
        if (q && textOf(e).indexOf(q) === -1 && !(state.inData && dataOf(e).indexOf(q) !== -1)) {
          state.query = ''
          var input = $('search')
          if (input) input.value = ''
        }
        if (location.hash === allHref) {
          ev.preventDefault()
          parseHash()
          render()
        }
      },
    })

    var head = h('div', { class: 'd-head' }, [
      h('a', { class: 'icon-btn d-back', href: hereHref(-1), title: 'Close (Esc)', 'aria-label': 'Close' }, [chevronLeft()]),
      h('div', { class: 'd-head-main' }, [
        h('div', { class: 'd-title-row' }, [
          h('span', { class: 'badge ' + kindClass(e.kind), text: e.label }),
          e.kind === 'response' && d.entry
            ? h('span', { class: 'badge mono ' + statusClass(d.entry), text: d.entry.error ? 'Failed' : d.entry.status })
            : null,
          h('span', { class: 'd-title', text: e.title, title: e.title }),
        ]),
        h('div', { class: 'd-sub', text: contextLine(e, d) || e.subtitle || fmtDateTime(e.ts) }),
      ]),
      h('div', { class: 'd-actions' }, [allLink, pairLink]),
    ])
    var tabs = h('div', { class: 'tabs' }, sections.map(function (s) {
      var b = h('button', { class: 'tab' + (s[0] === state.tab ? ' active' : ''), type: 'button', text: s[1] })
      b.addEventListener('click', function () { state.tab = s[0]; renderDetails() })
      return b
    }))
    var body = h('div', { class: 'd-body' })
    try {
      add(body, tabContent(e, state.tab, v))
    } catch (err) {
      add(body, h('div', { class: 'muted', text: 'This part cannot be displayed: ' + err.message }))
    }

    add(box, [head, tabs, body])
  }

  function markSelected() {
    var list = $('list')
    if (!list) return
    var prev = list.querySelector('.row.active')
    if (prev) prev.classList.remove('active')
    var cur = list.querySelector('.row[data-index="' + state.selected + '"]')
    if (cur) cur.classList.add('active')
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' })
  }

  // ---------------------------------------------------------------- routing

  function parseHash() {
    var parts = decodeURIComponent(location.hash.slice(1)).split('/')
    var head = (parts[0] || 'overview').split(':')
    var section = head[0]
    var valid = section === 'overview' || section === 'all' || events.some(function (e) { return sectionId(e) === section })
    state.section = valid ? section : 'overview'
    state.filter = valid && FILTERS[head[1]] ? head[1] : ''
    if (state.filter && state.section === 'overview') state.section = 'all'
    var idx = parts.length > 1 ? Number(parts[1]) : -1
    state.selected = isFinite(idx) && events[idx] ? idx : -1
    if (state.selected !== -1 && state.section === 'overview') state.section = 'all'
  }

  function render() {
    var tk = typesKey()
    if (rendered.section !== state.section || rendered.filter !== state.filter || rendered.query !== state.query || rendered.inData !== state.inData || rendered.types !== tk) {
      if (rendered.section !== state.section || rendered.filter !== state.filter || rendered.types !== tk) state.limit = PAGE_SIZE
      if (state.section !== 'all') state.typeOpen = false
      renderSidebar()
      renderMain()
      rendered = { section: state.section, filter: state.filter, query: state.query, inData: state.inData, types: tk }
    }
    if (state.selected !== -1 && visible.length && visible.indexOf(events[state.selected]) >= state.limit) {
      state.limit = visible.indexOf(events[state.selected]) + PAGE_SIZE
      renderMain()
    }
    markSelected()
    renderDetails()
    if (state.selected === -1) listFocus = false
    doc.body.classList.toggle('list-focus', listFocus)
    doc.body.classList.remove('show-sidebar')
  }

  function go(index) {
    listFocus = false
    var section = state.section === 'overview' ? 'all' : state.section
    location.hash = sectionHref(section, index, state.filter)
  }

  window.addEventListener('hashchange', function () { parseHash(); render() })

  var timer = 0
  $('search').addEventListener('input', function (ev) {
    clearTimeout(timer)
    timer = setTimeout(function () {
      state.query = ev.target.value
      if (state.query.trim() && state.section === 'overview') state.section = 'all'
      render()
    }, 150)
  })
  $('in-data').addEventListener('change', function (ev) { state.inData = ev.target.checked; render() })
  $('menu').addEventListener('click', function () { doc.body.classList.toggle('show-sidebar') })
  var backdrop = $('sidebar-backdrop')
  if (backdrop) backdrop.addEventListener('click', function () { doc.body.classList.remove('show-sidebar') })
  $('sidebar').addEventListener('click', function (ev) {
    var t = ev.target
    if (t && t.closest && t.closest('a.link')) doc.body.classList.remove('show-sidebar')
  })
  $('main').addEventListener('click', function (ev) {
    var t = ev.target
    if (!t || !t.closest || !t.closest('a.row')) return
    listFocus = false
    doc.body.classList.remove('list-focus')
  })

  doc.addEventListener('click', function (ev) {
    if (!state.typeOpen) return
    var root = doc.querySelector('.type-filter')
    if (root && root.contains(ev.target)) return
    setTypeOpen(false)
  })

  // Ctrl+F goes to the Find field of the open block (a large block keeps only visible rows in
  // the page, so the browser find cannot see it). A second Ctrl+F opens the browser find.
  // ev.code is the physical key, so this also works in a non-Latin layout (key is 'а').
  window.addEventListener('keydown', function (ev) {
    if (!(ev.ctrlKey || ev.metaKey) || ev.altKey || ev.shiftKey) return
    if (ev.code !== 'KeyF' && ev.key !== 'f' && ev.key !== 'F') return
    var active = doc.activeElement
    if (active && active.classList && active.classList.contains('code-find')) return
    var target = doc.querySelector('#details .code-large .code-find') || doc.querySelector('#details .code-find')
    if (!target) return
    ev.preventDefault()
    ev.stopPropagation()
    target.focus()
    target.select()
  }, true)

  doc.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && donateLayer && !donateLayer.hidden) {
      closeDonate()
      return
    }
    if (ev.key === 'Escape' && state.typeOpen) {
      setTypeOpen(false)
      return
    }
    if (ev.target && ev.target.tagName === 'INPUT') return
    if (state.typeOpen) return
    if (ev.key === 'Escape' && state.selected !== -1) {
      location.hash = hereHref(-1)
    } else if ((ev.key === 'ArrowDown' || ev.key === 'ArrowUp') && visible.length) {
      var pos = visible.indexOf(events[state.selected])
      var next = ev.key === 'ArrowDown' ? pos + 1 : pos - 1
      if (pos === -1) next = 0
      if (visible[next]) {
        ev.preventDefault()
        go(visible[next].index)
      }
    }
  })

  // ---------------------------------------------------------------- data export

  function reportBaseName() {
    var file = decodeURIComponent((location.pathname || '').split('/').pop() || '')
    file = file.replace(/\.html?$/i, '')
    return file || 'logs'
  }

  function saveFile(text, type, name) {
    var url = URL.createObjectURL(new Blob([text], { type: type }))
    var a = h('a', { href: url, download: name })
    doc.body.appendChild(a)
    a.click()
    doc.body.removeChild(a)
    setTimeout(function () { URL.revokeObjectURL(url) }, 1000)
  }

  function flash(btn, text) {
    if (!btn.dataset.label) btn.dataset.label = btn.innerHTML
    btn.textContent = text
    clearTimeout(btn._flash)
    btn._flash = setTimeout(function () { btn.innerHTML = btn.dataset.label }, 1600)
  }

  var aiDigest = null
  function digest() {
    if (aiDigest == null) aiDigest = buildAiDigest(JSON.parse(QA_PAYLOAD_TEXT || '{}'), createLogsRuntime())
    return aiDigest
  }

  var jsonBtn = $('export-json')
  if (jsonBtn) {
    jsonBtn.addEventListener('click', function () {
      saveFile(QA_PAYLOAD_TEXT || '{}', 'application/json', reportBaseName() + '.json')
    })
  }
  var aiBtn = $('export-ai')
  if (aiBtn) {
    aiBtn.addEventListener('click', function () {
      var text
      try {
        text = digest()
      } catch (err) {
        console.error('[logs report] AI digest failed', err)
        flash(aiBtn, 'Failed')
        return
      }
      saveFile(text, 'text/markdown', reportBaseName() + '.ai.md')
    })
  }

  var meta = $('nav-meta')
  if (meta) {
    meta.textContent = events.length + ' events' + (info.exportedAt ? ' / exported ' + fmtDateTime(Date.parse(info.exportedAt)) : '')
  }
  parseHash()
  render()
})()
