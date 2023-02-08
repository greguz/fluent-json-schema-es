export default {
  input: './FluentJSONSchema.js',
  output: {
    file: './FluentJSONSchema.cjs',
    format: 'cjs'
  },
  external: ['@fastify/deepmerge']
}
