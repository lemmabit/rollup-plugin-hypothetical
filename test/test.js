var rollup       = require('rollup');
var path         = require('path');
var hypothetical = require('..');


function resolve(promise, expected) {
  return promise.then(function(bundle) {
    return bundle.generate({ format: 'es' });
  }).then(function(result) {
    var code = result.code;
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
    input: './test/fixtures/a.js',
    plugins: [hypothetical()]
  }), "does not exist in the hypothetical file system");
});

it("should be able to simulate an entry file", function() {
  return resolve(rollup.rollup({
    input: './x.js',
    plugins: [hypothetical({ files: { './x.js': 'object.key = false;' } })]
  }), { key: false });
});

it("should be able to simulate an imported file", function() {
  return resolve(rollup.rollup({
    input: './x.js',
    plugins: [hypothetical({ files: {
      './x.js': 'import \'./y.js\'; object.key = false;',
      './y.js': 'object.key2 = 5;'
    } })]
  }), { key: false, key2: 5 });
});

it("should be able to simulate an entry file where one already exists", function() {
  return resolve(rollup.rollup({
    input: './test/fixtures/a.js',
    plugins: [hypothetical({ files: { './test/fixtures/a.js': 'object.key = false;' } })]
  }), { key: false });
});

it("should import files relative to the importer", function() {
  return resolve(rollup.rollup({
    input: './dir/x.js',
    plugins: [hypothetical({ files: {
      './dir/x.js': 'import \'./y.js\'; object.key = false;',
      './dir/y.js': 'object.key2 = 5;'
    } })]
  }), { key: false, key2: 5 });
});

it("shouldn't import external modules from wonderland", function() {
  return reject(resolve(rollup.rollup({
    input: './x.js',
    external: ['y.js'],
    plugins: [hypothetical({ files: {
      './x.js': 'import \'y.js\'; object.key = false;',
      './y.js': 'object.key2 = 5;'
    } })]
  }), { key: false, key2: 5 }));
});

it("should use the cwd option when present", function() {
  return resolve(rollup.rollup({
    input: './dir/x.js',
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
    input: './x.js',
    plugins: [hypothetical({ files: files, cwd: false })]
  }), "does not exist in the hypothetical file system");
});

it("should forbid external fallthrough when options.allowExternalFallthrough is false", function() {
  return reject(rollup.rollup({
    input: './x.js',
    plugins: [hypothetical({ files: {
      './x.js': 'import \'y.js\'; object.key = false;'
    }, allowExternalFallthrough: false })]
  }), "does not exist in the hypothetical file system");
});

it("should allow fallthrough to real files when options.allowFallthrough is true", function() {
  return resolve(rollup.rollup({
    input: './test/fixtures/x.js',
    plugins: [hypothetical({ files: {
      './test/fixtures/x.js': 'import \'./a.js\'; object.key2 = -3;'
    }, allowFallthrough: true })]
  }), { key: true, key2: -3 });
});

it("should allow entry to fall through when options.allowFallthrough is true", function() {
  return resolve(rollup.rollup({
    input: './test/fixtures/b.js',
    plugins: [hypothetical({ files: {
      './test/fixtures/a.js': 'object.key = false;'
    }, allowFallthrough: true })]
  }), { key: false, key2: 0 });
});

it("should allow every file to fall through when options.allowFallthrough is true", function() {
  return resolve(rollup.rollup({
    input: './test/fixtures/b.js',
    plugins: [hypothetical({ allowFallthrough: true })]
  }), { key: true, key2: 0 });
});

it("shouldn't override options.allowExternalFallthrough when options.allowFallthrough is true", function() {
  return reject(rollup.rollup({
    input: './x.js',
    plugins: [hypothetical({ files: {
      './x.js': 'import \'y.js\'; object.key = false;'
    }, allowFallthrough: true, allowExternalFallthrough: false })]
  }), "does not exist in the hypothetical file system");
});

it("should bypass this insufferable garbage when options.leaveIdsAlone is true", function() {
  return resolve(rollup.rollup({
    input: 'slash/something',
    plugins: [hypothetical({ files: {
      'slash/something': 'import \'so free\'; object.key = \'woo\';',
      'so free': 'object.key2 = 1000'
    }, leaveIdsAlone: true })]
  }), { key: 'woo', key2: 1000 });
});

it("should distinguish between / and \\ when leaving IDs alone", function() {
  return reject(rollup.rollup({
    input: 'x',
    plugins: [hypothetical({ files: {
      'x': 'import \'\\\\slash\\\\something\'; object.key = false;',
      '/slash/something': 'object.key2 = 5'
    }, leaveIdsAlone: true })]
  }), "\"\\slash\\something\" does not exist in the hypothetical file system");
});

it("should do so even when another module resolves the ID", function() {
  return reject(rollup.rollup({
    input: 'x',
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

it("shouldn't add file extensions when leaving IDs alone", function() {
  return reject(rollup.rollup({
    input: 'x',
    plugins: [hypothetical({ files: {
      'x.js': 'object.key = false;',
    }, leaveIdsAlone: true })]
  }), "\"x\" does not exist in the hypothetical file system");
});

it("should accept files as a Map via the filesMap option", function() {
  return resolve(rollup.rollup({
    input: './x.js',
    plugins: [hypothetical({ filesMap: new Map([
      ['./x.js', 'import \'./y.js\'; object.key = false;'],
      ['./y.js', 'object.key2 = 5;']
    ]) })]
  }), { key: false, key2: 5 });
});

it("should throw if both files and filesMap are passed", function() {
  try {
    hypothetical({
      files: {
        './x.js': 'import \'./y.js\'; object.key = false;',
        './y.js': 'object.key2 = 5;'
      },
      filesMap: new Map([
        ['./x.js', 'import \'./y.js\'; object.key = false;'],
        ['./y.js', 'object.key2 = 5;']
      ])
    });
  } catch(e) {
    if(e.message.indexOf("Both an Object and a Map were supplied") === -1) {
      throw Error("Incorrect error message \"" + e.message + "\"!");
    }
    return;
  }
  throw Error("No error was thrown!");
});

it("should re-resolve paths from other plugins", function() {
  return resolve(rollup.rollup({
    input: 'not used',
    plugins: [
      {
        resolveId: function(importee) {
          return '/dir/../x';
        }
      },
      hypothetical({ files: {
        '/x.js': 'object.key = false;',
      } })
    ]
  }), { key: false });
});

it("should handle paths with names matching keys on Object.prototype", function() {
  return reject(rollup.rollup({
    input: 'x.js',
    plugins: [hypothetical({ files: {
      './x.js': 'import "hasOwnProperty";'
    }, allowExternalFallthrough: false })]
  }), "\"hasOwnProperty\" does not exist in the hypothetical file system");
});

it("should also do so when leaveIdsAlone is true", function() {
  return reject(rollup.rollup({
    input: 'x.js',
    plugins: [hypothetical({ files: {
      'x.js': 'import "hasOwnProperty";'
    }, leaveIdsAlone: true })]
  }), "\"hasOwnProperty\" does not exist in the hypothetical file system");
});

it("should handle paths called __proto__", function() {
  return reject(rollup.rollup({
    input: 'x.js',
    plugins: [hypothetical({ filesMap: new Map([
      ['./x.js', { code: 'import "__proto__"; object.key = false;', map: { mappings: '' } }],
      ['__proto__', { code: 'import "code"; object.key2 = 5;', map: { mappings: '' } }]
    ]), allowExternalFallthrough: false })]
  }), "\"code\" does not exist in the hypothetical file system");
});

describe("Paths", function() {
  it("should handle an entry point that appears to be external", function() {
    return resolve(rollup.rollup({
      input: 'x.js',
      plugins: [hypothetical({ files: { './x.js': 'object.key = false;' } })]
    }), { key: false });
  });
  
  it("should handle absolute paths", function() {
    return resolve(rollup.rollup({
      input: '/x.js',
      plugins: [hypothetical({ files: { '/x.js': 'object.key = false;' } })]
    }), { key: false });
  });
  
  it("should handle backslash-separated paths", function() {
    return resolve(rollup.rollup({
      input: 'dir\\x.js',
      plugins: [hypothetical({ files: { '.\\dir\\x.js': 'object.key = false;' } })]
    }), { key: false });
  });
  
  it("should handle mixed slash style paths", function() {
    return resolve(rollup.rollup({
      input: 'dir\\this-is-horrible/x.js',
      plugins: [hypothetical({ files: { './dir\\this-is-horrible/x.js': 'object.key = false;' } })]
    }), { key: false });
  });
  
  it("should convert between slash styles", function() {
    return resolve(rollup.rollup({
      input: 'dir\\x.js',
      plugins: [hypothetical({ files: { './dir/x.js': 'object.key = false;' } })]
    }), { key: false });
  });
  
  it("should handle backslashes when another plugin resolves the ID", function() {
    return resolve(rollup.rollup({
      input: 'C:\\dir\\x.js',
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
      input: 'C:\\x.js',
      plugins: [hypothetical({ files: { 'C:\\x.js': 'object.key = false;' } })]
    }), { key: false });
  });
  
  it("should normalize supplied file paths", function() {
    return resolve(rollup.rollup({
      input: 'x.js',
      plugins: [hypothetical({ files: { './dir/../x.js': 'object.key = false;' } })]
    }), { key: false });
  });
  
  it("should normalize module file paths", function() {
    return resolve(rollup.rollup({
      input: './dir/../x.js',
      plugins: [hypothetical({ files: { './x.js': 'object.key = false;' } })]
    }), { key: false });
  });
  
  it("should add a .js extension if necessary by default", function() {
    return resolve(rollup.rollup({
      input: 'x',
      plugins: [hypothetical({ files: {
        './x.js': 'import \'./y\'; object.key = false;',
        './y.js': 'object.key2 = 5;'
      } })]
    }), { key: false, key2: 5 });
  });
  
  it("should add a trailing slash if necessary by default", function() {
    return resolve(rollup.rollup({
      input: 'x',
      plugins: [hypothetical({ files: {
        './x/': 'import \'./y\'; object.key = false;',
        './y/': 'object.key2 = 5;'
      } })]
    }), { key: false, key2: 5 });
  });
  
  it("should add any extensions passed into options.impliedExtensions", function() {
    return resolve(rollup.rollup({
      input: 'x',
      plugins: [hypothetical({ files: {
        './x.lol': 'import \'./y\'; object.key = false;',
        './y.ha': 'object.key2 = 5;'
      }, impliedExtensions: ['.lol', '.ha'] })]
    }), { key: false, key2: 5 });
  });
  
  it("should handle external paths", function() {
    return resolve(rollup.rollup({
      input: 'x',
      plugins: [hypothetical({ files: {
        './x.js': 'import \'x\'; object.key = false;',
        'x': 'object.key2 = 5;'
      }, allowExternalFallthrough: false })]
    }), { key: false, key2: 5 });
  });
  
  it("should normalize external module file paths", function() {
    return resolve(rollup.rollup({
      input: 'x.js',
      plugins: [hypothetical({ files: {
        './x.js': 'import \'external/dir/../y.js\'; object.key = false;',
        'external/y.js': 'object.key2 = 5;'
      }, allowExternalFallthrough: false })]
    }), { key: false, key2: 5 });
  });
  
  it("should forbid external module paths from going up more directories than they go down", function() {
    return reject(resolve(rollup.rollup({
      input: 'x.js',
      plugins: [hypothetical({ files: {
        './x.js': 'import \'external/../../y.js\';',
      }, allowExternalFallthrough: false })]
    })), "External import \"external/../../y.js\" normalized to \"../y.js\"!");
  });
  
  it("should normalize external supplied file paths", function() {
    return resolve(rollup.rollup({
      input: 'x.js',
      plugins: [hypothetical({ files: {
        './x.js': 'import \'external/y.js\'; object.key = false;',
        'external/dir/../y.js': 'object.key2 = 5;'
      }, allowExternalFallthrough: false })]
    }), { key: false, key2: 5 });
  });
  
  it("should forbid external supplied paths from going up more directories than they go down", function() {
    try {
      hypothetical({ files: {
        './x.js': '',
        'external/../../y.js': '',
      }, allowExternalFallthrough: false });
    } catch(e) {
      if(e.message.indexOf("Supplied external file path \"external/../../y.js\" normalized to \"../y.js\"!") === -1) {
        throw Error("Incorrect error message \"" + e.message + "\"!");
      }
      return;
    }
    throw Error("No error was thrown!");
  });
  
  it("should add implied extensions to external module file paths", function() {
    return resolve(rollup.rollup({
      input: 'x.js',
      plugins: [hypothetical({ files: {
        './x.js': 'import \'external\'; object.key = false;',
        'external.js': 'object.key2 = 5;'
      }, allowExternalFallthrough: false })]
    }), { key: false, key2: 5 });
  });
  
  it("should add implied slashes to external module file paths", function() {
    return resolve(rollup.rollup({
      input: 'x.js',
      plugins: [hypothetical({ files: {
        './x.js': 'import \'external\'; object.key = false;',
        'external/': 'object.key2 = 5;'
      }, allowExternalFallthrough: false })]
    }), { key: false, key2: 5 });
  });
  
  it("should handle relative imports within external modules", function() {
    return resolve(rollup.rollup({
      input: 'x.js',
      plugins: [hypothetical({ files: {
        './x.js': 'import \'external/y.js\'; object.key = false;',
        'external/y.js': 'import \'./z.js\'; object.key2 = 5;',
        'external/z.js': 'object.key3 = 10;'
      }, allowExternalFallthrough: false })]
    }), { key: false, key2: 5, key3: 10 });
  });
  
  it("should forbid relative imports within external modules from going up too many directories", function() {
    return reject(resolve(rollup.rollup({
      input: 'x.js',
      plugins: [hypothetical({ files: {
        './x.js': 'import \'external/y.js\';',
        'external/y.js': 'import \'../../z.js\';'
      }, allowExternalFallthrough: false })]
    })), "Import \"../../z.js\" relative to external import \"external/y.js\" results in \"../z.js\"!");
  });
  
  it("should handle fallthrough relative to external imports when options.allowRelativeExternalFallthrough is true...", function() {
    return rollup.rollup({
      input: 'x.js',
      plugins: [hypothetical({ files: {
        './x.js': 'import \'external/y.js\'; object.key = false;',
        'external/y.js': 'import \'./z.js\'; object.key2 = 5;'
      }, allowRelativeExternalFallthrough: true })],
      external: ['external/z.js']
    }).then(function(bundle) {
      return bundle.generate({ format: 'es' });
    }).then(function(result) {
      if(result.code.indexOf('external/z.js') === -1) {
        throw Error("Output code does not import external/z.js");
      }
    });
  });
  
  it("shouldn't add .js if it isn't in options.impliedExtensions", function() {
    return reject(resolve(rollup.rollup({
      input: 'x',
      plugins: [hypothetical({ files: {
        './x.lol': 'import \'./y\'; object.key = false;',
        './y.js': 'object.key2 = 5;'
      }, impliedExtensions: ['.lol'] })]
    })), "does not exist in the hypothetical file system");
  });
  
  it("shouldn't add any extensions if options.impliedExtensions is false", function() {
    return reject(resolve(rollup.rollup({
      input: 'x.js',
      plugins: [hypothetical({ files: {
        './x.js': 'import \'./y\'; object.key = false;',
        './y.js': 'object.key2 = 5;'
      }, impliedExtensions: false })]
    })), "does not exist in the hypothetical file system");
  });
  
  it("shouldn't add any slashes if options.impliedExtensions is false", function() {
    return reject(resolve(rollup.rollup({
      input: 'x.js',
      plugins: [hypothetical({ files: {
        './x.js': 'import \'./y\'; object.key = false;',
        './y/': 'object.key2 = 5;'
      }, impliedExtensions: false })]
    })), "does not exist in the hypothetical file system");
  });
  
  it("shouldn't add extensions to external modules if options.impliedExtensions is false", function() {
    return reject(resolve(rollup.rollup({
      input: 'x.js',
      plugins: [hypothetical({ files: {
        './x.js': 'import \'external\'; object.key = false;',
        'external.js': 'object.key2 = 5;'
      }, impliedExtensions: false, allowExternalFallthrough: false })]
    })), "does not exist in the hypothetical file system");
  });
  
  it("shouldn't add slashes to external modules if options.impliedExtensions is false", function() {
    return reject(resolve(rollup.rollup({
      input: 'x.js',
      plugins: [hypothetical({ files: {
        './x.js': 'import \'external\'; object.key = false;',
        'external/': 'object.key2 = 5;'
      }, impliedExtensions: false, allowExternalFallthrough: false })]
    })), "does not exist in the hypothetical file system");
  });

  // @todo: we need a test for windows systems and it's importer's path
  xit("should normalize the importer's path", function() {});
});
