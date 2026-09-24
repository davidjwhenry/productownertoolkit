/**
 * The repository-owned declarative runtime. This is the only executable
 * code ever inserted into a prototype document. It handles exactly the
 * documented `data-prototype-*` attributes, bounded native validation,
 * screen history, bindings, focus-to-heading, and `aria-live` updates. It
 * never evaluates strings, constructs URLs, accesses storage, or performs
 * navigation or network calls.
 *
 * Bridge protocol v2 additions: the context may carry an ordered screen
 * registry with jump fixtures and a `startScreen` override; the runtime
 * accepts `prototype:goto` from the parent (re-validating the target),
 * hydrates the screen's fixture state, and emits `prototype:screen` on
 * every screen shown after `ready`.
 *
 * The string is frozen source: `buildSandboxDocument()` prepends the
 * serialised per-load context initialiser and inserts the complete bytes
 * as the document's single nonce'd `<script>`.
 */
import { DESIGN_THEME_ATTRIBUTE, RUNTIME_ATTRIBUTES, RUNTIME_SURFACE_VARIABLES } from './runtime-contract'

export const RUNTIME_SOURCE = String.raw`
;(function () {
  'use strict'
  var CONTEXT = globalThis.__PROTOTYPE_PLAYGROUND_CONTEXT__
  if (!CONTEXT || CONTEXT.protocolVersion !== 2) return
  var CHANNEL = String(CONTEXT.channelId)
  var PREFIX = 'data-prototype-'
  var readyEmitted = false

  function fail(code) {
    try { parent.postMessage({ type: 'prototype:error', protocolVersion: 2, channelId: CHANNEL, code: code }, '*') } catch (e) {}
  }
  function ready() {
    try { parent.postMessage({ type: 'prototype:ready', protocolVersion: 2, channelId: CHANNEL }, '*') } catch (e) {}
  }
  function notifyScreen(screenId) {
    try { parent.postMessage({ type: 'prototype:screen', protocolVersion: 2, channelId: CHANNEL, screenId: screenId }, '*') } catch (e) {}
  }

  // Jump fixtures for the screens this variant/scenario declares.
  var FIXTURES = {}
  if (CONTEXT.screens) {
    CONTEXT.screens.forEach(function (entry) {
      FIXTURES[entry.id] = entry.fixture || null
    })
  }

  var doc = document
  var root = doc.documentElement
  var body = doc.body
  var ATTRS = ${JSON.stringify(RUNTIME_ATTRIBUTES)}

  function all(selector) { return Array.prototype.slice.call(doc.querySelectorAll(selector)) }

  // ---- Theme and surface context ----
  var THEME_ATTRIBUTE = ${JSON.stringify(DESIGN_THEME_ATTRIBUTE)}
  root.setAttribute(THEME_ATTRIBUTE, String(CONTEXT.themeId))
  var SURFACE_VARS = ${JSON.stringify(RUNTIME_SURFACE_VARIABLES)}
  var SAFE = { desktop: { top: 0, right: 0, bottom: 0, left: 0 }, ios: { top: 59, right: 0, bottom: 34, left: 0 } }
  var safe = SAFE[CONTEXT.surfaceId] || SAFE.desktop
  root.style.setProperty(SURFACE_VARS.safeAreaTop, safe.top + 'px')
  root.style.setProperty(SURFACE_VARS.safeAreaRight, safe.right + 'px')
  root.style.setProperty(SURFACE_VARS.safeAreaBottom, safe.bottom + 'px')
  root.style.setProperty(SURFACE_VARS.safeAreaLeft, safe.left + 'px')

  // ---- Screens ----
  var START = body.getAttribute(ATTRS.start)
  var screens = {}
  all('[' + ATTRS.screen + ']').forEach(function (section) {
    screens[section.getAttribute(ATTRS.screen)] = section
  })
  var backStack = []
  var current = null

  function show(screenId) {
    if (!Object.prototype.hasOwnProperty.call(screens, screenId)) {
      fail('INVALID_DECLARATIVE_TARGET')
      return false
    }
    Object.keys(screens).forEach(function (id) {
      screens[id].setAttribute('hidden', '')
      screens[id].removeAttribute('aria-current')
    })
    var next = screens[screenId]
    next.removeAttribute('hidden')
    next.setAttribute('aria-current', 'true')
    current = screenId
    if (readyEmitted) notifyScreen(screenId)
    var heading = next.querySelector('h1, h2, h3')
    if (heading) {
      heading.setAttribute('tabindex', '-1')
      try { heading.focus({ preventScroll: false }) } catch (e) { heading.focus() }
    }
    return true
  }

  function go(screenId) {
    if (current !== null) backStack.push(current)
    return show(screenId)
  }

  function back() {
    var previous = backStack.pop()
    if (previous === undefined) return
    show(previous)
  }

  // ---- Fixture hydration (direct jumps) ----
  function setControlValue(name, value) {
    var controls = controlsByName(name)
    if (controls.length === 0) return
    var radios = controls.filter(function (control) { return control.type === 'radio' })
    if (radios.length > 0) {
      radios.forEach(function (radio) { radio.checked = radio.value === value })
      return
    }
    controls[0].value = value
  }
  function setControlChecked(name, checked) {
    controlsByName(name).forEach(function (control) {
      if (control.type === 'checkbox' || control.type === 'radio') control.checked = !!checked
    })
  }
  function applyFixture(fixture) {
    if (!fixture) return
    if (fixture.values) {
      Object.keys(fixture.values).forEach(function (name) { setControlValue(name, String(fixture.values[name])) })
    }
    if (fixture.checked) {
      Object.keys(fixture.checked).forEach(function (name) { setControlChecked(name, fixture.checked[name]) })
    }
    refreshBindings()
    clearValidation()
    if (fixture.validation) {
      Object.keys(fixture.validation).forEach(function (name) {
        var target = messageTargetFor(name)
        if (target) {
          target.textContent = String(fixture.validation[name])
          target.setAttribute('role', 'alert')
        }
      })
    }
  }
  /** Jump to any declared screen: initial state, jump fixture, fresh history. */
  function hydrate(screenId) {
    if (!Object.prototype.hasOwnProperty.call(screens, screenId)) {
      fail('UNRESOLVED_SCREEN_TARGET')
      return false
    }
    restoreInitial()
    backStack = []
    applyFixture(FIXTURES[screenId] || null)
    return show(screenId)
  }
  function go(screenId) {
    if (current !== null) backStack.push(current)
    return show(screenId)
  }

  function back() {
    var previous = backStack.pop()
    if (previous === undefined) return
    show(previous)
  }

  // ---- Initial declarative state (for reset) ----
  var initialHidden = []
  var initialValues = []
  function captureInitial() {
    all('[data-prototype-scenario], [id]').forEach(function () {})
    all('*').forEach(function (element) {
      initialHidden.push([element, element.hasAttribute('hidden')])
    })
    all('input, textarea, select').forEach(function (control) {
      initialValues.push([control, control.value, control.checked])
    })
  }
  /** Restore the captured declarative state without changing screens. */
  function restoreInitial() {
    initialHidden.forEach(function (entry) {
      if (entry[1]) entry[0].setAttribute('hidden', ''); else entry[0].removeAttribute('hidden')
    })
    initialValues.forEach(function (entry) {
      entry[0].value = entry[1]
      entry[0].checked = entry[2]
    })
    clearValidation()
    refreshBindings()
  }
  function reset() {
    restoreInitial()
    backStack = []
    show(START)
  }

  // ---- Scenario content ----
  all('[' + ATTRS.scenario + ']').forEach(function (element) {
    var scenario = element.getAttribute(ATTRS.scenario)
    if (scenario !== CONTEXT.scenarioId) element.setAttribute('hidden', '')
    else element.removeAttribute('hidden')
  })

  // ---- Bindings ----
  function controlsByName(name) {
    return Array.prototype.slice.call(doc.querySelectorAll('input[name="' + name + '"], textarea[name="' + name + '"], select[name="' + name + '"]'))
  }
  function controlByName(name) { return controlsByName(name)[0] }
  function boundText(name) {
    var controls = controlsByName(name)
    if (controls.length === 0) return null
    var radios = controls.filter(function (c) { return c.type === 'radio' })
    if (radios.length > 0) {
      for (var index = 0; index < radios.length; index += 1) if (radios[index].checked) return radios[index].value
      return radios[0].value
    }
    var checkbox = controls[0]
    if (checkbox.type === 'checkbox') return checkbox.checked ? 'On' : 'Off'
    return checkbox.value
  }
  function refreshBindings() {
    all('[' + ATTRS.bind + ']').forEach(function (element) {
      var text = boundText(element.getAttribute(ATTRS.bind))
      if (text !== null) element.textContent = text
    })
  }
  doc.addEventListener('input', function (event) {
    if (!event.target || !event.target.name) return
    refreshBindings()
    clearValidationFor(event.target.name)
  })
  doc.addEventListener('change', function () { refreshBindings() })

  // ---- Validation ----
  function formById(formId) {
    return doc.querySelector('form[id="' + formId + '"]')
  }
  function messageTargetFor(name) {
    return doc.querySelector('[' + ATTRS.validationFor + '="' + name + '"]')
  }
  function clearValidationFor(name) {
    var target = messageTargetFor(name)
    if (target) target.textContent = ''
  }
  function clearValidation() {
    all('[' + ATTRS.validationFor + ']').forEach(function (element) { element.textContent = '' })
  }
  function reportValidity(action) {
    var form = formById(action.getAttribute(ATTRS.validate))
    if (!form) { fail('INVALID_DECLARATIVE_TARGET'); return false }
    if (form.checkValidity()) { clearValidation(); return true }
    var copy = action.getAttribute(ATTRS.error) || 'Check this value'
    var invalid = form.querySelector('input:invalid, textarea:invalid, select:invalid')
    if (invalid && invalid.name) {
      var target = messageTargetFor(invalid.name)
      if (target) {
        target.textContent = copy
        target.setAttribute('role', 'alert')
      }
    }
    if (invalid) { try { invalid.focus() } catch (e) {} }
    return false
  }

  // ---- Actions ----
  function parseScenarioMap(value) {
    var entries = []
    value.split(',').forEach(function (entry) {
      var separator = entry.indexOf(':')
      if (separator <= 0 || separator === entry.length - 1) return
      entries.push({ scenarioId: entry.slice(0, separator), screenId: entry.slice(separator + 1) })
    })
    return entries
  }

  doc.addEventListener('click', function (event) {
    var button = event.target && event.target.closest ? event.target.closest('button') : null
    if (!button) return
    var actions = [ ATTRS.go, ATTRS.goByScenario, ATTRS.back, ATTRS.reset, ATTRS.toggle ]
    var chosen = null
    for (var index = 0; index < actions.length; index += 1) {
      if (button.hasAttribute(actions[index])) { chosen = actions[index]; break }
    }
    if (!chosen) return
    event.preventDefault()
    if (button.hasAttribute(ATTRS.validate) && !reportValidity(button)) return
    if (chosen === ATTRS.go) {
      go(button.getAttribute(ATTRS.go))
    } else if (chosen === ATTRS.goByScenario) {
      var target = null
      var entries = parseScenarioMap(button.getAttribute(ATTRS.goByScenario))
      entries.forEach(function (entry) {
        if (entry.scenarioId === CONTEXT.scenarioId) target = entry.screenId
      })
      if (target === null) {
        entries.forEach(function (entry) {
          if (entry.scenarioId === '*') target = entry.screenId
        })
      }
      if (target === null) { fail('INVALID_DECLARATIVE_TARGET'); return }
      go(target)
    } else if (chosen === ATTRS.back) {
      back()
    } else if (chosen === ATTRS.reset) {
      reset()
    } else if (chosen === ATTRS.toggle) {
      var region = doc.getElementById(button.getAttribute(ATTRS.toggle))
      if (!region) { fail('INVALID_DECLARATIVE_TARGET'); return }
      if (region.hasAttribute('hidden')) region.removeAttribute('hidden'); else region.setAttribute('hidden', '')
    }
  })

  // ---- Bridge ----
  // The runtime emits ready exactly once after successful initialisation,
  // then one prototype:screen per shown screen so the host can track
  // position. Unexpected navigation is detected by the parent (iframe
  // load count). Parent-to-child commands are validated like any hostile
  // input: exact keys, protocol version 2, channel match, parent source.
  function emitReady() {
    if (readyEmitted) return
    readyEmitted = true
    ready()
    if (current !== null) notifyScreen(current)
  }

  window.addEventListener('message', function (event) {
    if (!event.source || event.source !== parent) return
    var data = event.data
    if (typeof data !== 'object' || data === null) return
    var keys = Object.keys(data).sort().join(',')
    if (keys !== 'channelId,protocolVersion,screenId,type') return
    if (data.type !== 'prototype:goto' || data.protocolVersion !== 2) return
    if (data.channelId !== CHANNEL || typeof data.screenId !== 'string') return
    if (readyEmitted) hydrate(data.screenId)
  })

  try {
    if (!START || !Object.prototype.hasOwnProperty.call(screens, START)) throw new Error('start screen')
    captureInitial()
    refreshBindings()
    show(START)
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { emitReady() })
    else emitReady()
  } catch (error) {
    fail('RUNTIME_INITIALISATION_FAILED')
  }
})()
`
