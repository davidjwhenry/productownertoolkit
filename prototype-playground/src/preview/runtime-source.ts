/**
 * The repository-owned declarative runtime. This is the only executable
 * code ever inserted into a prototype document. It handles exactly the
 * documented `data-prototype-*` attributes, bounded native validation,
 * screen history, bindings, focus-to-heading, and `aria-live` updates. It
 * never evaluates strings, constructs URLs, accesses storage, or performs
 * navigation or network calls.
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
  if (!CONTEXT || CONTEXT.protocolVersion !== 1) return
  var CHANNEL = String(CONTEXT.channelId)
  var PREFIX = 'data-prototype-'

  function fail(code) {
    try { parent.postMessage({ type: 'prototype:error', protocolVersion: 1, channelId: CHANNEL, code: code }, '*') } catch (e) {}
  }
  function ready() {
    try { parent.postMessage({ type: 'prototype:ready', protocolVersion: 1, channelId: CHANNEL }, '*') } catch (e) {}
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
  function reset() {
    initialHidden.forEach(function (entry) {
      if (entry[1]) entry[0].setAttribute('hidden', ''); else entry[0].removeAttribute('hidden')
    })
    initialValues.forEach(function (entry) {
      entry[0].value = entry[1]
      entry[0].checked = entry[2]
    })
    clearValidation()
    refreshBindings()
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
  // The runtime emits ready exactly once after successful initialisation.
  // Unexpected navigation is detected by the parent (iframe load count).
  var emitted = false
  function emitReady() {
    if (emitted) return
    emitted = true
    ready()
  }

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
