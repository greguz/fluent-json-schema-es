import { BaseSchema } from './BaseSchema.js'
import { BooleanSchema } from './BooleanSchema.js'
import { StringSchema } from './StringSchema.js'
import { NumberSchema } from './NumberSchema.js'
import { IntegerSchema } from './IntegerSchema.js'
import { ObjectSchema } from './ObjectSchema.js'
import { ArraySchema } from './ArraySchema.js'
import { toArray, FluentSchemaError } from './utils.js'

/**
 * Represents a raw JSON Schema that will be parsed
 * @param {Object} schema
 * @returns {FluentSchema}
 */

export const RawSchema = (schema = {}) => {
  if (typeof schema !== 'object') {
    throw new FluentSchemaError('A fragment must be a JSON object')
  }
  const { type, definitions, properties, required, ...props } = schema
  switch (schema.type) {
    case 'string': {
      const schema = {
        type,
        ...props
      }
      return StringSchema({ schema, factory: StringSchema })
    }

    case 'integer': {
      const schema = {
        type,
        ...props
      }
      return IntegerSchema({ schema, factory: NumberSchema })
    }
    case 'number': {
      const schema = {
        type,
        ...props
      }
      return NumberSchema({ schema, factory: NumberSchema })
    }

    case 'boolean': {
      const schema = {
        type,
        ...props
      }
      return BooleanSchema({ schema, factory: BooleanSchema })
    }

    case 'object': {
      const schema = {
        type,
        definitions: toArray(definitions) || [],
        properties: toArray(properties) || [],
        required: required || [],
        ...props
      }
      return ObjectSchema({ schema, factory: ObjectSchema })
    }

    case 'array': {
      const schema = {
        type,
        ...props
      }
      return ArraySchema({ schema, factory: ArraySchema })
    }

    default: {
      const schema = {
        ...props
      }

      return BaseSchema({
        schema,
        factory: BaseSchema
      })
    }
  }
}
