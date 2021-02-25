let { declare } = require('@babel/helper-plugin-utils');
let { types: t } = require('@babel/core');

let dCall = (k, ...args) => t.callExpression(
  t.memberExpression(t.identifier('d'), t.identifier(k)), args,
);

let fnAttrGuard = (originalExpr, bindingExpr) => t.logicalExpression(
  '||', dCall('fnAttr', originalExpr), bindingExpr,
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
            node.expression = fnAttrGuard(expr, dCall(
              'binding', t.objectExpression([
                getProp, t.objectProperty(
                  t.identifier('set'), t.arrowFunctionExpression(
                    [t.identifier('dref$x')], t.assignmentExpression(
                      '=', t.cloneNode(expr), t.identifier('dref$x'),
                    ),
                  ),
                ),
              ]),
            ));
          } else if (
            t.isArrayExpression(expr) ||
            t.isBinaryExpression(expr) ||

            (t.isCallExpression(expr) &&
              !t.isIdentifier(expr.callee, { name: 'd' }))
          ) {
            node.expression = fnAttrGuard(
              expr, dCall('binding', t.objectExpression([getProp])),
            );
          }
        }
      },
    },
  };
});