const fs = require('fs');
const path = require('path');
const babylon = require('babylon');
const traverse = require('@babel/traverse').default;
const babel = require('@babel/core');


let ID = 0;

function createAssert (filename) {
    let content = fs.readFileSync(filename, 'utf-8');
    const ast = babylon.parse(content, {
        sourceType: "module"
    });
    const dependencies = [];
    traverse(ast, {
        ImportDeclaration: ({node}) => {
            dependencies.push(node.source.value);
        }
    });
    const {code} = babel.transformFromAst(ast, null, {
        presets: ['@babel/preset-env']//
    });
    let id = ID++;
    return {
        id,
        filename,
        dependencies,
        code
    };
}
function createGraph (entry) {
    const mainAssert = createAssert(entry);
    const queue = [mainAssert];
    for (const asset of queue) {
        const dirname = path.dirname(asset.filename);
        asset.mapping = {};
        asset.dependencies.forEach((relativePath) => {
            const absolutePath = path.join(dirname, relativePath);
            const child = createAssert(absolutePath);
            asset.mapping[relativePath] = child.id;
            queue.push(child);//queue每增加一项，就会多遍历一次，而不仅仅只是遍历最初的一次
        })
    }
    return queue;
}

function bundle (graph) {
    let modules = '';
    graph.forEach(mod => {
       modules += `${mod.id}:[
         function (require, module, exports) {
           ${mod.code} 
         },
         ${JSON.stringify(mod.mapping)}
       ],`
    });
    const result = `
      (function (modules) {
        function require (id) {
          const [fn, mapping] = modules[id];
          function localRequire (relativePath) {
            return require(mapping[relativePath])
          }
          const module = { exports: {} }
          fn(localRequire, module, module.exports)
          return module.exports;
        }
        require(0)
      })({${modules}})
    `;
    return result;
}

const graph = createGraph('./example/entry.js');
const result = bundle(graph);
console.log(result);

