// Vue Inspector Logs report runtime. Plain browser JS, embedded verbatim into the report.
// Reads the JSON block written by the generator and renders the Logs view.
// Page data is only ever inserted with textContent (JSON highlighting escapes first).
// Keep it free of multi-line template literals and of the closing script tag sequence.
(function () {
  'use strict'

  var APP_URL = 'https://firsakovae.github.io/qa-tools/'
  var PAGE_SIZE = 300
  var HIGHLIGHT_MAX = 300000
  var GROUPS = [
    { title: 'Network', kinds: ['request', 'response'] },
    { title: 'Components', kinds: ['props', 'emit'] },
    { title: 'Pinia', kinds: ['store', 'action'] },
    { title: 'Page', kinds: ['navigation', 'error'] },
  ]
  var KNOWN = ['request', 'response', 'props', 'emit', 'store', 'action', 'navigation', 'error']

  var doc = document
  var payload = { info: {}, events: [] }
  try {
    payload = JSON.parse(doc.getElementById('qa-logs-data').textContent || '{}')
  } catch (e) {
    console.error('[logs report] data block is not valid JSON', e)
  }
  var info = payload.info || {}
  var kindsMeta = info.kinds || {}

  var events = (Array.isArray(payload.events) ? payload.events : []).map(function (raw, index) {
    var ts = typeof raw.timestamp === 'number' ? raw.timestamp : Date.parse(raw.time)
    return {
      index: index,
      raw: raw,
      kind: String(raw.kind || 'other'),
      ts: isFinite(ts) ? ts : 0,
      level: raw.level || 'info',
      title: String(raw.title || '(untitled)'),
      subtitle: raw.subtitle == null ? '' : String(raw.subtitle),
      key: String(raw.key || ''),
      data: raw.data && typeof raw.data === 'object' ? raw.data : {},
    }
  })
  // Newest first, as in the Logs tab
  var ordered = events.slice().sort(function (a, b) { return b.ts - a.ts || b.index - a.index })

  // Request and response events of one network entry: "<kind>:<entryId>" -> event
  var networkPairs = {}
  events.forEach(function (e) {
    var id = (e.kind === 'request' || e.kind === 'response') && e.data.entry && e.data.entry.id
    if (id != null) networkPairs[e.kind + ':' + id] = e
  })
  function pairedEvent(e) {
    var id = e.data.entry && e.data.entry.id
    if (id == null) return null
    if (e.kind === 'request') return networkPairs['response:' + id] || null
    if (e.kind === 'response') return networkPairs['request:' + id] || null
    return null
  }

  function isFailed(e) {
    var en = e.kind === 'response' && e.data.entry
    return !!en && (!!en.error || Number(en.status) >= 400)
  }

  // Overview cards open "All events" narrowed by one of these (hash "#all:<filter>")
  var FILTERS = {
    errors: { label: 'Errors', test: function (e) { return e.level === 'error' } },
    failed: { label: 'Failed requests', test: isFailed },
  }

  var state = { section: 'overview', filter: '', selected: -1, tab: '', query: '', inData: false, limit: PAGE_SIZE }
  var visible = []
  var rendered = { section: null, filter: null, query: null, inData: null }
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
    return ms < 1000 ? Math.round(ms) + ' ms' : (ms / 1000).toFixed(2) + ' s'
  }

  function label(kind) {
    var m = kindsMeta[kind]
    return (m && m.label) || kind
  }

  function kindClass(kind) { return 'k-' + (KNOWN.indexOf(kind) === -1 ? 'other' : kind) }

  function pretty(value) {
    if (value === undefined) return ''
    try { return JSON.stringify(value, null, 2) } catch (e) { return String(value) }
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

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  var TOKEN_RE = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g

  function highlight(text) {
    var out = ''
    var last = 0
    text.replace(TOKEN_RE, function (m, str, colon, lit, offset) {
      out += escapeHtml(text.slice(last, offset))
      var cls = str ? (colon ? 'j-key' : 'j-str') : lit ? 'j-lit' : 'j-num'
      out += '<span class="' + cls + '">' + escapeHtml(str || m) + '</span>' + (colon ? escapeHtml(colon) : '')
      last = offset + m.length
      return m
    })
    return out + escapeHtml(text.slice(last))
  }

  function code(text, json) {
    var pre = h('pre', { class: 'code' })
    if (json && text.length <= HIGHLIGHT_MAX) pre.innerHTML = highlight(text)
    else pre.textContent = text
    var btn = h('button', { class: 'copy', type: 'button', text: 'Copy' })
    btn.addEventListener('click', function () {
      var done = function () { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = 'Copy' }, 1200) }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () {})
    })
    return h('div', { class: 'code-wrap' }, [btn, pre])
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
      t = (e.title + '\n' + e.subtitle + '\n' + e.key + '\n' + label(e.kind)).toLowerCase()
      searchText.set(e, t)
    }
    return t
  }

  var dataText = new WeakMap()
  function dataOf(e) {
    var t = dataText.get(e)
    if (t === undefined) {
      try { t = JSON.stringify(e.data).toLowerCase() } catch (err) { t = '' }
      dataText.set(e, t)
    }
    return t
  }

  function filterEvents() {
    var q = state.query.trim().toLowerCase()
    var section = state.section
    var filter = FILTERS[state.filter]
    return ordered.filter(function (e) {
      if (section !== 'all' && section !== 'overview' && e.kind !== section) return false
      if (filter && !filter.test(e)) return false
      if (!q) return true
      return textOf(e).indexOf(q) !== -1 || (state.inData && dataOf(e).indexOf(q) !== -1)
    })
  }

  // ---------------------------------------------------------------- sidebar

  function counts() {
    var c = {}
    events.forEach(function (e) { c[e.kind] = (c[e.kind] || 0) + 1 })
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
        present.map(function (k) { return link(k, label(k), c[k], k) }),
      )))
    })
    var other = Object.keys(c).filter(function (k) { return listed.indexOf(k) === -1 })
    if (other.length) {
      add(nav, h('div', { class: 'group' }, [h('p', { class: 'group-title', text: 'Other' })].concat(
        other.map(function (k) { return link(k, label(k), c[k], k) }),
      )))
    }
    add(nav, h('a', { class: 'promo', href: APP_URL, target: '_blank', rel: 'noopener noreferrer' }, [
      h('span', { class: 'promo-title' }, [h('img', { class: 'brand-mark', src: ($('brand-icon') || {}).src, alt: '' }), 'Download Vue Inspector']),
      h('span', { class: 'promo-url', text: APP_URL.replace(/^https?:\/\//, '').replace(/\/$/, '') }),
    ]))
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
        card('Failed requests', failed, false, sectionHref('all', -1, 'failed')),
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
        ['Generator', (info.name || 'Vue Inspector Logs') + (info.version ? ' ' + info.version : '')],
        ['Events in file', events.length],
      ]),
    ])
  }

  function row(e) {
    return h('a', {
      class: 'row lvl-' + e.level + (e.index === state.selected ? ' active' : ''),
      href: hereHref(e.index),
      'data-index': e.index,
    }, [
      h('span', { class: 'time', text: fmtTime(e.ts) }),
      h('span', { class: 'badge ' + kindClass(e.kind), text: label(e.kind) }),
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
    var title = state.section === 'all' || state.section === 'overview' ? 'All events' : label(state.section)
    var total = state.section === 'all' || state.section === 'overview'
      ? events.length
      : events.filter(function (e) { return e.kind === state.section }).length
    var filter = FILTERS[state.filter]
    var desc = visible.length === total ? total + ' events'
      : visible.length + ' of ' + total + ' events match' + (filter ? ' the filter' : '') + (state.query.trim() ? (filter ? ' and the search' : ' the search') : '')
    add(main, [
      h('div', { class: 'page-head' }, [
        h('h1', { class: 'page-title', text: title }),
        filter ? h('a', { class: 'chip', href: sectionHref(state.section, -1), title: 'Remove filter' }, [
          h('span', { text: 'Filter: ' + filter.label }),
          h('span', { class: 'chip-x', text: '\u00d7' }),
        ]) : null,
      ]),
      h('p', { class: 'page-desc', text: desc }),
    ])
    if (!visible.length) {
      add(main, h('div', { class: 'list' }, h('div', { class: 'empty', text: 'No events' })))
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

  function sectionsFor(e) {
    var d = e.data
    var en = d.entry || {}
    var list = []
    if (e.kind === 'request') {
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

  function overviewRows(e) {
    var d = e.data
    var rows = [['Time', fmtDateTime(e.ts)]]
    var en = d.entry
    if (en) {
      rows.push(['URL', en.url], ['Method', en.method])
      if (e.kind === 'response') {
        rows.push(['Status', en.error ? 'Failed: ' + en.error : (en.status + ' ' + (en.statusText || '')).trim()])
        rows.push(['Duration', fmtDuration(en.duration)], ['Size', fmtBytes(en.size)])
      } else {
        rows.push(['Initiator', en.initiator])
        if (en.authorization && en.authorization.type !== 'None') rows.push(['Authorization', en.authorization.type])
      }
      return rows
    }
    if (e.kind === 'action') rows.push(['Store', d.storeId], ['Action', d.action], ['Status', d.status], ['Duration', d.duration + ' ms'])
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
    } else {
      Object.keys(d).forEach(function (k) {
        var v = d[k]
        if (v === null || typeof v !== 'object') rows.push([k, v])
      })
    }
    return rows
  }

  function contextLine(e) {
    var d = e.data
    if (e.kind === 'store') {
      var parts = ['Mutation: ' + (d.mutationType || 'direct')]
      if (Array.isArray(d.actions) && d.actions.length) parts.push('Action: ' + d.actions.join(', '))
      return parts.join(' / ')
    }
    if (e.kind === 'props' || e.kind === 'emit') return 'uid ' + d.uid + (d.parents ? ' / Parents: ' + d.parents : '')
    return ''
  }

  function omittedNotice(e, part) {
    var lim = e.data.__sizeLimited && e.data.__sizeLimited.limit
    return h('div', { class: 'muted', text: 'This part (' + fmtBytes(part.size) + ') was not saved: it exceeded the per-event limit' + (lim ? ' of ' + fmtBytes(lim) : '') + ' when the logs were captured.' })
  }

  function bodyView(body) {
    if (!body) return h('div', { class: 'muted', text: 'No body' })
    if (body.isBinary) return h('div', { class: 'muted', text: 'Binary content (' + (body.contentType || 'unknown') + ')' })
    var nodes = []
    if (body.truncated) nodes.push(h('p', { class: 'notice', text: 'Body truncated (' + fmtBytes(body.originalSize) + ' originally).' }))
    if (body.formData && body.formData.length) {
      nodes.push(jsonBlock(body.formData))
      return nodes
    }
    var text = String(body.text || '')
    var json = false
    var trimmed = text.trim()
    if (/json/i.test(body.contentType || '') || trimmed[0] === '{' || trimmed[0] === '[') {
      try { text = JSON.stringify(JSON.parse(trimmed), null, 2); json = true } catch (err) { /* keep as is */ }
    }
    nodes.push(text ? code(text, json) : h('div', { class: 'muted', text: 'Empty body' }))
    return nodes
  }

  function changesView(e) {
    var changes = Array.isArray(e.data.changes) ? e.data.changes : []
    if (!changes.length) return h('div', { class: 'muted', text: 'No changes' })
    var nodes = changes.map(function (c) {
      var cls = c.type === 'added' ? 'c-added' : c.type === 'removed' ? 'c-removed' : 'c-changed'
      return h('div', { class: 'change' }, [
        h('div', { class: 'change-path' }, [h('span', { class: 'badge tiny ' + cls, text: c.type }), h('span', { text: c.path })]),
        c.type !== 'added' ? h('div', { class: 'minus', text: '- ' + preview(c.before) }) : null,
        c.type !== 'removed' ? h('div', { class: 'plus', text: '+ ' + preview(c.after) }) : null,
      ])
    })
    if (e.data.changesTruncated) nodes.push(h('div', { class: 'muted', text: 'Too many changes - list is truncated. See Before / After for full state.' }))
    return nodes
  }

  function tabContent(e, tab) {
    var d = e.data
    var en = d.entry || {}
    var part = tab === 'before' ? d.before : tab === 'after' ? d.after : tab === 'args' ? d.args
      : tab === 'result' ? (d.status === 'error' ? d.error : d.result) : tab === 'changes' ? d.changes : undefined
    if (isOmitted(part)) return omittedNotice(e, part)
    switch (tab) {
      case 'overview': return kv(overviewRows(e))
      case 'params': return kv((en.params || []).map(function (p) { return [p.key, p.value] }), true)
      case 'requestHeaders':
      case 'responseHeaders': {
        var hs = (tab === 'requestHeaders' ? en.requestHeaders : en.responseHeaders) || []
        return hs.length ? kv(hs.map(function (x) { return [x.name, x.value] }), true) : h('div', { class: 'muted', text: 'No headers' })
      }
      case 'requestBody': return bodyView(en.requestBody)
      case 'responseBody': return bodyView(en.responseBody)
      case 'changes': return changesView(e)
      case 'before': return jsonBlock(d.before)
      case 'after': return jsonBlock(d.after)
      case 'args': return jsonBlock(d.args || [])
      case 'result': return jsonBlock(d.status === 'error' ? d.error : d.result === undefined ? null : d.result)
      case 'stack': return code(String(d.stack || ''), false)
      default: return jsonBlock(e.raw)
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
    var sections = sectionsFor(e)
    var ids = sections.map(function (s) { return s[0] })
    if (ids.indexOf(state.tab) === -1) state.tab = ids[0]

    var pair = pairedEvent(e)
    var pairLink = null
    if (pair) {
      // Stay in the current list when the pair is listed there, otherwise open its own section
      var listed = state.section === 'all' && (!FILTERS[state.filter] || FILTERS[state.filter].test(pair))
      pairLink = h('a', {
        class: 'pair-btn',
        href: listed ? hereHref(pair.index) : sectionHref(pair.kind, pair.index),
        title: pair.kind === 'response' ? 'Open the response of this request' : 'Open the request of this response',
        text: pair.kind === 'response' ? 'Response \u2192' : '\u2190 Request',
      })
    }

    var head = h('div', { class: 'd-head' }, [
      h('div', { class: 'd-head-main' }, [
        h('div', { class: 'd-title-row' }, [
          h('span', { class: 'badge ' + kindClass(e.kind), text: label(e.kind) }),
          e.kind === 'response' && e.data.entry
            ? h('span', { class: 'badge mono ' + statusClass(e.data.entry), text: e.data.entry.error ? 'Failed' : e.data.entry.status })
            : null,
          h('span', { class: 'd-title', text: e.title, title: e.title }),
        ]),
        h('div', { class: 'd-sub', text: contextLine(e) || e.subtitle || fmtDateTime(e.ts) }),
      ]),
      pairLink,
      h('a', { class: 'icon-btn', href: hereHref(-1), title: 'Close (Esc)', text: '\u00d7' }),
    ])
    var tabs = h('div', { class: 'tabs' }, sections.map(function (s) {
      var b = h('button', { class: 'tab' + (s[0] === state.tab ? ' active' : ''), type: 'button', text: s[1] })
      b.addEventListener('click', function () { state.tab = s[0]; renderDetails() })
      return b
    }))
    var body = h('div', { class: 'd-body' })
    try {
      add(body, tabContent(e, state.tab))
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
    if (cur) {
      cur.classList.add('active')
      if (cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' })
    }
  }

  // ---------------------------------------------------------------- routing

  function parseHash() {
    var parts = decodeURIComponent(location.hash.slice(1)).split('/')
    var head = (parts[0] || 'overview').split(':')
    var section = head[0]
    var valid = section === 'overview' || section === 'all' || events.some(function (e) { return e.kind === section })
    state.section = valid ? section : 'overview'
    state.filter = valid && FILTERS[head[1]] ? head[1] : ''
    if (state.filter && state.section === 'overview') state.section = 'all'
    var idx = parts.length > 1 ? Number(parts[1]) : -1
    state.selected = isFinite(idx) && events[idx] ? idx : -1
    if (state.selected !== -1 && state.section === 'overview') state.section = 'all'
  }

  function render() {
    if (rendered.section !== state.section || rendered.filter !== state.filter || rendered.query !== state.query || rendered.inData !== state.inData) {
      if (rendered.section !== state.section || rendered.filter !== state.filter) state.limit = PAGE_SIZE
      renderSidebar()
      renderMain()
      rendered = { section: state.section, filter: state.filter, query: state.query, inData: state.inData }
    }
    if (state.selected !== -1 && visible.length && visible.indexOf(events[state.selected]) >= state.limit) {
      state.limit = visible.indexOf(events[state.selected]) + PAGE_SIZE
      renderMain()
    }
    markSelected()
    renderDetails()
    doc.body.classList.remove('show-sidebar')
  }

  function go(index) {
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

  doc.addEventListener('keydown', function (ev) {
    if (ev.target && ev.target.tagName === 'INPUT') return
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

  var meta = $('nav-meta')
  if (meta) {
    meta.textContent = events.length + ' events' + (info.exportedAt ? ' / exported ' + fmtDateTime(Date.parse(info.exportedAt)) : '')
  }
  parseHash()
  render()
})()
