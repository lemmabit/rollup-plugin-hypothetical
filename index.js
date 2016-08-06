var path = require('path').posix;

function isAbsolute(p) {
  return path.isAbsolute(p) || /^[A-Za-z]:\//.test(p);
}

function absolutify(p) {
  if(typeof process !== 'undefined') {
    return path.join(unixStylePath(process.cwd()), p);
  } else {
    return './' + p;
  }
}

module.exports = function rollupPluginHypothetical(options) {
  options = options || {};
  var files0 = options.files || {};
  var allowRealFiles = options.allowRealFiles || false;
  var allowExternalModules = options.allowExternalModules;
  if(allowExternalModules === undefined) {
    allowExternalModules = true;
  }
  var leaveIdsAlone = options.leaveIdsAlone || false;
  var impliedExtensions = options.impliedExtensions;
  if(impliedExtensions === undefined) {
    impliedExtensions = ['.js'];
  }
  
  var files;
  if(leaveIdsAlone) {
    files = files0;
  } else {
    files = {};
    for(var f in files0) {
      var p = path.normalize(unixStylePath(f));
      if(!isAbsolute(p)) {
        p = absolutify(p);
      }
      files[p] = files0[f];
    }
  }
  
  function basicResolve(importee) {
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
    if(!allowRealFiles) {
      throw dneError(importee);
    }
  }
  
  return {
    resolveId: leaveIdsAlone ? basicResolve : function(importee, importer) {
      importee = unixStylePath(importee);
      if(importer && !/^(\.?\.?|[A-Za-z]:)\//.test(importee)) {
        if(allowExternalModules) {
          return;
        } else {
          throw Error("External module \""+importee+"\" is not allowed!");
        }
      }
      if(!isAbsolute(importee) && importer) {
        importee = path.join(path.dirname(importer), importee);
      } else {
        importee = path.normalize(importee);
      }
      if(!isAbsolute(importee)) {
        importee = absolutify(importee);
      }
      return basicResolve(importee);
    },
    load: function(id) {
      if(!leaveIdsAlone) {
        id = unixStylePath(id);
      }
      if(id in files) {
        return files[id];
      } else if(!allowRealFiles) {
        throw dneError(id);
      }
    }
  };
}

function unixStylePath(p) {
  return p.split('\\').join('/');
}

function dneError(id) {
  return Error("\""+id+"\" does not exist in the hypothetical file system!");
}
