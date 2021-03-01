let { declare } = require('@babel/helper-plugin-utils');
let { types: t } = require('@babel/core');

let dCall = (k, ...args) => t.callExpression(
  t.memberExpression(t.identifier('d'), t.identifier(k)), args,
);

let bindingProps = {
  get: expr => t.objectProperty(
    t.identifier('get'),
    t.arrowFunctionExpression([], expr),
  ),

  set: expr => t.objectProperty(
    t.identifier('set'), t.arrowFunctionExpression(
      [t.identifier('dref$x')], t.assignmentExpression(
        '=', t.cloneNode(expr), t.identifier('dref$x'),
      ),
    ),
  ),
};

module.exports = declare((api, options) => {
  api.assertVersion(7);

  return {
    name: "plugin-babelatrix",

    visitor: {
      CallExpression(path) {
        let { node } = path;

        if (
          !t.isMemberExpression(node.callee) ||
          !t.isIdentifier(node.callee.object, { name: 'd' })
        ) {
          return;
        }

        switch (node.callee.property.name) {
          case 'if':
          case 'map':
          case 'text':
            if (
              !t.isArrowFunctionExpression(node.arguments[0]) &&
              !t.isFunctionExpression(node.arguments[0])
            ) {
              node.arguments[0] =
                t.arrowFunctionExpression([], node.arguments[0]);
            }

            break;

          case 'ref':
            path.replaceWith(dCall('binding', t.objectExpression([
              bindingProps.get(node),
              bindingProps.set(t.cloneNode(node)),
            ])));

            break;
        }
      },

      JSXExpressionContainer(path) {
        let { node, parent } = path;
        let expr = node.expression;

        if (t.isJSXElement(parent)) {
          node.expression = dCall('child', t.arrowFunctionExpression([], expr));
        } else if (t.isJSXAttribute(parent) && parent.name.name !== 'children') {
          if (t.isIdentifier(expr) || t.isMemberExpression(expr)) {
            node.expression = dCall('binding', t.objectExpression([
              bindingProps.get(expr),
              bindingProps.set(t.cloneNode(expr))
            ]));
          } else if (
            !t.isBigIntLiteral(expr) &&
            !t.isBooleanLiteral(expr) &&
            !t.isNullLiteral(expr) &&
            !t.isNumericLiteral(expr) &&
            !t.isObjectExpression(expr) &&
            !t.isRegExpLiteral(expr) &&
            !t.isStringLiteral(expr) &&

            !t.isArrowFunctionExpression(expr) &&
            !t.isFunctionExpression(expr) &&

            (!t.isCallExpression(expr) ||
              !t.isIdentifier(expr.callee.object, { name: 'd' }))
          ) {
            node.expression = dCall('binding', t.objectExpression([
              bindingProps.get(expr),
            ]));
          }
        }
      },
    },
  };
});