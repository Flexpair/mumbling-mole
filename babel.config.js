module.exports = {
  presets: [
    ['@babel/preset-env', { loose: true }]
  ],
  plugins: [
    '@babel/plugin-transform-runtime',
    ['@babel/plugin-transform-class-properties', { loose: true }],
    ['@babel/plugin-transform-private-methods', { loose: true }],
    ['@babel/plugin-transform-private-property-in-object', { loose: true }]
  ]
};