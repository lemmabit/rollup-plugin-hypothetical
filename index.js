function isRegex(item) {
  return item && item.constructor === RegExp
}

function isStr(item) {
  return typeof item === 'string'
}

function isFunc(item) {
  return typeof item === 'function'
}

function rollupPluginHypothetical(options) {
  const paths = options?.paths
  if (paths.constructor !== Map) {
    throw Error('options.paths must be a Map object')
  }

  function getContents({key, importee}) {
    const contents = paths.get(key)
    return isFunc(contents)
      ? contents(importee)
      : contents
  }

  function resolveId(importee, _importer, _env, includeKey = false) {
    let foundImportee
    paths.forEach(function(contents, key) {
      if (isRegex(key)) {
        if (key.test(importee)) {
          foundImportee = includeKey ? {importee, key} : importee
        }
      }
      else if (isStr(key) && key === importee) {
        foundImportee = includeKey ? {importee, key} : importee
      }
    })
    return foundImportee
  }

  function load(importee) {
    const resolved = resolveId(importee, null, null, true)
    return (resolved && getContents(resolved))
  }

  return {
    name: 'hypothetical',
    resolveId,
    load,
  }
}

module.exports = rollupPluginHypothetical
