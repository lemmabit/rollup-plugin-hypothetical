# rollup-plugin-code-generator

Fork of [rollup-plugin-hypothetical](https://github.com/lemmabit/rollup-plugin-hypothetical).

## Differences:

- Supports regex paths
- Supports returning generator functions instead of strings for paths
- Removes most other functionality for simplicity


## Options:

Only has one option.

### options.paths

`Map(path<string | RegExp>, code_generator<string | Function>)`

```js
// vite.config.js:
// ...
plugins: [
  code_generator({
    paths: new Map([
      [
        '@constants',   // A string path will exactly match a particular import path
        `
          export default {
            NumberOfLlamas: 6,
          }
        `
      ],
      [
        /^@components\//,  // A regex path can be used to match any matching path
        id => {            // Instead of a string, your code can be output by a function,
          const name = id.match(/([^/]+)$/)[1]
          return `
            import ${name} from '/src/components/${name}.jsx'
            export default ${name}
          `
        },
      ],
    ]),
  }),
],
// ...
```
