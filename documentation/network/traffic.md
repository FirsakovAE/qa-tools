---
title: Traffic interception
---

# Breakpoints and mock responses

The **Network** tab and **Options → Network** provide two interception mechanisms:

* **Breakpoint** — pause an outgoing request **before it hits the network**, edit parameters, then continue;
* **Mock response** — return a crafted response **without calling the server**.

Both apply only to **`fetch`** and **`XMLHttpRequest`** on the current page.

General interception limits (page context, CORS, scope) are described in [Working with requests](/network/general).

---

## Breakpoints

### Purpose

A breakpoint pauses an outbound request **before it is sent**.

When URL and method match the rule:

* the request is held;
* the UI lets you edit parameters;
* after confirmation the request continues with your changes;
* or you can cancel.

Interception happens after the app built the request but before native send.

### What you can change

Before continuing you can edit:

* HTTP method;
* URL (scheme, host, path, query);
* headers;
* body.

After **Apply** the request goes out in the modified form.

### Where to configure

* **Network** — create or adjust a breakpoint from a captured request.
* **Options → Network → Breakpoints** — manage the rule list.

### Behavior

When a request hits an active breakpoint rule the UI focuses editing:

* the breakpoint card opens;
* the view may switch to **Network**;
* a collapsed inspector iframe expands automatically.

Until you confirm or cancel, the request stays paused.

## Mock responses

### Purpose

Mock fully replaces a network call with a local response.

When a rule matches:

* no server round-trip;
* a synthetic response is built;
* the page receives it like a normal HTTP response.

### What a mock can set

* **status** and **statusText**;
* **headers**;
* **body**;
* **delay** before resolving.

### Where to configure

* **Network** — create or adjust from a request row.
* **Options → Network → Mock Responses** — manage rules.

### Behavior

If mock matches:

* the real request is not sent;
* breakpoint does not apply for that call.

Order of evaluation:

1. mock first;
2. if no mock — breakpoint;
3. otherwise normal network.

Mock wins over breakpoint.

---

## Breakpoint vs mock

| Mechanism | Network round-trip | Can change request | Can change response |
|-----------|-------------------|--------------------|---------------------|
| Breakpoint | Yes | Yes | No |
| Mock response | No | No | Yes |

---

## Limits

Both work only for:

* **fetch**
* **XMLHttpRequest**

Not intercepted:

* `<img>`, `<script>`, `<link>` loads;
* service workers outside this layer;
* native browser calls outside page JS.

**OPTIONS (preflight)** requests are not part of interception.

---

## Compared to Charles Proxy

**Charles** (and similar **system / external proxies**: Fiddler, mitmproxy, …) sits **between client and server** at the OS or app level:

* sees traffic **beyond the browser** (mobile apps, CLI, other tools if proxied);
* **HTTPS** typically needs a trusted root and **SSL Proxying** (TLS termination);
* **Breakpoints** and **Map Local / Remote** apply to **all** matching connections **on that channel**.

**Vue Inspector** runs **inside the browser tab**: it patches **`fetch`** and **`XMLHttpRequest`**.

| Aspect | Charles (typical) | Vue Inspector |
| ------ | ----------------- | ------------- |
| Level | Proxy / out-of-process | JS in the page |
| Scope | Many clients, HTTP(S) through proxy | This document only: **fetch** and **XHR** |
| HTTPS | Custom trust, TLS break | No extra TLS break — the app already sees responses in JS |
| SW / native requests | Often visible on the path | Not covered here |
| SPA convenience | Proxy + certs setup | Enable rules in the inspector for the current site |

In **intent**, Inspector breakpoints/mocks resemble Charles (**pause / fake a response**); in **placement** it is a **page-level devtool**, not a network proxy.

## See also

* [Working with requests](/network/general)
* [Export collections](/network/export)
