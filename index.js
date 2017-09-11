var path = require('path').posix;

function isAbsolute(p) {
  return path.isAbsolute(p) || /^[A-Za-z]:\//.test(p);
}

function isExternal(p) {
  return !/^(\.?\.?|[A-Za-z]:)\//.test(p);
}

function absolutify(p, cwd) {
  if(cwd) {
    return path.join(cwd, p);
  } else {
    return './' + p;
  }
}

module.exports = function rollupPluginHypothetical(options) {
  options = options || {};
  var files0 = options.files || {};
  var allowFallthrough = options.allowFallthrough || false;
  var allowRelativeExternalFallthrough = options.allowRelativeExternalFallthrough || false;
  var allowExternalFallthrough = options.allowExternalFallthrough;
  if(allowExternalFallthrough === undefined) {
    allowExternalFallthrough = true;
  }
  var leaveIdsAlone = options.leaveIdsAlone || false;
  var impliedExtensions = options.impliedExtensions;
  if(impliedExtensions === undefined) {
    impliedExtensions = ['.js', '/'];
  } else {
    impliedExtensions = Array.prototype.slice.call(impliedExtensions);
  }
  var cwd = options.cwd;
  if(cwd !== false) {
    if(cwd === undefined) {
      cwd = process.cwd();
    }
    cwd = unixStylePath(cwd);
  }
  
  var files = {};
  if(leaveIdsAlone) {
    for(var f in files0) {
      files[f] = files0[f];
    }
  } else {
    for(var f in files0) {
      var unixStyleF = unixStylePath(f);
      var pathIsExternal = isExternal(unixStyleF);
      var p = path.normalize(unixStyleF);
      if(pathIsExternal && !isExternal(p)) {
        throw Error(
          "Supplied external file path \"" +
          unixStyleF +
          "\" normalized to \"" +
          p +
          "\"!"
        );
      }
      if(!isAbsolute(p) && !pathIsExternal) {
        p = absolutify(p, cwd);
      }
      files[p] = files0[f];
    }
  }
  
  function basicResolve(importee) {
    if(importee in files) {
      return importee;
    } else if(!allowFallthrough) {
      throw Error(dneMessage(importee));
    }
  }
  
  var resolveId = leaveIdsAlone ? basicResolve : function(importee, importer) {
    importee = unixStylePath(importee);
    
    // the entry file is never external.
    var importeeIsExternal = Boolean(importer) && isExternal(importee);
    
    var importeeIsRelativeToExternal =
      importer &&
      !importeeIsExternal &&
      isExternal(importer) &&
      !isAbsolute(importee);
    
    if(importeeIsExternal) {
      var normalizedImportee = path.normalize(importee);
      if(!isExternal(normalizedImportee)) {
        throw Error(
          "External import \"" +
          importee +
          "\" normalized to \"" +
          normalizedImportee +
          "\"!"
        );
      }
      importee = normalizedImportee;
    } else if(importeeIsRelativeToExternal) {
      var joinedImportee = path.join(path.dirname(importer), importee);
      if(!isExternal(joinedImportee)) {
        throw Error(
          "Import \"" +
          importee +
          "\" relative to external import \"" +
          importer +
          "\" results in \"" +
          joinedImportee +
          "\"!"
        );
      }
      importee = joinedImportee;
    } else {
      if(!isAbsolute(importee) && importer) {
        importee = path.join(path.dirname(importer), importee);
      } else {
        importee = path.normalize(importee);
      }
      if(!isAbsolute(importee)) {
        importee = absolutify(importee, cwd);
      }
    }
    
    if(importee in files) {
      return importee;
    } else if(impliedExtensions) {
      for(var i = 0, len = impliedExtensions.length; i < len; ++i) {
        var extended = importee + impliedExtensions[i];
        if(extended in files) {
          return extended;
        }
      }
    }
    if(importeeIsExternal && !allowExternalFallthrough) {
      throw Error(dneMessage(importee));
    }
    if(importeeIsRelativeToExternal && !allowRelativeExternalFallthrough) {
      throw Error(dneMessage(importee));
    }
    if(!importeeIsExternal && !importeeIsRelativeToExternal && !allowFallthrough) {
      throw Error(dneMessage(importee));
    }
    if(importeeIsRelativeToExternal) {
      // we have to resolve this case specially because Rollup won't
      // treat it as external if we don't.
      // we have to trust that the user has informed Rollup that this import
      // is supposed to be external... ugh.
      return importee;
    }
  };
  
  return {
    resolveId: resolveId,
    load: function(id) {
      if(id in files) {
        return files[id];
      } else {
        id = resolveId(id);
        return id && files[id];
      }
    }
  };
}

function unixStylePath(p) {
  return p.split('\\').join('/');
}

function dneMessage(id) {
  return "\""+id+"\" does not exist in the hypothetical file system!";
}
