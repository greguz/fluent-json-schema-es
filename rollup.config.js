export default {
  input: './src/FluentJSONSchema.js',
  output: [
    {
      file: './S.cjs',
      format: 'cjs'
    },
    {
      file: './S.mjs',
      format: 'es'
    }
  ],
  external: ['@fastify/deepmerge']
}
