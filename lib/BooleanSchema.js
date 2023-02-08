import { BaseSchema } from './BaseSchema.js'

const initialState = {
  type: 'boolean'
}

/**
 * Represents a BooleanSchema.
 * @param {Object} [options] - Options
 * @param {StringSchema} [options.schema] - Default schema
 * @param {boolean} [options.generateIds = false] - generate the id automatically e.g. #properties.foo
 * @returns {StringSchema}
 */

export const BooleanSchema = ({ schema = initialState, ...options } = {}) => {
  options = {
    generateIds: false,
    factory: BaseSchema,
    ...options
  }
  return {
    ...BaseSchema({ ...options, schema })
  }
}
