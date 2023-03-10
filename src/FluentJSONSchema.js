import { FORMATS, TYPES, FluentSchemaError } from './utils.js'

import { BaseSchema } from './BaseSchema.js'
import { NullSchema } from './NullSchema.js'
import { BooleanSchema } from './BooleanSchema.js'
import { StringSchema } from './StringSchema.js'
import { NumberSchema } from './NumberSchema.js'
import { IntegerSchema } from './IntegerSchema.js'
import { ObjectSchema } from './ObjectSchema.js'
import { ArraySchema } from './ArraySchema.js'
import { MixedSchema } from './MixedSchema.js'
import { RawSchema } from './RawSchema.js'

const initialState = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  definitions: [],
  properties: [],
  required: []
}

/**
 * Represents a S.
 * @param {Object} [options] - Options
 * @param {S} [options.schema] - Default schema
 * @param {boolean} [options.generateIds = false] - generate the id automatically e.g. #properties.foo
 * @returns {S}
 */

const withOptions = (
  { schema = initialState, ...options } = {
    generateIds: false,
    factory: BaseSchema
  }
) => ({
  ...BaseSchema({ ...options, schema }),

  /**
   * Set a property to type string
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.3|reference}
   * @returns {StringSchema}
   */

  string: () =>
    StringSchema({
      ...options,
      schema,
      factory: StringSchema
    }).as('string'),

  /**
   * Set a property to type number
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#numeric|reference}
   * @returns {NumberSchema}
   */

  number: () =>
    NumberSchema({
      ...options,
      schema,
      factory: NumberSchema
    }).as('number'),

  /**
   * Set a property to type integer
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#numeric|reference}
   * @returns {IntegerSchema}
   */

  integer: () =>
    IntegerSchema({
      ...options,
      schema,
      factory: IntegerSchema
    }).as('integer'),

  /**
   * Set a property to type boolean
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.7|reference}
   * @returns {BooleanSchema}
   */

  boolean: () =>
    BooleanSchema({
      ...options,
      schema,
      factory: BooleanSchema
    }).as('boolean'),

  /**
   * Set a property to type array
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.4|reference}
   * @returns {ArraySchema}
   */

  array: () =>
    ArraySchema({
      ...options,
      schema,
      factory: ArraySchema
    }).as('array'),

  /**
   * Set a property to type object
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#rfc.section.6.5|reference}
   * @returns {ObjectSchema}
   */

  object: baseSchema =>
    ObjectSchema({
      ...options,
      schema: baseSchema || schema,
      factory: ObjectSchema
    }).as('object'),

  /**
   * Set a property to type null
   *
   * {@link https://tools.ietf.org/id/draft-handrews-json-schema-validation-01.html#general|reference}
   * @returns {NullSchema}
   */

  null: () =>
    NullSchema({
      ...options,
      schema,
      factory: NullSchema
    }).null(),

  /**
   * A mixed schema is the union of multiple types (e.g. ['string', 'integer']
   *
   * @param {Array.<string>} types
   * @returns {MixedSchema}
   */

  mixed: types => {
    if (
      !Array.isArray(types) ||
      (Array.isArray(types) &&
        types.filter(t => !Object.values(TYPES).includes(t)).length > 0)
    ) {
      throw new FluentSchemaError(
        `Invalid 'types'. It must be an array of types. Valid types are ${Object.values(
          TYPES
        ).join(' | ')}`
      )
    }

    return MixedSchema({
      ...options,
      schema: {
        ...schema,
        type: types
      },
      factory: MixedSchema
    })
  },

  /**
   * Because the differences between JSON Schemas and Open API (Swagger)
   * it can be handy to arbitrary modify the schema injecting a fragment
   *
   * * Examples:
   * - S.raw({ nullable:true, format: 'date', formatMaximum: '2020-01-01' })
   * - S.string().format('date').raw({ formatMaximum: '2020-01-01' })
   *
   * @param {string} fragment an arbitrary JSON Schema to inject
   * @returns {BaseSchema}
   */

  raw: fragment => {
    return RawSchema(fragment)
  }
})

export default {
  ...BaseSchema(),
  FORMATS,
  TYPES,
  FluentSchemaError,
  withOptions,
  string: () => withOptions().string(),
  mixed: types => withOptions().mixed(types),
  object: () => withOptions().object(),
  array: () => withOptions().array(),
  boolean: () => withOptions().boolean(),
  integer: () => withOptions().integer(),
  number: () => withOptions().number(),
  null: () => withOptions().null(),
  raw: fragment => withOptions().raw(fragment)
}
