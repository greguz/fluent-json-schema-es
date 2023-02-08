import { NullSchema } from './NullSchema.js'
import { BooleanSchema } from './BooleanSchema.js'
import { StringSchema } from './StringSchema.js'
import { NumberSchema } from './NumberSchema.js'
import { IntegerSchema } from './IntegerSchema.js'
import { ObjectSchema } from './ObjectSchema.js'
import { ArraySchema } from './ArraySchema.js'

import { TYPES, FLUENT_SCHEMA } from './utils.js'

const initialState = {
  type: [],
  definitions: [],
  properties: [],
  required: []
}

/**
 * Represents a MixedSchema.
 * @param {Object} [options] - Options
 * @param {MixedSchema} [options.schema] - Default schema
 * @param {boolean} [options.generateIds = false] - generate the id automatically e.g. #properties.foo
 * @returns {StringSchema}
 */

export const MixedSchema = ({ schema = initialState, ...options } = {}) => {
  options = {
    generateIds: false,
    factory: MixedSchema,
    ...options
  }
  return {
    [FLUENT_SCHEMA]: true,
    ...(schema.type.includes(TYPES.STRING)
      ? StringSchema({ ...options, schema, factory: MixedSchema })
      : {}),
    ...(schema.type.includes(TYPES.NUMBER)
      ? NumberSchema({ ...options, schema, factory: MixedSchema })
      : {}),
    ...(schema.type.includes(TYPES.BOOLEAN)
      ? BooleanSchema({ ...options, schema, factory: MixedSchema })
      : {}),
    ...(schema.type.includes(TYPES.INTEGER)
      ? IntegerSchema({ ...options, schema, factory: MixedSchema })
      : {}),
    ...(schema.type.includes(TYPES.OBJECT)
      ? ObjectSchema({ ...options, schema, factory: MixedSchema })
      : {}),
    ...(schema.type.includes(TYPES.ARRAY)
      ? ArraySchema({ ...options, schema, factory: MixedSchema })
      : {}),
    ...(schema.type.includes(TYPES.NULL)
      ? NullSchema({ ...options, schema, factory: MixedSchema })
      : {})
  }
}
