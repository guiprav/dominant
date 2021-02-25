let { declare } = require('@babel/helper-plugin-utils');
let { types: t } = require('@babel/core');

module.exports = declare((api, options) => {
  api.assertVersion(7);

  return {
    name: "plugin-dref-macro",

    visitor: {
      CallExpression(path) {
        const { node, scope } = path;

        if (
          !t.isMemberExpression(node.callee) ||
          !t.isIdentifier(node.callee.object, { name: 'd' }) ||
          !t.isIdentifier(node.callee.property, { name: 'ref' })
        ) {
          return;
        }

        node.callee.property = t.identifier('binding');

        node.arguments[0] = t.callExpression(
          t.memberExpression(
            t.cloneNode(node.callee.object),
            t.identifier('binding'),
          ),

          [t.objectExpression([
            t.objectProperty(t.identifier('get'), t.arrowFunctionExpression(
              [], t.cloneNode(node.arguments[0]),
            )),

            t.objectProperty(t.identifier('set'), t.arrowFunctionExpression(
              [t.identifier('dref$x')], t.assignmentExpression(
                '=', t.cloneNode(node.arguments[0]), t.identifier('dref$x'),
              ),
            )),
          ])],
        );
      },
    },
  };
});