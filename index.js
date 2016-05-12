var path = require('path').posix;

module.exports = function rollupPluginHypothetical(options) {
  options = options || {};
  var files0 = options.files || {};
  var allowRealFiles = options.allowRealFiles || false;
  var allowExternalModules = options.allowExternalModules;
  if(allowExternalModules === undefined) {
    allowExternalModules = true;
  }
  
  var files;
  if(options.leaveIdsAlone) {
    files = files0;
  } else {
    files = {};
    for(var f in files0) {
      files['./' + path.normalize(unixStylePath(f))] = files0[f];
    }
  }
  
  function basicResolve(importee) {
    if(importee in files) {
      return importee;
    } else if(!allowRealFiles) {
      throw dneError(importee);
    }
  }
  
  return {
    resolveId: options.leaveIdsAlone ? basicResolve : function(importee, importer) {
      importee = unixStylePath(importee);
      if(!/^\.?\.?\//.test(importee)) {
        if(allowExternalModules) {
          return;
        } else {
          throw Error("External module \""+importee+"\" is not allowed!");
        }
      }
      var isAbsolute = path.isAbsolute(importee);
      if(!isAbsolute && importer) {
        importee = path.join(path.dirname(importer), importee);
      } else {
        importee = path.normalize(importee);
      }
      if(!isAbsolute) {
        importee = './' + importee;
      }
      return basicResolve(importee);
    },
    load: function(id) {
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
