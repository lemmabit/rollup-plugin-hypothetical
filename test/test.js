var rollup       = require('rollup');
var path         = require('path');
var hypothetical = require('..');


function resolve(promise, expected) {
  return promise.then(function(bundle) {
    var code = bundle.generate().code;
    var object = {};
    (new Function('object', code))(object);
    for(var key in expected) {
      if(!(key in object)) {
        throw Error("Expected object to have key \""+key+"\"!");
      }
      var ok = JSON.stringify(object[key]), ek = JSON.stringify(expected[key]);
      if(ok !== ek)  {
        throw Error("Expected object."+key+" to be "+ek+", not "+ok+"!");
      }
    }
    for(var key in object) {
      if(!(key in expected)) {
        throw Error("Didn't expect object to have key \""+key+"\"!");
      }
    }
  });
}

function reject(promise, message) {
  return promise.then(function() {
    throw Error("Promise was resolved when it should have been rejected!");
  }, function(reason) {
    if(message && reason.message.indexOf(message) === -1) {
      throw Error("Rejection message \""+reason.message+"\" does not contain \""+message+"\"!");
    }
  });
}


it("should let nothing through if no options are passed", function() {
  return reject(rollup.rollup({
    entry: './test/fixtures/a.js',
    plugins: [hypothetical()]
  }), "does not exist in the hypothetical file system");
});

it("should be able to simulate an entry file", function() {
  return resolve(rollup.rollup({
    entry: './x.js',
    plugins: [hypothetical({ files: { './x.js': 'object.key = false;' } })]
  }), { key: false });
});

it("should be able to simulate an imported file", function() {
  return resolve(rollup.rollup({
    entry: './x.js',
    plugins: [hypothetical({ files: {
      './x.js': 'import \'./y.js\'; object.key = false;',
      './y.js': 'object.key2 = 5;'
    } })]
  }), { key: false, key2: 5 });
});

it("should be able to simulate an entry file where one already exists", function() {
  return resolve(rollup.rollup({
    entry: './test/fixtures/a.js',
    plugins: [hypothetical({ files: { './test/fixtures/a.js': 'object.key = false;' } })]
  }), { key: false });
});

it("should import files relative to the importer", function() {
  return resolve(rollup.rollup({
    entry: './dir/x.js',
    plugins: [hypothetical({ files: {
      './dir/x.js': 'import \'./y.js\'; object.key = false;',
      './dir/y.js': 'object.key2 = 5;'
    } })]
  }), { key: false, key2: 5 });
});

it("shouldn't import external modules from wonderland", function() {
  return reject(resolve(rollup.rollup({
    entry: './x.js',
    external: ['y.js'],
    plugins: [hypothetical({ files: {
      './x.js': 'import \'y.js\'; object.key = false;',
      './y.js': 'object.key2 = 5;'
    } })]
  }), { key: false, key2: 5 }));
});

it("should use the cwd option when present", function() {
  return resolve(rollup.rollup({
    entry: './dir/x.js',
    plugins: [hypothetical({ files: {
      '/fake/dir/x.js': 'import \'/fake/y.js\'; object.key = false;',
      './y.js': 'object.key2 = 5;'
    }, cwd: '/fake/' })]
  }), { key: false, key2: 5 });
});

it("should forgo absolute paths when options.cwd is false", function() {
  var files = {};
  files[path.resolve('x.js')] = 'object.key = false;';
  return reject(rollup.rollup({
    entry: './x.js',
    plugins: [hypothetical({ files: files, cwd: false })]
  }), "does not exist in the hypothetical file system");
});

it("should forbid external modules when options.allowExternalModules is false", function() {
  return reject(rollup.rollup({
    entry: './x.js',
    plugins: [hypothetical({ files: {
      './x.js': 'import \'y.js\'; object.key = false;'
    }, allowExternalModules: false })]
  }), "xternal module");
});

it("should allow importing of real files when options.allowRealFiles is true", function() {
  return resolve(rollup.rollup({
    entry: './test/fixtures/x.js',
    plugins: [hypothetical({ files: {
      './test/fixtures/x.js': 'import \'./a.js\'; object.key2 = -3;'
    }, allowRealFiles: true })]
  }), { key: true, key2: -3 });
});

it("should allow entry to be a real file when options.allowRealFiles is true", function() {
  return resolve(rollup.rollup({
    entry: './test/fixtures/b.js',
    plugins: [hypothetical({ files: {
      './test/fixtures/a.js': 'object.key = false;'
    }, allowRealFiles: true })]
  }), { key: false, key2: 0 });
});

it("should allow every file to be real when options.allowRealFiles is true", function() {
  return resolve(rollup.rollup({
    entry: './test/fixtures/b.js',
    plugins: [hypothetical({ allowRealFiles: true })]
  }), { key: true, key2: 0 });
});

it("should bypass this insufferable garbage when options.leaveIdsAlone is true", function() {
  return resolve(rollup.rollup({
    entry: 'slash/something',
    plugins: [hypothetical({ files: {
      'slash/something': 'import \'so free\'; object.key = \'woo\';',
      'so free': 'object.key2 = 1000'
    }, leaveIdsAlone: true })]
  }), { key: 'woo', key2: 1000 });
});

it("should distinguish between / and \\ when leaving IDs alone", function() {
  // Rollup "normalizes" entry paths, so those are a lost cause. :(
  return reject(rollup.rollup({
    entry: 'x',
    plugins: [hypothetical({ files: {
      'x': 'import \'\\\\slash\\\\something\'; object.key = false;',
      '/slash/something': 'object.key2 = 5'
    }, leaveIdsAlone: true })]
  }), "\"\\slash\\something\" does not exist in the hypothetical file system");
});

it("should do so even when another module resolves the ID", function() {
  return reject(rollup.rollup({
    entry: 'x',
    plugins: [
      {
        resolveId: function(importee) {
          return importee.split('/').join('\\');
        }
      },
      hypothetical({ files: {
        'x': 'import \'/slash/something\'; object.key = false;',
        '/slash/something': 'object.key2 = 5'
      }, leaveIdsAlone: true })
    ]
  }), "\"\\slash\\something\" does not exist in the hypothetical file system");
});

describe("Paths", function() {
  it("should handle an entry point that appears to be external", function() {
    return resolve(rollup.rollup({
      entry: 'x.js',
      plugins: [hypothetical({ files: { './x.js': 'object.key = false;' } })]
    }), { key: false });
  });
  
  it("should handle absolute paths", function() {
    return resolve(rollup.rollup({
      entry: '/x.js',
      plugins: [hypothetical({ files: { '/x.js': 'object.key = false;' } })]
    }), { key: false });
  });
  
  it("should handle backslash-separated paths", function() {
    return resolve(rollup.rollup({
      entry: 'dir\\x.js',
      plugins: [hypothetical({ files: { 'dir\\x.js': 'object.key = false;' } })]
    }), { key: false });
  });
  
  it("should handle mixed slash style paths", function() {
    return resolve(rollup.rollup({
      entry: 'dir\\this-is-horrible/x.js',
      plugins: [hypothetical({ files: { 'dir\\this-is-horrible/x.js': 'object.key = false;' } })]
    }), { key: false });
  });
  
  it("should convert between slash styles", function() {
    return resolve(rollup.rollup({
      entry: 'dir\\x.js',
      plugins: [hypothetical({ files: { 'dir/x.js': 'object.key = false;' } })]
    }), { key: false });
  });
  
  it("should handle backslashes when another plugin resolves the ID", function() {
    return resolve(rollup.rollup({
      entry: 'C:\\dir\\x.js',
      plugins: [
        {
          resolveId: function(importee) {
            return importee.split('/').join('\\');
          }
        },
        hypothetical({ files: { 'C:/dir/x.js': 'object.key = false;' } })
      ]
    }), { key: false });
  });
  
  it("should handle DOS drive names", function() {
    return resolve(rollup.rollup({
      entry: 'C:\\x.js',
      plugins: [hypothetical({ files: { 'C:\\x.js': 'object.key = false;' } })]
    }), { key: false });
  });
  
  it("should normalize supplied file paths", function() {
    return resolve(rollup.rollup({
      entry: 'x.js',
      plugins: [hypothetical({ files: { './dir/../x.js': 'object.key = false;' } })]
    }), { key: false });
  });
  
  it("should normalize module file paths", function() {
    return resolve(rollup.rollup({
      entry: './dir/../x.js',
      plugins: [hypothetical({ files: { 'x.js': 'object.key = false;' } })]
    }), { key: false });
  });
  
  it("should add a .js extension if necessary by default", function() {
    return resolve(rollup.rollup({
      entry: 'x',
      plugins: [hypothetical({ files: {
        './x.js': 'import \'./y\'; object.key = false;',
        './y.js': 'object.key2 = 5;'
      } })]
    }), { key: false, key2: 5 });
  });
  
  it("should add any extensions passed into options.impliedExtensions", function() {
    return resolve(rollup.rollup({
      entry: 'x',
      plugins: [hypothetical({ files: {
        './x.lol': 'import \'./y\'; object.key = false;',
        './y.ha': 'object.key2 = 5;'
      }, impliedExtensions: ['.lol', '.ha'] })]
    }), { key: false, key2: 5 });
  });
  
  it("shouldn't add .js if it isn't in options.impliedExtensions", function() {
    return reject(resolve(rollup.rollup({
      entry: 'x',
      plugins: [hypothetical({ files: {
        './x.lol': 'import \'./y\'; object.key = false;',
        './y.js': 'object.key2 = 5;'
      }, impliedExtensions: ['.lol'] })]
    })), "does not exist in the hypothetical file system");
  });
  
  it("shouldn't add any extensions if options.impliedExtensions is false", function() {
    return reject(resolve(rollup.rollup({
      entry: 'x.js',
      plugins: [hypothetical({ files: {
        './x.js': 'import \'./y\'; object.key = false;',
        './y.js': 'object.key2 = 5;'
      }, impliedExtensions: false })]
    })), "does not exist in the hypothetical file system");
  });
});
