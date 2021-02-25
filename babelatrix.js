let { declare } = require('@babel/helper-plugin-utils');
let { types: t } = require('@babel/core');

let dCall = (k, ...args) => t.callExpression(
  t.memberExpression(t.identifier('d'), t.identifier(k)), args,
);

module.exports = declare((api, options) => {
  api.assertVersion(7);

  return {
    name: "plugin-babelatrix",

    visitor: {
      JSXExpressionContainer(path) {
        let { node, parent } = path;
        let expr = node.expression;

        if (t.isJSXElement(parent)) {
          node.expression = dCall('child', t.arrowFunctionExpression([], expr));
        } else if (t.isJSXAttribute(parent) && parent.name.name !== 'children') {
          let getProp = t.objectProperty(
            t.identifier('get'),
            t.arrowFunctionExpression([], t.cloneNode(expr)),
          );

          if (t.isIdentifier(expr) || t.isMemberExpression(expr)) {
            node.expression = dCall('binding', t.objectExpression([
              getProp, t.objectProperty(
                t.identifier('set'), t.arrowFunctionExpression(
                  [t.identifier('dref$x')], t.assignmentExpression(
                    '=', t.cloneNode(expr), t.identifier('dref$x'),
                  ),
                ),
              )
            ]),
            );
          } else if (
            !t.isBigIntLiteral(expr) &&
            !t.isBooleanLiteral(expr) &&
            !t.isNullLiteral(expr) &&
            !t.isNumericLiteral(expr) &&
            !t.isRegExpLiteral(expr) &&
            !t.isStringLiteral(expr) &&

            !t.isArrowFunctionExpression(expr) &&
            !t.isFunctionExpression(expr) &&

            (!t.isCallExpression(expr) ||
              !t.isIdentifier(expr.callee.object, { name: 'd' }))
          ) {
            node.expression = dCall('binding', t.objectExpression([getProp]));
          }
        }
      },
    },
  };
});